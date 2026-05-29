import { eachDayOfInterval, format, parseISO } from 'date-fns';
import type { BalanceReportData } from '@/lib/actions/report-actions';
import type { DateRange } from '@/lib/reports/report-types';
import type { ProduccionDiariaRow, RentabilidadResult } from '@/lib/rpc/rentabilidad';
import { getWeekRangeLabel } from '@/lib/reports/report-date-utils';
import type { DrillDownRow, ReconciliationParams } from '@/lib/reconciliation/types';
import { getRuleDef } from '@/lib/reconciliation/rules-registry';

type ProduccionRow = { fecha: string; sacos?: number; oro_recuperado_g?: number; toneladas_procesadas?: number; molino?: string };
type ExtraccionRow = { fecha: string; sacos_extraidos?: number; mina?: string };
type QuemadoRow = { fecha: string; total_oro_g?: number };
type NominaSemanaRow = {
  id: string;
  semana_inicio: string;
  semana_fin: string;
  area?: string;
  total_pagado: number;
};
type GastoRow = { fecha: string; monto?: number };
type VentaArenasRow = { fecha: string; total_venta?: number };

export type DrillDownContext = {
  ruleId: string;
  dateRange: DateRange;
  params: ReconciliationParams;
  precioOroUsd: number;
  produccion: ProduccionRow[];
  extraccion: ExtraccionRow[];
  quemado: QuemadoRow[];
  balance: BalanceReportData;
  semanasNomina: NominaSemanaRow[];
  prodDiariaRpc: ProduccionDiariaRow[];
  rentabilidadRpc: RentabilidadResult | null;
  tolNominaPct: number;
  tolRpcPct: number;
  tolSacosPct: number;
  tolOroPct: number;
};

function pctDiff(a: number, b: number): number | null {
  const base = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.round((Math.abs(a - b) / base) * 10000) / 100;
}

function statusFromPct(dev: number | null, tol = 8): DrillDownRow['status'] {
  if (dev == null) return 'insufficient_data';
  if (dev <= tol) return 'ok';
  if (dev <= tol * 2) return 'warning';
  return 'error';
}

function daysInRange(from: string, to: string): string[] {
  try {
    return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map((d) =>
      format(d, 'yyyy-MM-dd'),
    );
  } catch {
    return [];
  }
}

function deepLinkProduccion(fecha: string): string {
  return `/planta/produccion?fecha=${fecha}`;
}

function deepLinkExtraccion(fecha: string): string {
  return `/mina/extraccion?fecha=${fecha}`;
}

function deepLinkCostos(desde: string, hasta: string): string {
  return `/operaciones/costos?desde=${desde}&hasta=${hasta}`;
}

function deepLinkNomina(semanaInicio: string, area?: string): string {
  const base = area === 'planta' ? '/planta/nomina' : '/mina/nomina';
  return `${base}?semana_inicio=${semanaInicio}`;
}

function row(
  partial: Omit<DrillDownRow, 'key'> & { key: string },
  columnA: string,
  columnB: string,
  unitA?: string,
  unitB?: string,
): DrillDownRow {
  return { ...partial, columnA, columnB, unitA, unitB };
}

function formatCell(value: number, unit?: string): string {
  const n = value.toLocaleString('es', { maximumFractionDigits: 2 });
  if (unit === 'USD') return `$${n}`;
  if (unit) return `${n} ${unit}`;
  return n;
}

/** @deprecated Use buildReconciliationDrillDown */
export function buildDailyDrillDown(
  ruleId: string,
  produccion: ProduccionRow[],
  extraccion: ExtraccionRow[],
  quemado: QuemadoRow[],
  dateFrom: string,
  dateTo: string,
): DrillDownRow[] {
  return buildReconciliationDrillDown({
    ruleId,
    dateRange: { from: dateFrom, to: dateTo },
    params: {} as ReconciliationParams,
    precioOroUsd: 0,
    produccion,
    extraccion,
    quemado,
    balance: { produccion: produccion as never[], gastos: [], nomina: [], ventasArenas: [] },
    semanasNomina: [],
    prodDiariaRpc: [],
    rentabilidadRpc: null,
    tolNominaPct: 2,
    tolRpcPct: 3,
    tolSacosPct: 8,
    tolOroPct: 5,
  });
}

