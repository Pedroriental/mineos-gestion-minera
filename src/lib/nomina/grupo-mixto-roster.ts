import { getGrupoNominaKey } from '@/lib/personal-master';
import { semanasTranscurridas, totalSemanasEsquema } from '@/lib/nomina/perfil-ciclo-reglas';
import type { NominaRegistro, NominaSemana, Personal } from '@/lib/types';

export type GrupoMixtoRosterConfidence = 'alta' | 'media' | 'baja';

export type GrupoMixtoHistoryRegistro = Pick<
  NominaRegistro,
  'personal_id' | 'monto_pagado' | 'estado_asistencia'
> & {
  personal?: Pick<Personal, 'id' | 'area_detalle' | 'area' | 'cargo'> | null;
};

export type GrupoMixtoHistoryWeek = Pick<NominaSemana, 'id' | 'semana_inicio'> & {
  registros: GrupoMixtoHistoryRegistro[];
};

export type GrupoMixtoRosterProjection = {
  shouldApply: boolean;
  confidence: GrupoMixtoRosterConfidence;
  expectedIds: string[];
  suppressedIds: string[];
  sourceWeekStart: string | null;
  cycleLength: number;
  reason: string;
};

const GRUPO_MIXTO_PATTERN = /grupo\s*\(?\s*mixto\s*\)?/i;
const MAX_HISTORY_WEEKS = 12;

export function isGrupoMixtoPersonal(
  personal: Pick<Personal, 'area_detalle' | 'area' | 'cargo'>,
): boolean {
  return GRUPO_MIXTO_PATTERN.test(getGrupoNominaKey(personal));
}

function resolveDominantCycleLength(personal: Personal[]): number {
  const counts = new Map<number, number>();
  for (const p of personal) {
    const total = totalSemanasEsquema(p.esquema_rotacion);
    if (total <= 1) continue;
    counts.set(total, (counts.get(total) ?? 0) + 1);
  }

  let best = 4;
  let bestCount = 0;
  for (const [weeks, count] of counts) {
    if (count > bestCount) {
      best = weeks;
      bestCount = count;
    }
  }
  return best;
}

function recordCountsAsExpected(registro: GrupoMixtoHistoryRegistro): boolean {
  if (Number(registro.monto_pagado) > 0) return true;
  return registro.estado_asistencia === 'trabajada' || registro.estado_asistencia === 'libre';
}

function uniqueSortedIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

export function buildGrupoMixtoRosterProjection(input: {
  activePersonal: Personal[];
  targetWeekStart: string;
  historyWeeks: GrupoMixtoHistoryWeek[];
}): GrupoMixtoRosterProjection {
  const activeGrupo = input.activePersonal.filter(isGrupoMixtoPersonal);
  const allActiveGrupoIds = new Set(activeGrupo.map((p) => p.id));

  if (activeGrupo.length < 8) {
    return {
      shouldApply: false,
      confidence: 'baja',
      expectedIds: [],
      suppressedIds: [],
      sourceWeekStart: null,
      cycleLength: 1,
      reason: 'Grupo mixto sin volumen suficiente para inferir cuadrilla.',
    };
  }

  const byId = new Map(input.activePersonal.map((p) => [p.id, p]));
  const cycleLength = resolveDominantCycleLength(activeGrupo);
  const candidates = input.historyWeeks
    .filter((week) => week.semana_inicio < input.targetWeekStart)
    .slice(0, MAX_HISTORY_WEEKS)
    .flatMap((week) => {
      const ids = uniqueSortedIds(
        week.registros.flatMap((registro) => {
          if (!recordCountsAsExpected(registro)) return [];
          const personal = byId.get(registro.personal_id) ?? registro.personal;
          if (!personal || !isGrupoMixtoPersonal(personal)) return [];
          if (!allActiveGrupoIds.has(registro.personal_id)) return [];
          return [registro.personal_id];
        }),
      );
      if (ids.length < 3 || ids.length >= activeGrupo.length) return [];

      const distance = semanasTranscurridas(week.semana_inicio, input.targetWeekStart);
      if (distance <= 0) return [];
      const sameCycle = cycleLength > 1 && distance % cycleLength === 0;
      const ratio = ids.length / activeGrupo.length;
      const compactRosterBonus = ratio <= 0.75 ? 25 : 0;
      const score = (sameCycle ? 1000 : 100) + compactRosterBonus - distance;
      return [{ week, ids, distance, sameCycle, score }];
    })
    .sort((a, b) => b.score - a.score);

  const selected = candidates[0];
  if (!selected) {
    return {
      shouldApply: false,
      confidence: 'baja',
      expectedIds: [],
      suppressedIds: [],
      sourceWeekStart: null,
      cycleLength,
      reason: 'No hay historial cerrado suficiente para proyectar cuadrilla de Grupo (mixto).',
    };
  }

  const expectedSet = new Set(selected.ids);
  const suppressedIds = uniqueSortedIds(activeGrupo.filter((p) => !expectedSet.has(p.id)).map((p) => p.id));
  const shouldApply = suppressedIds.length >= 3 && selected.ids.length < activeGrupo.length;
  const confidence: GrupoMixtoRosterConfidence = selected.sameCycle ? 'alta' : 'media';
  const reason = selected.sameCycle
    ? `Cuadrilla proyectada desde la semana ${selected.week.semana_inicio}, misma posición del ciclo ${cycleLength} semanas.`
    : `Cuadrilla proyectada desde la semana cerrada ${selected.week.semana_inicio}.`;

  return {
    shouldApply,
    confidence,
    expectedIds: selected.ids,
    suppressedIds,
    sourceWeekStart: selected.week.semana_inicio,
    cycleLength,
    reason,
  };
}
