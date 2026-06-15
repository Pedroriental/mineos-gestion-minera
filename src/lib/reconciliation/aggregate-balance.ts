import type { BalanceReportData } from '@/lib/actions/report-actions';
import type { ModuleReportData, ReportRow } from '@/lib/reports/report-types';
import { computeOperationalInputs } from '@/lib/reconciliation/operational-inputs';
import { assignNominaSemanaToMonthKey } from '@/lib/nomina/nomina-read-model';
import { getWeekRangeLabel, safeFormatDate } from '@/lib/reports/report-date-utils';
import { splitGastoMonto } from '@/lib/reconciliation/gastos-classify';

export type BalanceGroupBy = 'dia' | 'semana' | 'mes' | 'ano';

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
    periodoKey: string;
    grupo: string;
    oroGramos: number;
    ingresosOro: number;
    ingresosArenas: number;
    ingresosTotal: number;
    gastosNomina: number;
    gastosInsumos: number;
    gastosOperativos: number;
    gastosTotal: number;
    rentabilidad: number;
    margenPct: number;
  }[];
}

type GroupStats = {
  oroGramos: number;
  arenasUsd: number;
  gastoNomina: number;
  gastoInsumos: number;
  gastoOperativo: number;
};

function emptyStats(): GroupStats {
  return { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoInsumos: 0, gastoOperativo: 0 };
}

function resolveBalanceGroup(
  groupBy: BalanceGroupBy,
  kind: 'fecha' | 'nomina',
  fields: { fecha?: string; semana_inicio?: string; semana_fin?: string },
): { key: string; label: string } {
  if (kind === 'nomina') {
    const fin = fields.semana_fin ?? fields.semana_inicio ?? '';
    const inicio = fields.semana_inicio ?? fin;
    switch (groupBy) {
      case 'dia':
        return {
          key: fin,
          label: fin ? safeFormatDate(fin, 'dd/MM/yyyy') : '—',
        };
      case 'semana':
        return {
          key: getWeekRangeLabel(inicio),
          label: getWeekRangeLabel(inicio),
        };
      case 'mes': {
        const monthKey = fin ? assignNominaSemanaToMonthKey(fin) : '';
        return {
          key: monthKey,
          label: monthKey ? safeFormatDate(`${monthKey}-01`, 'MMMM yyyy') : '—',
        };
      }
      case 'ano':
        return {
          key: fin ? safeFormatDate(fin, 'yyyy') : '',
          label: fin ? safeFormatDate(fin, 'yyyy') : '—',
        };
    }
  }

  const fecha = fields.fecha ?? '';
  switch (groupBy) {
    case 'dia':
      return { key: fecha, label: safeFormatDate(fecha, 'dd/MM/yyyy') };
    case 'semana':
      return { key: getWeekRangeLabel(fecha), label: getWeekRangeLabel(fecha) };
    case 'mes':
      return {
        key: safeFormatDate(fecha, 'yyyy-MM'),
        label: safeFormatDate(fecha, 'MMMM yyyy'),
      };
    case 'ano':
      return { key: safeFormatDate(fecha, 'yyyy'), label: safeFormatDate(fecha, 'yyyy') };
  }
}

function bumpGroup(
  map: Map<string, GroupStats & { label: string }>,
  group: { key: string; label: string },
  patch: Partial<GroupStats>,
) {
  const current = map.get(group.key) ?? { ...emptyStats(), label: group.label };
  if (patch.oroGramos) current.oroGramos += patch.oroGramos;
  if (patch.arenasUsd) current.arenasUsd += patch.arenasUsd;
  if (patch.gastoNomina) current.gastoNomina += patch.gastoNomina;
  if (patch.gastoInsumos) current.gastoInsumos += patch.gastoInsumos;
  if (patch.gastoOperativo) current.gastoOperativo += patch.gastoOperativo;
  map.set(group.key, current);
}

export function normalizeBalanceGroupBy(value?: string | null): BalanceGroupBy {
  if (value === 'semana' || value === 'mes' || value === 'ano' || value === 'dia') return value;
  return 'dia';
}

/**
 * Balance agrupado para reportes. KPIs del periodo salen del motor (`computeOperationalInputs`);
 * las filas usan el mismo precio oro aplicado en biblioteca/reconciliación.
 */
