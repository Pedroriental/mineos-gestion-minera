import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** Fila de cierre semanal — registro individual por área. */
export type NominaSemanaRow = {
  id: string;
  semana_inicio: string;
  semana_fin: string;
  area: string | null;
  total_pagado: number | string;
  total_trabajadores?: number | null;
  periodo_id?: string | null;
};

export type NominaPeriodKind = 'day' | 'week' | 'month' | 'range';

export type NominaPeriodBounds = {
  from: string;
  to: string;
  dia?: string | null;
};

/** Filtro de nómina: mes/rango calendario por cierre de semana (`semana_fin`). */
export type NominaSemanasSemanaFinFilter = {
  mode: 'semana_fin';
  semanaFinGte: string;
  semanaFinLte: string;
};

/** Filtro puntual: semana que contiene el día seleccionado. */
export type NominaSemanasContieneDiaFilter = {
  mode: 'contiene_dia';
  semanaInicioLte: string;
  semanaFinGte: string;
};

/** Filtro semanal laboral por inicio de semana. */
export type NominaSemanasSemanaInicioFilter = {
  mode: 'semana_inicio';
  semanaInicioGte: string;
  semanaInicioLte: string;
};

export type NominaSemanasDateFilter =
  | NominaSemanasSemanaFinFilter
  | NominaSemanasContieneDiaFilter
  | NominaSemanasSemanaInicioFilter;

export type NominaAggregationResult = {
  totalUsd: number;
  rowCount: number;
  byArea: Record<string, number>;
  rows: NominaSemanaRow[];
  trabajadoresSum: number;
};