function buildDailySacosOro(ctx: DrillDownContext): DrillDownRow[] {
  const { ruleId, dateRange, extraccion, produccion, quemado } = ctx;
  const byDay = new Map<string, { sacosExt: number; sacosProd: number; oroProd: number; oroQuem: number }>();

  const ensure = (fecha: string) => {
    if (!byDay.has(fecha)) {
      byDay.set(fecha, { sacosExt: 0, sacosProd: 0, oroProd: 0, oroQuem: 0 });
    }
    return byDay.get(fecha)!;
  };

  extraccion.forEach((r) => {
    if (r.fecha < dateRange.from || r.fecha > dateRange.to) return;
    ensure(r.fecha).sacosExt += Number(r.sacos_extraidos ?? 0);
  });
  produccion.forEach((r) => {
    if (r.fecha < dateRange.from || r.fecha > dateRange.to) return;
    const d = ensure(r.fecha);
    d.sacosProd += Number(r.sacos ?? 0);
    d.oroProd += Number(r.oro_recuperado_g ?? 0);
  });
  quemado.forEach((r) => {
    if (r.fecha < dateRange.from || r.fecha > dateRange.to) return;
    ensure(r.fecha).oroQuem += Number(r.total_oro_g ?? 0);
  });

  const tol = ruleId === 'sacos_mina_planta' ? ctx.tolSacosPct : ctx.tolOroPct;
  const unit = ruleId === 'sacos_mina_planta' ? 'sacos' : 'g';
  const colA = ruleId === 'sacos_mina_planta' ? 'Sacos mina' : 'Oro planta';
  const colB = ruleId === 'sacos_mina_planta' ? 'Sacos planta' : 'Oro quemado';

  const rows: DrillDownRow[] = daysInRange(dateRange.from, dateRange.to).map((fecha) => {
    const d = byDay.get(fecha) ?? { sacosExt: 0, sacosProd: 0, oroProd: 0, oroQuem: 0 };
    const valueA = ruleId === 'sacos_mina_planta' ? d.sacosExt : d.oroProd;
    const valueB = ruleId === 'sacos_mina_planta' ? d.sacosProd : d.oroQuem;
    const dev = pctDiff(valueA, valueB);
    return row(
      {
        key: fecha,
        label: format(parseISO(fecha), 'dd/MM/yyyy'),
        valueA,
        valueB,
        deviationPct: dev,
        status: statusFromPct(dev, tol),
        fecha,
        deepLink: ruleId === 'sacos_mina_planta' ? deepLinkExtraccion(fecha) : deepLinkProduccion(fecha),
      },
      colA,
      colB,
      unit,
      unit,
    );
  });

  return rows.sort((a, b) => Math.abs(b.deviationPct ?? 0) - Math.abs(a.deviationPct ?? 0));
}