export function aggregateBalance(
  data: BalanceReportData,
  agruparPor: BalanceGroupBy = 'semana',
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

  const gruposMap = new Map<string, GroupStats & { label: string }>();

  data.produccion.forEach((r) => {
    const group = resolveBalanceGroup(agruparPor, 'fecha', { fecha: r.fecha });
    bumpGroup(gruposMap, group, { oroGramos: Number(r.oro_recuperado_g ?? 0) });
  });

  data.ventasArenas.forEach((v) => {
    const group = resolveBalanceGroup(agruparPor, 'fecha', { fecha: v.fecha });
    bumpGroup(gruposMap, group, { arenasUsd: Number(v.total_venta ?? 0) });
  });

  data.nomina.forEach((n) => {
    const group = resolveBalanceGroup(agruparPor, 'nomina', {
      semana_inicio: n.semana_inicio,
      semana_fin: n.semana_fin,
    });
    bumpGroup(gruposMap, group, { gastoNomina: Number(n.monto_pagado ?? 0) });
  });

  data.gastos.forEach((g) => {
    const group = resolveBalanceGroup(agruparPor, 'fecha', { fecha: g.fecha });
    const split = splitGastoMonto(g);
    bumpGroup(gruposMap, group, {
      gastoInsumos: split.insumos,
      gastoOperativo: split.operativo,
    });
  });

  const rows = Array.from(gruposMap.entries()).map(([periodoKey, stats]) => {
    const ingOro = stats.oroGramos * precioOroUsd;
    const ingTotal = ingOro + stats.arenasUsd;
    const gstInsumos = stats.gastoInsumos;
    const gstOperativos = stats.gastoOperativo;
    const gstTotal = stats.gastoNomina + gstInsumos + gstOperativos;
    const rent = ingTotal - gstTotal;
    const marg = ingTotal > 0 ? (rent / ingTotal) * 100 : 0;

    return {
      periodoKey,
      grupo: stats.label,
      oroGramos: Number(stats.oroGramos.toFixed(4)),
      ingresosOro: Number(ingOro.toFixed(2)),
      ingresosArenas: Number(stats.arenasUsd.toFixed(2)),
      ingresosTotal: Number(ingTotal.toFixed(2)),
      gastosNomina: Number(stats.gastoNomina.toFixed(2)),
      gastosInsumos: Number(gstInsumos.toFixed(2)),
      gastosOperativos: Number(gstOperativos.toFixed(2)),
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
    rows: rows.sort((a, b) => a.periodoKey.localeCompare(b.periodoKey)),
  };
}

/** Filas del constructor universal — mismo motor que `/reportes-balances` (Balance). */
export function buildBalanceModuleReportData(
  data: BalanceReportData,
  groupBy: BalanceGroupBy,
  precioOroUsd: number,
  sacosExtraccion = 0,
  oroQuemadoG = 0,
  nominaSemanasUsd = 0,
): ModuleReportData {
  const summary = aggregateBalance(
    data,
    groupBy,
    precioOroUsd,
    sacosExtraccion,
    oroQuemadoG,
    nominaSemanasUsd,
  );

  const rows: ReportRow[] = summary.rows.map((r) => ({
    periodo: r.periodoKey,
    periodo_label: r.grupo,
    oro_g: r.oroGramos,
    precio_oro_usd: precioOroUsd,
    ingreso_oro_usd: r.ingresosOro,
    ingreso_arenas_usd: r.ingresosArenas,
    ingreso_total_usd: r.ingresosTotal,
    gasto_nomina_usd: r.gastosNomina,
    gasto_insumos_usd: r.gastosInsumos,
    gasto_operativo_usd: r.gastosOperativos,
    gasto_total_usd: r.gastosTotal,
    rentabilidad_usd: r.rentabilidad,
    margen_pct: r.margenPct,
  }));

  return {
    rows,
    totals: {
      oro_g: Number(
        summary.rows.reduce((s, r) => s + r.oroGramos, 0).toFixed(4),
      ),
      ingreso_oro_usd: summary.kpis.ingresoOroUsd,
      ingreso_arenas_usd: summary.kpis.ingresoArenasUsd,
      ingreso_total_usd: summary.kpis.ingresoTotalUsd,
      gasto_nomina_usd: summary.kpis.gastoNominaUsd,
      gasto_insumos_usd: Number(
        summary.rows.reduce((s, r) => s + r.gastosInsumos, 0).toFixed(2),
      ),
      gasto_operativo_usd: Number(
        summary.rows.reduce((s, r) => s + r.gastosOperativos, 0).toFixed(2),
      ),
      gasto_total_usd: summary.kpis.gastoTotalUsd,
      rentabilidad_usd: summary.kpis.rentabilidadUsd,
      margen_pct: summary.kpis.margenRentabilidadPct,
    },
  };
}
