import type { ColumnFilter, ModuleFilters, ModuleReportData, ReportRow } from '@/lib/reports/report-types';

/** Mapeo filtros UI (balance_diario) → claves de filas del motor en vivo. */
export const BALANCE_FILTER_ROW_KEYS: Record<string, string> = {
  gramos_oro_recuperado_total: 'oro_g',
  precio_oro_usd_gramo: 'precio_oro_usd',
  ingreso_bruto_oro_usd: 'ingreso_oro_usd',
  ingreso_venta_arenas_usd: 'ingreso_arenas_usd',
  ingreso_total_usd: 'ingreso_total_usd',
  gasto_nomina_usd: 'gasto_nomina_usd',
  gasto_insumos_usd: 'gasto_insumos_usd',
  gasto_operativo_usd: 'gasto_operativo_usd',
  gasto_total_usd: 'gasto_total_usd',
  rentabilidad_usd: 'rentabilidad_usd',
  margen_porcentaje: 'margen_pct',
};

const SUMMABLE_BALANCE_TOTAL_KEYS = [
  'oro_g',
  'ingreso_oro_usd',
  'ingreso_arenas_usd',
  'ingreso_total_usd',
  'gasto_nomina_usd',
  'gasto_insumos_usd',
  'gasto_operativo_usd',
  'gasto_total_usd',
  'rentabilidad_usd',
] as const;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeFilterValue(
  raw: string[] | ColumnFilter | string | number | undefined,
): ColumnFilter | string | number | string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) return raw.length > 0 ? { in: raw } : undefined;
  return raw;
}

export function matchesColumnFilter(value: unknown, filter: ColumnFilter | string | number): boolean {
  const num = asNumber(value);

  if (typeof filter === 'string') {
    return String(value ?? '').toLowerCase() === filter.toLowerCase();
  }
  if (typeof filter === 'number') {
    return num === filter;
  }

  if ('in' in filter) {
    const str = String(value ?? '');
    return filter.in.some((item) => item === str);
  }
  if ('regex' in filter) {
    try {
      return new RegExp(filter.regex, 'i').test(String(value ?? ''));
    } catch {
      return false;
    }
  }
  if ('ilike' in filter) {
    const needle = filter.ilike.replace(/%/g, '').toLowerCase();
    return String(value ?? '').toLowerCase().includes(needle);
  }
  if ('eq' in filter) {
    if (num !== null && typeof filter.eq === 'number') return num === filter.eq;
    return String(value ?? '') === String(filter.eq);
  }
  if ('gte' in filter && num !== null) return num >= Number(filter.gte);
  if ('lte' in filter && num !== null) return num <= Number(filter.lte);
  if ('gt' in filter && num !== null) return num > Number(filter.gt);
  if ('lt' in filter && num !== null) return num < Number(filter.lt);

  return true;
}

export function applyModuleFilters(
  rows: ReportRow[],
  filters?: ModuleFilters,
  columnToRowKey: Record<string, string> = BALANCE_FILTER_ROW_KEYS,
): ReportRow[] {
  if (!filters || Object.keys(filters).length === 0) return rows;

  return rows.filter((row) =>
    Object.entries(filters).every(([filterKey, rawFilter]) => {
      if (filterKey === 'fecha') return true;
      const normalized = normalizeFilterValue(rawFilter);
      if (normalized === undefined) return true;
      const rowKey = columnToRowKey[filterKey] ?? filterKey;
      return matchesColumnFilter(row[rowKey], normalized);
    }),
  );
}

function sumRows(rows: ReportRow[], key: string): number {
  return Number(
    rows.reduce((acc, row) => acc + (asNumber(row[key]) ?? 0), 0).toFixed(2),
  );
}

export function recomputeBalanceTotals(rows: ReportRow[]): Record<string, number> {
  const ingresoTotal = sumRows(rows, 'ingreso_total_usd');
  const rentabilidad = sumRows(rows, 'rentabilidad_usd');
  const margenPct =
    ingresoTotal > 0 ? Number(((rentabilidad / ingresoTotal) * 100).toFixed(2)) : 0;

  const totals: Record<string, number> = {
    margen_pct: margenPct,
    rentabilidad_usd: rentabilidad,
    ingreso_total_usd: ingresoTotal,
  };

  for (const key of SUMMABLE_BALANCE_TOTAL_KEYS) {
    if (key === 'rentabilidad_usd' || key === 'ingreso_total_usd') continue;
    totals[key] = sumRows(rows, key);
  }

  if (rows.length > 0) {
    totals.precio_oro_usd = asNumber(rows[0].precio_oro_usd) ?? 0;
  }

  return totals;
}

export function applyBalanceModuleFilters(
  moduleData: ModuleReportData,
  filters?: ModuleFilters,
): ModuleReportData {
  if (!moduleData.rows?.length || !filters || Object.keys(filters).length === 0) {
    return moduleData;
  }

  const filteredRows = applyModuleFilters(moduleData.rows, filters, BALANCE_FILTER_ROW_KEYS);
  return {
    ...moduleData,
    rows: filteredRows,
    totals: recomputeBalanceTotals(filteredRows),
  };
}