function buildNominaSemanas(ctx: DrillDownContext): DrillDownRow[] {
  const { balance, semanasNomina, dateRange, tolNominaPct } = ctx;
  const registrosBySemana = new Map<string, number>();

  balance.nomina.forEach((n) => {
    const cur = registrosBySemana.get(n.semana_id) ?? 0;
    registrosBySemana.set(n.semana_id, cur + Number(n.monto_pagado ?? 0));
  });

  const semanaMap = new Map(semanasNomina.map((s) => [s.id, s]));
  const weekIds = new Set([
    ...semanasNomina.map((s) => s.id),
    ...balance.nomina.map((n) => n.semana_id),
  ]);

  const rows: DrillDownRow[] = [];

  for (const semanaId of weekIds) {
    const sem = semanaMap.get(semanaId);
    const valueA = registrosBySemana.get(semanaId) ?? 0;
    const valueB = Number(sem?.total_pagado ?? 0);
    if (!sem && valueA === 0 && valueB === 0) continue;

    const inicio = sem?.semana_inicio ?? balance.nomina.find((n) => n.semana_id === semanaId)?.semana_inicio;
    if (inicio && (inicio < dateRange.from || inicio > dateRange.to)) continue;

    const label = sem
      ? `${format(parseISO(sem.semana_inicio), 'dd/MM')} – ${format(parseISO(sem.semana_fin), 'dd/MM/yyyy')}${sem.area ? ` (${sem.area})` : ''}`
      : `Semana ${semanaId.slice(0, 8)}…`;

    const dev = pctDiff(valueA, valueB);
    rows.push(
      row(
        {
          key: semanaId,
          label,
          valueA,
          valueB,
          deviationPct: dev,
          status: statusFromPct(dev, tolNominaPct),
          fecha: inicio,
          deepLink: inicio ? deepLinkNomina(inicio, sem?.area) : undefined,
        },
        'Σ registros',
        'Σ semana cerrada',
        'USD',
        'USD',
      ),
    );
  }

  if (rows.length === 0) {
    const totalA = balance.nomina.reduce((s, r) => s + Number(r.monto_pagado ?? 0), 0);
    const totalB = semanasNomina.reduce((s, r) => s + Number(r.total_pagado ?? 0), 0);
    const dev = pctDiff(totalA, totalB);
    rows.push(
      row(
        {
          key: 'periodo',
          label: 'Periodo completo',
          valueA: totalA,
          valueB: totalB,
          deviationPct: dev,
          status: statusFromPct(dev, tolNominaPct),
          deepLink: deepLinkNomina(dateRange.from),
        },
        'Σ registros',
        'Σ semanas',
        'USD',
        'USD',
      ),
    );
  }

  return rows.sort((a, b) => Math.abs(b.deviationPct ?? 0) - Math.abs(a.deviationPct ?? 0));
}

function buildRpcDiaria(ctx: DrillDownContext): DrillDownRow[] {
  const { dateRange, precioOroUsd, prodDiariaRpc, rentabilidadRpc, balance, tolRpcPct } = ctx;
  if (!rentabilidadRpc) return [];

  const arenasByDay = new Map<string, number>();
  (balance.ventasArenas as VentaArenasRow[]).forEach((v) => {
    if (v.fecha < dateRange.from || v.fecha > dateRange.to) return;
    arenasByDay.set(v.fecha, (arenasByDay.get(v.fecha) ?? 0) + Number(v.total_venta ?? 0));
  });

  const motorByDay = new Map<string, number>();
  prodDiariaRpc.forEach((p) => {
    if (p.fecha < dateRange.from || p.fecha > dateRange.to) return;
    const ing = Number(p.oro_g ?? 0) * precioOroUsd + (arenasByDay.get(p.fecha) ?? 0);
    motorByDay.set(p.fecha, ing);
  });

  daysInRange(dateRange.from, dateRange.to).forEach((fecha) => {
    if (!motorByDay.has(fecha)) {
      const prod = ctx.produccion.find((p) => p.fecha === fecha);
      const oro = Number(prod?.oro_recuperado_g ?? 0);
      motorByDay.set(fecha, oro * precioOroUsd + (arenasByDay.get(fecha) ?? 0));
    }
  });

  const motorTotal = [...motorByDay.values()].reduce((s, v) => s + v, 0);
  const rpcTotal = rentabilidadRpc.ingreso_bruto_usd;

  const rows: DrillDownRow[] = daysInRange(dateRange.from, dateRange.to).map((fecha) => {
    const valueA = motorByDay.get(fecha) ?? 0;
    const share = motorTotal > 0 ? valueA / motorTotal : 0;
    const valueB = parseFloat((rpcTotal * share).toFixed(2));
    const dev = pctDiff(valueA, valueB);
    return row(
      {
        key: fecha,
        label: format(parseISO(fecha), 'dd/MM/yyyy'),
        valueA,
        valueB,
        deviationPct: dev,
        status: statusFromPct(dev, tolRpcPct),
        fecha,
        deepLink: deepLinkCostos(fecha, fecha),
      },
      'Ingreso motor',
      'Ingreso RPC (prorrata)',
      'USD',
      'USD',
    );
  });

  const filtered = rows.filter((r) => r.valueA > 0 || r.valueB > 0);
  if (filtered.length === 0) {
    const dev = pctDiff(motorTotal, rpcTotal);
    filtered.push(
      row(
        {
          key: 'periodo',
          label: 'Periodo completo',
          valueA: motorTotal,
          valueB: rpcTotal,
          deviationPct: dev,
          status: statusFromPct(dev, tolRpcPct),
          deepLink: deepLinkCostos(dateRange.from, dateRange.to),
        },
        'Ingreso motor',
        'Ingreso RPC',
        'USD',
        'USD',
      ),
    );
  }

  return filtered.sort((a, b) => Math.abs(b.deviationPct ?? 0) - Math.abs(a.deviationPct ?? 0));
}

