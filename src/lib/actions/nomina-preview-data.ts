'use server';

import { createServerClient } from '@/lib/supabase-server';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';
import { dedupeNominaSemanasForAggregation } from '@/lib/nomina/nomina-read-model';

async function resolvePeriodoIdForPreview(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  options?: {
    rangeStart?: string;
    rangeEnd?: string;
    filterArea?: string;
    periodoId?: string;
  },
): Promise<string | undefined> {
  if (options?.periodoId) return options.periodoId;
  let query = supabase
    .from('nomina_periodos')
    .select('id, range_start, range_end, metadata, total_usd, semana_count')
    .order('range_start', { ascending: false });

  const { data: periodos } = await query;
  if (!periodos?.length) return undefined;

  const scoped = periodos.filter((p) => {
    const metaArea = (p.metadata as { area?: string } | null)?.area;
    if (options?.filterArea && typeof metaArea === 'string') {
      return metaArea === options.filterArea;
    }
    return true;
  });

  if (options?.rangeStart && options?.rangeEnd) {
    const exact = scoped.find(
      (p) => p.range_start === options.rangeStart && p.range_end === options.rangeEnd,
    );
    if (exact) return exact.id as string;

    const containing = scoped.find(
      (p) => p.range_start <= options.rangeStart! && p.range_end >= options.rangeEnd!,
    );
    if (containing) return containing.id as string;
  }

  const withData = scoped.filter(
    (p) => Number(p.total_usd) > 0 || Number(p.semana_count) > 0,
  );
  const pick = (withData.length ? withData : scoped)[0];
  return pick?.id as string | undefined;
}

