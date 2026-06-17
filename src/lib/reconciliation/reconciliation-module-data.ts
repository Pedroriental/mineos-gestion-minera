import type { ModuleReportData } from '@/lib/reports/report-types';
import type { ReconciliationSnapshot } from '@/lib/reconciliation/types';

export {
  parseOperationalFilters as parseReconciliationFiltersFromModule,
} from '@/lib/reports/live-modules/operational-filters';

/** Adapta snapshot de reconciliación al formato tabular del constructor. */
export function buildReconciliationModuleReportData(
  snapshot: ReconciliationSnapshot,
): ModuleReportData {
  const ingresoTotal = snapshot.inputs.ingresoOroUsd + snapshot.inputs.ingresoArenasUsd;
  const gastoTotal = snapshot.inputs.gastoNominaUsd + snapshot.inputs.gastoOperativoUsd;

  const rows = snapshot.rules.map((rule) => ({
    regla: rule.label,
    valor_a: rule.valueA,
    valor_b: rule.valueB,
    desvio_pct: rule.deviationPct,
    estado: rule.status,
    severidad: rule.severity,
    mensaje: rule.message,
    _rule_id: rule.id,
  }));

  const totals: Record<string, number> = {
    oro_real_g: Number(snapshot.macro.realOroG.toFixed(4)),
    margen_real_pct: Number(snapshot.macro.realMargenPct.toFixed(2)),
    ingreso_total_usd: Number(ingresoTotal.toFixed(2)),
    gasto_nomina_usd: Number(snapshot.inputs.gastoNominaUsd.toFixed(2)),
    gasto_operativo_usd: Number(snapshot.inputs.gastoOperativoUsd.toFixed(2)),
    gasto_total_usd: Number(gastoTotal.toFixed(2)),
    rentabilidad_usd: Number((ingresoTotal - gastoTotal).toFixed(2)),
  };

  if (snapshot.rpcDivergence) {
    totals.rpc_ingreso_diff_usd = Number(snapshot.rpcDivergence.ingresoDiffUsd.toFixed(2));
  }
  if (snapshot.balanceOperativoDivergence) {
    totals.operativo_nomina_diff_usd = Number(
      snapshot.balanceOperativoDivergence.nominaDiffUsd.toFixed(2),
    );
    totals.operativo_ingreso_oro_diff_usd = Number(
      snapshot.balanceOperativoDivergence.ingresoOroDiffUsd.toFixed(2),
    );
  }

  return { rows, totals };
}