export type DedupeNominaSemanasOptions = {
  activePeriodoId?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function monthBounds(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${pad2(lastDay)}`,
  };
}

function daysBetweenInclusive(from: string, to: string): number {
  const start = parseISO(from);
  const end = parseISO(to);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function isFullCalendarMonth(from: string, to: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false;
  const mes = from.slice(0, 7);
  if (to.slice(0, 7) !== mes) return false;
  const bounds = monthBounds(mes);
  return from === bounds.desde && to === bounds.hasta;
}

/** Infiere granularidad del periodo para elegir eje de filtro de nómina. */
export function inferNominaPeriodKind(
  from: string,
  to: string,
  dia?: string | null,
): NominaPeriodKind {
  if (dia || from === to) return 'day';
  if (daysBetweenInclusive(from, to) <= 7) return 'week';
  if (isFullCalendarMonth(from, to)) return 'month';
  return 'range';
}

/**
 * Construye filtro Supabase para semanas de nómina según reglas de negocio:
 * - día → semana que contiene el día (drill-down; KPI diario = 0)
 * - semana → semana_inicio en rango
 * - mes / rango → semana_fin en rango
 */
export function buildNominaPeriodFilter(
  kind: NominaPeriodKind,
  bounds: NominaPeriodBounds,
): NominaSemanasDateFilter {
  const dia = bounds.dia ?? (bounds.from === bounds.to ? bounds.from : null);

  if (kind === 'day' && dia) {
    return {
      mode: 'contiene_dia',
      semanaInicioLte: dia,
      semanaFinGte: dia,
    };
  }

  if (kind === 'week') {
    return {
      mode: 'semana_inicio',
      semanaInicioGte: bounds.from,
      semanaInicioLte: bounds.to,
    };
  }

  return {
    mode: 'semana_fin',
    semanaFinGte: bounds.from,
    semanaFinLte: bounds.to,
  };
}

export function buildNominaPeriodFilterFromRange(
  from: string,
  to: string,
  dia?: string | null,
): NominaSemanasDateFilter {
  return buildNominaPeriodFilter(inferNominaPeriodKind(from, to, dia), { from, to, dia });
}

/** Compatibilidad con Gastos Resumen (`desde` / `hasta` / `dia`). */
export function buildNominaSemanasDateFilter( period: {
  desde: string;
  hasta: string;
  dia: string | null;
}): NominaSemanasDateFilter {
  const kind = period.dia ? 'day' : inferNominaPeriodKind( period.desde, period.hasta, period.dia);
  return buildNominaPeriodFilter(kind, {
    from: period.desde,
    to: period.hasta,
    dia: period.dia,
  });
}

export function nominaSemanaCierraEnMes(semanaFin: string, mes: string): boolean {
  const bounds = monthBounds(mes);
  return semanaFin >= bounds.desde && semanaFin <= bounds.hasta;
}

export function nominaSemanaDedupKey(semanaInicio: string, area: string | null | undefined): string {
  return `${semanaInicio}|${area ?? ''}`;
}

function semanaScore(row: NominaSemanaRow, options?: DedupeNominaSemanasOptions): number {
  return (
    (options?.activePeriodoId && row.periodo_id === options.activePeriodoId ? 8 : 0) +
    (row.periodo_id ? 4 : 0)
  );
}

/**
 * Dedup solo duplicados reales: misma semana + misma área (operativo vs ciclo manual).
 * Distintas áreas en la misma semana se conservan todas.
 */
export function dedupeNominaSemanasForAggregation<T extends NominaSemanaRow>(
  rows: T[],
  options?: DedupeNominaSemanasOptions,
): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = nominaSemanaDedupKey(row.semana_inicio, row.area);
    const existing = map.get(key);
    if (!existing || semanaScore(row, options) > semanaScore(existing, options)) {
      map.set(key, row);
    }
  }
  return [...map.values()];
}

export function normalizeNominaArea(area: string | null | undefined): string {
  return area?.trim() || 'planta';
}

/** Agrupa filas para reportes mensuales usando fecha de cierre (`semana_fin`). */
export function assignNominaSemanaToMonthKey(semanaFin: string): string {
  return format(parseISO(semanaFin), 'MMMM yyyy', { locale: es });
}

export function aggregateNominaSemanas(
  rows: NominaSemanaRow[],
  options?: DedupeNominaSemanasOptions & { skipDedupe?: boolean },
): NominaAggregationResult {
  const deduped = options?.skipDedupe
    ? rows
    : dedupeNominaSemanasForAggregation(rows, options);

  const byArea: Record<string, number> = {};
  let totalUsd = 0;
  let trabajadoresSum = 0;

  for (const row of deduped) {
    const amount = Number(row.total_pagado) || 0;
    totalUsd += amount;
    trabajadoresSum += Number(row.total_trabajadores) || 0;
    const area = normalizeNominaArea(row.area);
    byArea[area] = (byArea[area] ?? 0) + amount;
  }

  return {
    totalUsd: parseFloat(totalUsd.toFixed(2)),
    rowCount: deduped.length,
    byArea,
    rows: deduped,
    trabajadoresSum,
  };
}

export function sumNominaByArea(
  aggregation: NominaAggregationResult,
  area: string,
): number {
  return aggregation.byArea[area] ?? 0;
}

/** Filtra filas ya cargadas según descriptor de periodo (post-query). */
export function filterNominaSemanasInMemory(
  rows: NominaSemanaRow[],
  filter: NominaSemanasDateFilter,
): NominaSemanaRow[] {
  switch (filter['mode']) {
    case 'semana_fin':
      return rows.filter(
        (r) => r.semana_fin >= filter.semanaFinGte && r.semana_fin <= filter.semanaFinLte,
      );
    case 'semana_inicio':
      return rows.filter(
        (r) =>
          r.semana_inicio >= filter.semanaInicioGte &&
          r.semana_inicio <= filter.semanaInicioLte,
      );
    case 'contiene_dia':
      return rows.filter(
        (r) =>
          r.semana_inicio <= filter.semanaInicioLte && r.semana_fin >= filter.semanaFinGte,
      );
  }
}

export type NominaSemanasConsistencyIssue = {
  semanaId: string;
  semanaInicio: string;
  area: string;
  totalPagado: number;
  registrosSum: number;
  delta: number;
};

/** Compara total_pagado vs Σ registros por semana (reconciliación). */
export function assertNominaSemanasConsistency(
  semanas: NominaSemanaRow[],
  registrosBySemanaId: Map<string, number>,
  tolUsd = 0.01,
): NominaSemanasConsistencyIssue[] {
  const issues: NominaSemanasConsistencyIssue[] = [];
  for (const sem of semanas) {
    const totalPagado = Number(sem.total_pagado) || 0;
    const registrosSum = registrosBySemanaId.get(sem.id) ?? 0;
    const delta = Math.abs(totalPagado - registrosSum);
    if (delta > tolUsd) {
      issues.push({
        semanaId: sem.id,
        semanaInicio: sem.semana_inicio,
        area: normalizeNominaArea(sem.area),
        totalPagado,
        registrosSum,
        delta: parseFloat(delta.toFixed(2)),
      });
    }
  }
  return issues;
}

/** KPI de nómina para periodo: 0 en vista diaria (sin nómina diaria). */
export function nominaKpiTotalForPeriodKind(
  kind: NominaPeriodKind,
  aggregation: NominaAggregationResult,
): number {
  if (kind === 'day') return 0;
  return aggregation.totalUsd;
}

/** Indica si una semana cerrada entra en el rango del reporte/reconciliación. */
export function nominaSemanaInReportRange(
  semana: Pick<NominaSemanaRow, 'semana_inicio' | 'semana_fin'>,
  from: string,
  to: string,
): boolean {
  const kind = inferNominaPeriodKind(from, to);
  if (kind === 'week') {
    return semana.semana_inicio >= from && semana.semana_inicio <= to;
  }
  if (kind === 'day') {
    return semana.semana_inicio <= from && semana.semana_fin >= to;
  }
  return semana.semana_fin >= from && semana.semana_fin <= to;
}
