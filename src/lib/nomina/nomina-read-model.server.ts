import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aggregateNominaSemanas,
  buildNominaPeriodFilterFromRange,
  dedupeNominaSemanasForAggregation,
  inferNominaPeriodKind,
  nominaKpiTotalForPeriodKind,
  type NominaAggregationResult,
  type NominaSemanaRow,
  type NominaSemanasDateFilter,
} from '@/lib/nomina/nomina-read-model';

export type FetchNominaSemanasOptions = {
  from: string;
  to: string;
  dia?: string | null;
  areas?: string[];
  activePeriodoId?: string;
  excludeImportHistorico?: boolean;
};

type NominaSemanasQuery = ReturnType<
  SupabaseClient['from']
> extends { select: (...args: never[]) => infer Q }
  ? Q
  : never;

export function applyNominaSemanasDateFilter<T extends NominaSemanasQuery>(
  query: T,
  filter: NominaSemanasDateFilter,
): T {
  if (filter['mode'] === 'semana_fin') {
    return query
      .gte('semana_fin', filter.semanaFinGte)
      .lte('semana_fin', filter.semanaFinLte) as T;
  }
  if (filter['mode'] === 'semana_inicio') {
    return query
      .gte('semana_inicio', filter.semanaInicioGte)
      .lte('semana_inicio', filter.semanaInicioLte) as T;
  }
  return query
    .lte('semana_inicio', filter.semanaInicioLte)
    .gte('semana_fin', filter.semanaFinGte) as T;
}

export async function fetchNominaSemanasForPeriod(
  supabase: SupabaseClient,
  options: FetchNominaSemanasOptions,
): Promise<NominaSemanaRow[]> {
  const filter = buildNominaPeriodFilterFromRange(options.from, options.to, options.dia);

  let query = supabase
    .from('nomina_semanas')
    .select('id, semana_inicio, semana_fin, area, total_pagado, total_trabajadores, periodo_id')
    .order('semana_inicio', { ascending: true });

  if (options.excludeImportHistorico) {
    query = query.neq('origen', 'import_historico');
  }
  if (options.areas?.length) {
    query = query.in('area', options.areas);
  }

  query = applyNominaSemanasDateFilter(query, filter);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return dedupeNominaSemanasForAggregation((data ?? []) as NominaSemanaRow[], {
    activePeriodoId: options.activePeriodoId,
  });
}

export async function getNominaAggregationForPeriod(
  supabase: SupabaseClient,
  options: FetchNominaSemanasOptions,
): Promise<NominaAggregationResult & { periodKind: ReturnType<typeof inferNominaPeriodKind> }> {
  const periodKind = inferNominaPeriodKind(options.from, options.to, options.dia);
  const rows = await fetchNominaSemanasForPeriod(supabase, options);
  const aggregation = aggregateNominaSemanas(rows, { skipDedupe: true });
  return {
    ...aggregation,
    totalUsd: nominaKpiTotalForPeriodKind( periodKind, aggregation),
    periodKind,
  };
}

export async function getNominaTotalUsdForPeriod(
  supabase: SupabaseClient,
  options: FetchNominaSemanasOptions,
): Promise<number> {
  const result = await getNominaAggregationForPeriod(supabase, options);
  return result.totalUsd;
}