function buildWeeklyFinancial(ctx: DrillDownContext, mode: 'utilidad' | 'margen'): DrillDownRow[] {
  const { balance, dateRange, params, precioOroUsd } = ctx;
  const grupos = new Map<
    string,
    { oroG: number; arenas: number; nomina: number; gastos: number; inicio?: string }
  >();

  const touch = (grupo: string, inicio: string) => {
    if (!grupos.has(grupo)) grupos.set(grupo, { oroG: 0, arenas: 0, nomina: 0, gastos: 0, inicio });
    const g = grupos.get(grupo)!;
    if (!g.inicio || inicio < g.inicio) g.inicio = inicio;
  };

  balance.produccion.forEach((r) => {
    const g = getWeekRangeLabel(r.fecha);
    touch(g, r.fecha);
    grupos.get(g)!.oroG += Number(r.oro_recuperado_g ?? 0);
  });
  (balance.ventasArenas as VentaArenasRow[]).forEach((v) => {
    const g = getWeekRangeLabel(v.fecha);
    touch(g, v.fecha);
    grupos.get(g)!.arenas += Number(v.total_venta ?? 0);
  });
  balance.nomina.forEach((n) => {
    const g = getWeekRangeLabel(n.semana_inicio);
    touch(g, n.semana_inicio);
    grupos.get(g)!.nomina += Number(n.monto_pagado ?? 0);
  });
  (balance.gastos as GastoRow[]).forEach((gasto) => {
    const g = getWeekRangeLabel(gasto.fecha);
    touch(g, gasto.fecha);
    grupos.get(g)!.gastos += Number(gasto.monto ?? 0);
  });

  const rows: DrillDownRow[] = [];

  for (const [grupo, stats] of grupos.entries()) {
    const ingreso = stats.oroG * precioOroUsd + stats.arenas;
    const gasto = stats.nomina + stats.gastos;
    const utilidad = ingreso - gasto;
    const margen = ingreso > 0 ? (utilidad / ingreso) * 100 : 0;

    if (mode === 'utilidad') {
      rows.push(
        row(
          {
            key: grupo,
            label: grupo,
            valueA: parseFloat(utilidad.toFixed(2)),
            valueB: params.metaUtilidadMinUsd,
            deviationPct: null,
            status: utilidad >= params.metaUtilidadMinUsd ? 'ok' : utilidad >= params.metaUtilidadMinUsd * 0.9 ? 'warning' : 'error',
            fecha: stats.inicio,
            deepLink: stats.inicio
              ? deepLinkCostos(stats.inicio, stats.inicio)
              : deepLinkCostos(dateRange.from, dateRange.to),
          },
          'Utilidad',
          'Mínimo meta',
          'USD',
          'USD',
        ),
      );
    } else {
      rows.push(
        row(
          {
            key: grupo,
            label: grupo,
            valueA: parseFloat(margen.toFixed(2)),
            valueB: params.metaMargenPct,
            deviationPct: null,
            status: margen >= params.metaMargenPct ? 'ok' : margen >= params.metaMargenPct * 0.9 ? 'warning' : 'error',
            fecha: stats.inicio,
            deepLink: deepLinkCostos(dateRange.from, dateRange.to),
          },
          'Margen %',
          'Meta %',
          '%',
          '%',
        ),
      );
    }
  }

  return rows;
}