export async function loadNominaVistaPreviaDataAction(options?: {
  rangeStart?: string;
  rangeEnd?: string;
  periodoId?: string;
  filterArea?: string;
}): Promise<{
  ok: boolean;
  personal: Personal[];
  registrosCerrados: NominaRegistroCerrado[];
  semanasCerradas: { semana_inicio: string; semana_fin?: string }[];
  totalRegistrosHistoricos: number;
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const periodoId = await resolvePeriodoIdForPreview(supabase, options);

    let semanasQuery = supabase
      .from('nomina_semanas')
      .select('id, semana_inicio, semana_fin, area, periodo_id')
      .order('semana_inicio', { ascending: false });

    if (options?.filterArea) {
      semanasQuery = semanasQuery.eq('area', options.filterArea);
    }

    if (periodoId) {
      const { data: links } = await supabase
        .from('nomina_periodo_semanas')
        .select('semana_id')
        .eq('periodo_id', periodoId);
      const semanaIds = (links || []).map((l: { semana_id: string }) => l.semana_id);
      if (semanaIds.length > 0) {
        semanasQuery = semanasQuery.in('id', semanaIds);
      } else {
        semanasQuery = semanasQuery.eq('periodo_id', periodoId);
      }
    } else {
      semanasQuery = semanasQuery.neq('origen', 'import_historico');
      if (options?.rangeStart) {
        semanasQuery = semanasQuery.gte('semana_inicio', options.rangeStart);
      }
      if (options?.rangeEnd) {
        semanasQuery = semanasQuery.lte('semana_inicio', options.rangeEnd);
      }
      semanasQuery = semanasQuery.limit(12);
    }

    const { data: semanasRows } = await semanasQuery;

    type SemanaRow = {
      id: string;
      semana_inicio: string;
      semana_fin?: string;
      area: string;
      periodo_id?: string | null;
    };
    const semanasTyped = (semanasRows || []) as SemanaRow[];

    const preferredSemanas = dedupeNominaSemanasForAggregation(semanasTyped, {
      activePeriodoId: periodoId,
    });
    const semanasCerradas = preferredSemanas.map((s) => ({
      semana_inicio: s.semana_inicio,
      semana_fin: s.semana_fin,
    }));

    const { count: totalRegistrosHistoricos } = await supabase
      .from('nomina_registros')
      .select('id', { count: 'exact', head: true });

    const semanaIds = preferredSemanas.map((s) => s.id);
    let registrosCerrados: NominaRegistroCerrado[] = [];
    const personalIdsFromRegistros = new Set<string>();

    if (semanaIds.length) {
      const regQuery = supabase
        .from('nomina_registros')
        .select(
          'personal_id, monto_pagado, es_semana_libre, estado_asistencia, dias_trabajados, salario_base_calculado, novedad_turno, novedad_turno_obs, personal_snapshot, semana_id, periodo_id',
        )
        .in('semana_id', semanaIds);

      const { data: regRows } = await regQuery;

      const semanaById = new Map(preferredSemanas.map((s) => [s.id, s]));

      registrosCerrados = (regRows || [])
        .map(
          (r: {
            personal_id: string;
            monto_pagado: number;
            es_semana_libre: boolean;
            estado_asistencia?: string | null;
            dias_trabajados?: number | null;
            salario_base_calculado?: number | null;
            novedad_turno?: string | null;
            novedad_turno_obs?: string | null;
            personal_snapshot?: import('@/lib/nomina/types').PersonalSnapshot | null;
            semana_id: string;
            periodo_id?: string | null;
          }) => {
            personalIdsFromRegistros.add(r.personal_id);
            const sem = semanaById.get(r.semana_id);
            if (!sem) return null;
            return {
              personal_id: r.personal_id,
              semana_inicio: sem.semana_inicio,
              area: sem.area,
              monto_pagado: Number(r.monto_pagado),
              es_semana_libre: !!r.es_semana_libre,
              estado_asistencia: r.estado_asistencia as
                | 'trabajada'
                | 'libre'
                | 'no_laborado'
                | null
                | undefined,
              dias_trabajados: r.dias_trabajados,
              salario_base_calculado: r.salario_base_calculado,
              novedad_turno: r.novedad_turno,
              novedad_turno_obs: r.novedad_turno_obs,
              personal_snapshot: r.personal_snapshot ?? null,
              periodo_id: r.periodo_id ?? null,
            };
          },
        )
        .filter(Boolean) as NominaRegistroCerrado[];

      const dedupMap = new Map<string, NominaRegistroCerrado>();
      const registroScore = (reg: NominaRegistroCerrado) =>
        (periodoId && reg.periodo_id === periodoId ? 8 : 0) +
        (reg.periodo_id ? 4 : 0) +
        (reg.personal_snapshot ? 2 : 0) +
        (Number(reg.monto_pagado) > 0 ? 1 : 0);

      for (const reg of registrosCerrados) {
        const key = `${reg.personal_id}|${reg.semana_inicio}|${reg.area}`;
        const existing = dedupMap.get(key);
        if (!existing || registroScore(reg) > registroScore(existing)) {
          dedupMap.set(key, reg);
        }
      }
      registrosCerrados = [...dedupMap.values()];
    }

    const { data: personalRows, error: pErr } = await supabase
      .from('personal')
      .select('*')
      .in('area', ['mina', 'planta', 'administracion'])
      .order('nombre_completo');

    if (pErr) {
      return {
        ok: false,
        personal: [],
        registrosCerrados: [],
        semanasCerradas: [],
        totalRegistrosHistoricos: 0,
        message: pErr.message,
      };
    }

    const allPersonal = (personalRows as Personal[]) || [];
    const activePersonal = allPersonal.filter((p) => isPersonalVisibleInNomina(p, p.area));

    const activeIds = new Set(activePersonal.map((p) => p.id));
    const missingIds = [...personalIdsFromRegistros].filter((id) => !activeIds.has(id));

    let historicalPersonal: Personal[] = [];
    if (missingIds.length) {
      const { data: histRows } = await supabase
        .from('personal')
        .select('*')
        .in('id', missingIds);
      historicalPersonal = (histRows as Personal[]) || [];
    }

    const personal = [...activePersonal, ...historicalPersonal];

    return {
      ok: true,
      personal,
      registrosCerrados,
      semanasCerradas,
      totalRegistrosHistoricos: totalRegistrosHistoricos ?? registrosCerrados.length,
    };
  } catch (e) {
    return {
      ok: false,
      personal: [],
      registrosCerrados: [],
      semanasCerradas: [],
      totalRegistrosHistoricos: 0,
      message: e instanceof Error ? e.message : 'Error al cargar vista previa',
    };
  }
}

