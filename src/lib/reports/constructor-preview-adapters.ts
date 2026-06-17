import type { BalanceSummary } from '@/lib/reconciliation/aggregate-balance';
import type { ModuleReportData, ReportRow } from '@/lib/reports/report-types';

function num(row: ReportRow, key: string): number {
  const v = row[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Reconstruye BalanceSummary desde filas del constructor (motor en vivo). */
export function balanceSummaryFromModuleData(data: ModuleReportData): BalanceSummary | null {
  if (!data.rows?.length && !data.totals) return null;

  const t = data.totals ?? {};
  const kpis: BalanceSummary['kpis'] = {
    ingresoOroUsd: Number(t.ingreso_oro_usd ?? 0),
    ingresoArenasUsd: Number(t.ingreso_arenas_usd ?? 0),
    ingresoTotalUsd: Number(t.ingreso_total_usd ?? 0),
    gastoNominaUsd: Number(t.gasto_nomina_usd ?? 0),
    gastoOperativoUsd: Number(t.gasto_operativo_usd ?? 0),
    gastoTotalUsd: Number(t.gasto_total_usd ?? 0),
    rentabilidadUsd: Number(t.rentabilidad_usd ?? 0),
    margenRentabilidadPct: Number(t.margen_pct ?? 0),
    costoPorGramoOro: Number(t.costo_por_gramo ?? 0),
  };

  const rows = (data.rows ?? []).map((row) => ({
    periodoKey: String(row.periodo ?? row.periodo_label ?? ''),
    grupo: String(row.periodo_label ?? row.periodo ?? ''),
    oroGramos: num(row, 'oro_g'),
    ingresosOro: num(row, 'ingreso_oro_usd'),
    ingresosArenas: num(row, 'ingreso_arenas_usd'),
    ingresosTotal: num(row, 'ingreso_total_usd'),
    gastosNomina: num(row, 'gasto_nomina_usd'),
    gastosInsumos: num(row, 'gasto_insumos_usd'),
    gastosOperativos: num(row, 'gasto_operativo_usd'),
    gastosTotal: num(row, 'gasto_total_usd'),
    rentabilidad: num(row, 'rentabilidad_usd'),
    margenPct: num(row, 'margen_pct'),
  }));

  return { kpis, rows };
}