function buildRecoveryDiaria(ctx: DrillDownContext): DrillDownRow[] {
  const { produccion, params, dateRange } = ctx;
  const byDay = new Map<string, { oro: number; ton: number }>();

  produccion.forEach((r) => {
    if (r.fecha < dateRange.from || r.fecha > dateRange.to) return;
    const d = byDay.get(r.fecha) ?? { oro: 0, ton: 0 };
    d.oro += Number(r.oro_recuperado_g ?? 0);
    d.ton += Number(r.toneladas_procesadas ?? 0);
    byDay.set(r.fecha, d);
  });

  const totalOro = [...byDay.values()].reduce((s, d) => s + d.oro, 0);
  const totalTon = [...byDay.values()].reduce((s, d) => s + d.ton, 0);
  const leyPeriodo = totalTon > 0 ? totalOro / totalTon : 0;

  const rows: DrillDownRow[] = [];
  for (const [fecha, d] of byDay.entries()) {
    const oroEsperado = d.ton * leyPeriodo;
    const recoveryReal =
      oroEsperado > 0 ? Math.min(100, (d.oro / oroEsperado) * 100) : 0;

    rows.push(
      row(
        {
          key: fecha,
          label: format(parseISO(fecha), 'dd/MM/yyyy'),
          valueA: parseFloat(recoveryReal.toFixed(2)),
          valueB: params.metaRecoveryPct,
          deviationPct: null,
          status:
            recoveryReal >= params.metaRecoveryPct
              ? 'ok'
              : recoveryReal >= params.metaRecoveryPct * 0.9
                ? 'warning'
                : 'error',
          fecha,
          deepLink: deepLinkProduccion(fecha),
        },
        'Recovery día',
        'Meta %',
        '%',
        '%',
      ),
    );
  }

  if (rows.length === 0) {
    rows.push(
      row(
        {
          key: 'sin-datos',
          label: 'Sin producción en el periodo',
          valueA: 0,
          valueB: params.metaRecoveryPct,
          deviationPct: null,
          status: 'insufficient_data',
          deepLink: deepLinkProduccion(dateRange.from),
        },
        'Recovery',
        'Meta %',
        '%',
        '%',
      ),
    );
  }

  return rows.sort((a, b) => b.valueA - a.valueA);
}

