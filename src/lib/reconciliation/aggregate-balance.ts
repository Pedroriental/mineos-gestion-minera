import type { BalanceReportData } from '@/lib/actions/report-actions';
import { computeOperationalInputs } from '@/lib/reconciliation/operational-inputs';
import { assignNominaSemanaToMonthKey } from '@/lib/nomina/nomina-read-model';
import { getWeekRangeLabel, safeFormatDate } from '@/lib/reports/report-date-utils';

export interface BalanceSummary {
  kpis: {
    ingresoOroUsd: number;
    ingresoArenasUsd: number;
    ingresoTotalUsd: number;
    gastoNominaUsd: number;
    gastoOperativoUsd: number;
    gastoTotalUsd: number;
    rentabilidadUsd: number;
    margenRentabilidadPct: number;
    costoPorGramoOro: number;
  };
  rows: {
    grupo: string;
    ingresosOro: number;
    ingresosArenas: number;
    ingresosTotal: number;
    gastosNomina: number;
    gastosOperativos: number;
    gastosTotal: number;
    rentabilidad: number;
    margenPct: number;
  }[];
}

/**
 * Balance agrupado para reportes. KPIs del periodo salen del motor (`buildRawInputs`);
 * las filas usan el mismo precio oro aplicado en biblioteca/reconciliación.
 */
export function aggregateBalance(
  data: BalanceReportData,
  agruparPor: 'semana' | 'mes' = 'semana',
  precioOroUsd: number,
  sacosExtraccion = 0,
  oroQuemadoG = 0,
  nominaSemanasUsd = 0,
): BalanceSummary {
  const inputs = computeOperationalInputs({
    balance: data,
    produccion: data.produccion,
    sacosExtraccion,
    oroQuemadoG,
    nominaSemanasUsd,
    precioOroUsd,
  });

  const ingresoTotalUsd = inputs.ingresoOroUsd + inputs.ingresoArenasUsd;
  const gastoTotalUsd = inputs.gastoNominaUsd + inputs.gastoOperativoUsd;

  const gruposMap = new Map<
    string,
    { oroGramos: number; arenasUsd: number; gastoNomina: number; gastoOperativo: number }
  >();

  data.produccion.forEach((r) => {
    const grupo = agruparPor === 'semana' ? getWeekRangeLabel(r.fecha) : safeFormatDate(r.fecha, 'MMMM yyyy');
    const current = gruposMap.get(grupo) || { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoOperativo: 0 };
    current.oroGramos += Number(r.oro_recuperado_g ?? 0);
    gruposMap.set(grupo, current);
  });

  data.ventasArenas.forEach((v) => {
    const grupo = agruparPor === 'semana' ? getWeekRangeLabel(v.fecha) : safeFormatDate(v.fecha, 'MMMM yyyy');
    const current = gruposMap.get(grupo) || { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoOperativo: 0 };
    current.arenasUsd += Number(v.total_venta ?? 0);
    gruposMap.set(grupo, current);
  });

  data.nomina.forEach((n) => {
    const grupo =
      agruparPor === 'semana'
        ? getWeekRangeLabel(n.semana_inicio)
        : assignNominaSemanaToMonthKey(n.semana_fin);
    const current = gruposMap.get(grupo) || { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoOperativo: 0 };
    current.gastoNomina += Number(n.monto_pagado ?? 0);
    gruposMap.set(grupo, current);
  });

  data.gastos.forEach((g) => {
    const grupo = agruparPor === 'semana' ? getWeekRangeLabel(g.fecha) : safeFormatDate(g.fecha, 'MMMM yyyy');
    const current = gruposMap.get(grupo) || { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoOperativo: 0 };
    current.gastoOperativo += Number(g.monto ?? 0);
    gruposMap.set(grupo, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupo, stats]) => {
    const ingOro = stats.oroGramos * precioOroUsd;
    const ingTotal = ingOro + stats.arenasUsd;
    const gstTotal = stats.gastoNomina + stats.gastoOperativo;
    const rent = ingTotal - gstTotal;
    const marg = ingTotal > 0 ? (rent / ingTotal) * 100 : 0;

    return {
      grupo,
      ingresosOro: Number(ingOro.toFixed(2)),
      ingresosArenas: Number(stats.arenasUsd.toFixed(2)),
      ingresosTotal: Number(ingTotal.toFixed(2)),
      gastosNomina: Number(stats.gastoNomina.toFixed(2)),
      gastosOperativos: Number(stats.gastoOperativo.toFixed(2)),
      gastosTotal: Number(gstTotal.toFixed(2)),
      rentabilidad: Number(rent.toFixed(2)),
      margenPct: Number(marg.toFixed(2)),
    };
  });

  return {
    kpis: {
      ingresoOroUsd: Number(inputs.ingresoOroUsd.toFixed(2)),
      ingresoArenasUsd: Number(inputs.ingresoArenasUsd.toFixed(2)),
      ingresoTotalUsd: Number(ingresoTotalUsd.toFixed(2)),
      gastoNominaUsd: Number(inputs.gastoNominaUsd.toFixed(2)),
      gastoOperativoUsd: Number(inputs.gastoOperativoUsd.toFixed(2)),
      gastoTotalUsd: Number(gastoTotalUsd.toFixed(2)),
      rentabilidadUsd: Number((ingresoTotalUsd - gastoTotalUsd).toFixed(2)),
      margenRentabilidadPct: Number(inputs.margenPct.toFixed(2)),
      costoPorGramoOro: Number(inputs.costoPorGramo.toFixed(2)),
    },
    rows: rows.sort((a, b) => a.grupo.localeCompare(b.grupo)),
  };
}
