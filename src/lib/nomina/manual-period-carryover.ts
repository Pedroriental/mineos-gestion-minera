import type { EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import {
  nominaNovedadDraftKey,
  parseNovedadTurno,
  parseReposoCondicionFromObs,
  reposoPagoUnicoMontoFromRow,
  writeNominaNovedadDraft,
  type NominaNovedadTurno,
  type NominaWeekDraft,
  type ReposoModoSueldoSemana,
} from '@/lib/nomina-novedad-turno';
import { nextWeekInManualPeriod, type ManualNominaPeriod } from '@/lib/nomina/manual-period';
import {
  readManualWeekRosterEntries,
  writeManualWeekRosterEntries,
  type ManualWeekRosterEntry,
} from '@/lib/nomina/manual-period-roster';
import { readNominaNovedadDraft } from '@/lib/nomina-novedad-turno';
import type { Personal } from '@/lib/types';

export type ManualWeekCarryoverRow = {
  personal: Pick<Personal, 'id' | 'area_detalle'>;
  novedadTurno: NominaNovedadTurno;
  novedadTurnoObs: string;
  reposoCondicion?: ReposoModoSueldoSemana | null;
  reposoDiasPagados?: number;
  reposoCompensacionMonto?: number;
  estadoAsistencia: EstadoAsistenciaNomina;
  diasTrabajados: number;
  bonoTransporte: number;
  bonificaciones: number;
};

/** Borrador inicial para la semana siguiente: conserva pagos, reinicia novedades; asistencia la define la plantilla de la semana destino. */
export function preNominaRowToCarryoverDraft(row: ManualWeekCarryoverRow) {
  const pagoUnico = reposoPagoUnicoMontoFromRow(row);
  const bonificacionesBase = Math.max(0, (Number(row.bonificaciones) || 0) - pagoUnico);
  return {
    novedadTurno: 'ACTIVO' as const,
    novedadTurnoObs: '',
    reposoCondicion: null,
    reposoDiasPagados: 0,
    reposoCompensacionMonto: 0,
    bonoTransporte: row.bonoTransporte,
    bonificaciones: bonificacionesBase,
  };
}

export function buildRosterEntriesFromCarryoverRows(
  rows: ManualWeekCarryoverRow[],
): ManualWeekRosterEntry[] {
  return rows.map((row) => ({
    id: row.personal.id,
    areaDetalle: row.personal.area_detalle?.trim() || undefined,
  }));
}

export function buildCarryoverDraftFromRows(rows: ManualWeekCarryoverRow[]): NominaWeekDraft {
  const draft: NominaWeekDraft = {};
  for (const row of rows) {
    draft[row.personal.id] = preNominaRowToCarryoverDraft(row);
  }
  return draft;
}

/** Tras cerrar semana N, precarga roster + borrador en semana N+1 del periodo manual. */
export function carryManualWeekToNext(
  area: string,
  period: ManualNominaPeriod,
  closedWeekStart: string,
  rows: ManualWeekCarryoverRow[],
): string | null {
  const nextWeek = nextWeekInManualPeriod(period, closedWeekStart);
  if (!nextWeek) return null;

  const existingRoster = readManualWeekRosterEntries(area, nextWeek, period.id);
  const existingDraft = readNominaNovedadDraft(
    nominaNovedadDraftKey(area, nextWeek, period.id),
  );

  const mergedRoster = rows.length
    ? mergeCarryoverRoster(existingRoster, rows)
    : existingRoster;
  const mergedDraft = rows.length
    ? mergeCarryoverDraft(existingDraft, rows)
    : existingDraft;

  writeManualWeekRosterEntries(area, nextWeek, mergedRoster, period.id);
  writeNominaNovedadDraft(
    nominaNovedadDraftKey(area, nextWeek, period.id),
    mergedDraft,
  );
  return nextWeek;
}

/** Roster destino tras arrastrar: une manuales existentes con arrastrados, sin duplicar. */
export function mergeCarryoverRoster(
  existingEntries: ManualWeekRosterEntry[],
  rows: ManualWeekCarryoverRow[],
): ManualWeekRosterEntry[] {
  const carried = buildRosterEntriesFromCarryoverRows(rows);
  const byId = new Map<string, ManualWeekRosterEntry>();
  for (const e of existingEntries) byId.set(e.id, e);
  for (const e of carried) {
    const prev = byId.get(e.id);
    byId.set(e.id, prev ? { ...prev, ...e } : e);
  }
  return [...byId.values()];
}

/** Draft destino tras arrastrar: conserva entradas manuales, rellena nuevas desde el carryover. */
export function mergeCarryoverDraft(
  existingDraft: NominaWeekDraft,
  rows: ManualWeekCarryoverRow[],
): NominaWeekDraft {
  const carried = buildCarryoverDraftFromRows(rows);
  const merged: NominaWeekDraft = { ...existingDraft };
  for (const [personalId, carriedEntry] of Object.entries(carried)) {
    const prev = merged[personalId];
    if (prev) {
      merged[personalId] = {
        ...prev,
        bonoTransporte: carriedEntry.bonoTransporte,
        bonificaciones: carriedEntry.bonificaciones,
      };
    } else {
      merged[personalId] = carriedEntry;
    }
  }
  return merged;
}

export function mergePersonalCatalogWithRosterEntries(
  catalog: Personal[],
  entries: ManualWeekRosterEntry[],
  area: string,
): Personal[] {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const out: Personal[] = [];
  for (const entry of entries) {
    const base = byId.get(entry.id);
    if (!base) continue;
    out.push({
      ...base,
      area: area as Personal['area'],
      ...(entry.areaDetalle ? { area_detalle: entry.areaDetalle } : {}),
    });
  }
  return out;
}

/** Registros de semana cerrada → filas arrastrables (p. ej. semana anterior del periodo). */
export function carryoverRowsFromSemanaRegistros(
  registros: Array<{
    personal_id: string;
    personal?: Personal | null;
    personal_snapshot?: Partial<Personal> | null;
    estado_asistencia?: string | null;
    es_semana_libre?: boolean | null;
    dias_trabajados?: number | null;
    bono_transporte_pagado?: number | null;
    bonificaciones?: number | null;
    novedad_turno?: string | null;
    novedad_turno_obs?: string | null;
  }>,
  area: string,
): ManualWeekCarryoverRow[] {
  return registros.map((reg) => {
    const snap = (reg.personal_snapshot ?? {}) as Partial<Personal>;
    const pRaw = reg.personal ?? {
      id: reg.personal_id,
      nombre_completo: snap.nombre_completo ?? 'Trabajador',
      cedula: snap.cedula ?? '',
      cargo: snap.cargo ?? '',
      area,
      area_detalle: snap.area_detalle ?? '',
      salario_base: snap.salario_base ?? 0,
      esquema_rotacion: snap.esquema_rotacion ?? 'FIJO_SEMANAL',
      activo: true,
    };
    const estadoAsistencia = (reg.estado_asistencia ||
      (reg.es_semana_libre ? 'libre' : 'trabajada')) as EstadoAsistenciaNomina;
    const diasTrabajados =
      reg.dias_trabajados ?? (estadoAsistencia === 'no_laborado' ? 0 : 7);
    const novedadTurno = parseNovedadTurno(reg.novedad_turno);
    const reposoParsed =
      novedadTurno === 'REPOSO'
        ? parseReposoCondicionFromObs(String(reg.novedad_turno_obs || ''))
        : { novedadTurnoObs: String(reg.novedad_turno_obs || '') };

    return {
      personal: {
        id: pRaw.id,
        area_detalle: pRaw.area_detalle ?? snap.area_detalle ?? '',
      },
      novedadTurno,
      novedadTurnoObs: reposoParsed.novedadTurnoObs,
      reposoCondicion: reposoParsed.reposoCondicion ?? null,
      reposoDiasPagados: reposoParsed.reposoDiasPagados ?? 0,
      reposoCompensacionMonto: reposoParsed.reposoCompensacionMonto ?? 0,
      estadoAsistencia,
      diasTrabajados,
      bonoTransporte: Number(reg.bono_transporte_pagado || 0),
      bonificaciones: Number(reg.bonificaciones || 0),
    };
  });
}

/** Si la semana destino aún no tiene roster, copia desde filas arrastradas. */
export function seedManualWeekIfEmpty(
  area: string,
  weekStart: string,
  rows: ManualWeekCarryoverRow[],
  periodId: string,
): boolean {
  if (readManualWeekRosterEntries(area, weekStart, periodId).length > 0 || !rows.length) {
    return false;
  }
  writeManualWeekRosterEntries(
    area,
    weekStart,
    buildRosterEntriesFromCarryoverRows(rows),
    periodId,
  );
  writeNominaNovedadDraft(
    nominaNovedadDraftKey(area, weekStart, periodId),
    buildCarryoverDraftFromRows(rows),
  );
  return true;
}

/** Entrada por defecto del draft de novedades: novedad ACTIVA, sin reposo, sin bonos. */
export function freshNovedadDraftEntry() {
  return {
    novedadTurno: 'ACTIVO' as const,
    novedadTurnoObs: '',
    reposoCondicion: null as null,
    reposoDiasPagados: 0,
    reposoCompensacionMonto: 0,
    bonoTransporte: 0,
    bonificaciones: 0,
  };
}

/** Vaciar semana: dado un roster, devuelve un draft fresco con todos los IDs en ACTIVO. */
export function resetNovedadDraftForRoster(
  rosterIds: string[],
): NominaWeekDraft {
  const draft: NominaWeekDraft = {};
  const fresh = freshNovedadDraftEntry();
  for (const id of rosterIds) draft[id] = { ...fresh };
  return draft;
}