function buildCostoGramoDiaria(ctx: DrillDownContext): DrillDownRow[] {
  const { balance, produccion, dateRange, params, precioOroUsd } = ctx;
  if (params.metaCostoPorGramoUsd <= 0) {
    return [
      row(
        {
          key: 'meta-off',
          label: 'Meta no configurada',
          valueA: 0,
          valueB: 0,
          deviationPct: null,
          status: 'ok',
          deepLink: '/plataforma/biblioteca-variables',
        },
        'Costo/g',
        'Meta',
        'USD/g',
        'USD/g',
      ),
    ];
  }

  const gastosByDay = new Map<string, number>();
  (balance.gastos as GastoRow[]).forEach((g) => {
    if (g.fecha < dateRange.from || g.fecha > dateRange.to) return;
    gastosByDay.set(g.fecha, (gastosByDay.get(g.fecha) ?? 0) + Number(g.monto ?? 0));
  });

  const oroByDay = new Map<string, number>();
  produccion.forEach((r) => {
    if (r.fecha < dateRange.from || r.fecha > dateRange.to) return;
    oroByDay.set(r.fecha, (oroByDay.get(r.fecha) ?? 0) + Number(r.oro_recuperado_g ?? 0));
  });

  const nominaTotal = balance.nomina.reduce((s, n) => s + Number(n.monto_pagado ?? 0), 0);
  const days = daysInRange(dateRange.from, dateRange.to);
  const nominaPerDay = days.length > 0 ? nominaTotal / days.length : 0;

  const rows: DrillDownRow[] = days
    .map((fecha) => {
      const oro = oroByDay.get(fecha) ?? 0;
      const gasto = (gastosByDay.get(fecha) ?? 0) + nominaPerDay;
      const costoG = oro > 0 ? gasto / oro : 0;
      const dev = costoG - params.metaCostoPorGramoUsd;
      return row(
        {
          key: fecha,
          label: format(parseISO(fecha), 'dd/MM/yyyy'),
          valueA: parseFloat(costoG.toFixed(2)),
          valueB: params.metaCostoPorGramoUsd,
          deviationPct: null,
          status:
            costoG <= params.metaCostoPorGramoUsd
              ? 'ok'
              : costoG <= params.metaCostoPorGramoUsd * 1.1
                ? 'warning'
                : 'error',
          fecha,
          deepLink: deepLinkCostos(fecha, fecha),
        },
        'Costo/g día',
        'Meta máx.',
        'USD/g',
        'USD/g',
      );
    })
    .filter((r) => r.valueA > 0 || r.valueB > 0);

  return rows.sort((a, b) => b.valueA - a.valueA);
}

export function buildReconciliationDrillDown(ctx: DrillDownContext): DrillDownRow[] {
  const def = getRuleDef(ctx.ruleId);
  if (!def) return [];

  let rows: DrillDownRow[] = [];

  switch (ctx.ruleId) {
    case 'sacos_mina_planta':
    case 'oro_planta_quemado':
      rows = buildDailySacosOro(ctx);
      break;
    case 'nomina_registros_semanas':
      rows = buildNominaSemanas(ctx);
      break;
    case 'rpc_divergencia':
      rows = buildRpcDiaria(ctx);
      break;
    case 'ingreso_vs_gastos':
      rows = buildWeeklyFinancial(ctx, 'utilidad');
      break;
    case 'margen_meta':
      rows = buildWeeklyFinancial(ctx, 'margen');
      break;
    case 'recovery_ley':
      rows = buildRecoveryDiaria(ctx);
      break;
    case 'costo_por_gramo':
      rows = buildCostoGramoDiaria(ctx);
      break;
    default:
      rows = [];
  }

  if (rows.length === 0) {
    rows = [
      row(
        {
          key: 'periodo',
          label: 'Sin desglose granular',
          valueA: 0,
          valueB: 0,
          deviationPct: null,
          status: 'insufficient_data',
          deepLink: buildPeriodDeepLink(ctx.ruleId, ctx.dateRange.from, ctx.dateRange.to),
        },
        'Valor A',
        'Valor B',
      ),
    ];
  }

  return rows;
}

export function buildPeriodDeepLink(ruleId: string, from: string, to: string): string {
  if (ruleId === 'nomina_registros_semanas') {
    return deepLinkNomina(from);
  }
  if (ruleId === 'margen_meta' || ruleId === 'ingreso_vs_gastos' || ruleId === 'rpc_divergencia') {
    return deepLinkCostos(from, to);
  }
  if (ruleId === 'sacos_mina_planta') {
    return deepLinkExtraccion(from);
  }
  if (ruleId === 'oro_planta_quemado') {
    return deepLinkProduccion(from);
  }
  return `/operaciones/resumen?desde=${from}&hasta=${to}`;
}

export { formatCell };
