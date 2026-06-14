import type { BalanceReportData } from '@/lib/actions/report-actions';
import type { ReporteProduccion } from '@/lib/types';
import { buildRawInputs } from '@/lib/reconciliation/reconciliation-engine';
import type { ReconciliationRawInputs } from '@/lib/reconciliation/types';

/** Totales operativos + financieros del periodo — única fuente para motor y reportes. */
export function computeOperationalInputs(opts: {
  balance: BalanceReportData;
  produccion: ReporteProduccion[];
  sacosExtraccion: number;
  oroQuemadoG: number;
  nominaSemanasUsd: number;
  precioOroUsd: number;
}): ReconciliationRawInputs {
  const { balance, produccion, sacosExtraccion, oroQuemadoG, nominaSemanasUsd, precioOroUsd } =
    opts;

  const sacosProduccion = produccion.reduce((s, r) => s + Number(r.sacos ?? 0), 0);
  const oroPlantaG = produccion.reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);
  const tonProcesadas = produccion.reduce((s, r) => s + Number(r.toneladas_procesadas ?? 0), 0);
  const nominaRegistrosUsd = balance.nomina.reduce((s, r) => s + Number(r.monto_pagado ?? 0), 0);
  const gastoNominaUsd = nominaSemanasUsd > 0 ? nominaSemanasUsd : nominaRegistrosUsd;
  const gastoOperativoUsd = balance.gastos.reduce((s, r) => s + Number(r.monto ?? 0), 0);
  const ingresoArenasUsd = balance.ventasArenas.reduce((s, v) => s + Number(v.total_venta ?? 0), 0);

  return buildRawInputs({
    sacosExtraccion,
    sacosProduccion,
    oroPlantaG,
    oroQuemadoG,
    tonProcesadas,
    ingresoArenasUsd,
    gastoNominaUsd,
    gastoOperativoUsd,
    nominaRegistrosUsd,
    nominaSemanasUsd,
    precioOroUsd,
  });
}
