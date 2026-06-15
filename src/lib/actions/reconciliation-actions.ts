'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { loadBibliotecaCompleta, upsertBibliotecaVariableAction } from '@/lib/actions/biblioteca-variables';
import { BIBLIOTECA_FALLBACK_RECONCILIATION } from '@/lib/biblioteca-fallbacks-reconciliation';
import { fetchBalanceReport } from '@/lib/actions/report-actions';
import type { DateRange, ModuleReportData } from '@/lib/reports/report-types';
import { buildReconciliationDrillDown } from '@/lib/reconciliation/drill-down';
import { getProduccionDiaria, getRentabilidad } from '@/lib/rpc/rentabilidad';
import {
  loadReconciliationParamsFromCatalog,
  reconciliationParamsToBibliotecaRows,
} from '@/lib/reconciliation/load-params';
import { validateNominaDivisiones } from '@/lib/reconciliation/nomina-divisiones';
import {
  aggregateBalance,
  buildBalanceModuleReportData,
  normalizeBalanceGroupBy,
  type BalanceSummary,
} from '@/lib/reconciliation/aggregate-balance';
import { computeOperationalInputs } from '@/lib/reconciliation/operational-inputs';
import { buildSnapshot } from '@/lib/reconciliation/reconciliation-engine';
import { buildPrecioOroOrigenUi } from '@/lib/reconciliation/precio-oro-origen';
import type {
  DrillDownRow,
  PrecioOroAplicado,
  ReconciliationFilters,
  ReconciliationParams,
  ReconciliationRawInputs,
  ReconciliationSnapshot,
} from '@/lib/reconciliation/types';
import type { BalanceReportData } from '@/lib/actions/report-actions';
import type { ReporteProduccion } from '@/lib/types';
import {
  fetchNominaSemanasForPeriod,
  getNominaTotalUsdForPeriod,
} from '@/lib/nomina/nomina-read-model.server';

export type ReconciliationActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

async function fetchPrecioOroCacheRow(): Promise<{
  precioUsdPorGramo: number;
  fecha: string | null;
  fuente: string | null;
}> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('precio_oro_cache')
    .select('precio_usd_por_gramo, fecha, fuente')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    precioUsdPorGramo: Number(data?.precio_usd_por_gramo ?? 99.68),
    fecha: data?.fecha ?? null,
    fuente: data?.fuente ?? null,
  };
}

async function fetchPrecioOroCache(): Promise<number> {
  const row = await fetchPrecioOroCacheRow();
  return row.precioUsdPorGramo;
}

async function resolvePrecioOroAplicado(params: ReconciliationParams): Promise<PrecioOroAplicado> {
  if (params.precioOroFuente === 'manual') {
    const fuenteCruda = 'manual';
    return {
      usdPorGramo: params.precioOroManualUsd,
      modo: 'manual',
      fuenteEtiqueta: fuenteCruda,
      origenUi: buildPrecioOroOrigenUi('manual', fuenteCruda),
      fechaCache: null,
    };
  }
  const row = await fetchPrecioOroCacheRow();
  const fuenteCruda = row.fuente?.trim() || '—';
  return {
    usdPorGramo: row.precioUsdPorGramo,
    modo: 'cache',
    fuenteEtiqueta: fuenteCruda,
    origenUi: buildPrecioOroOrigenUi('cache', fuenteCruda),
    fechaCache: row.fecha,
  };
}

async function fetchNominaSemanasTotal(from: string, to: string): Promise<number> {
  const supabase = await createServerClient();
  return getNominaTotalUsdForPeriod(supabase, { from, to });
}

async function fetchNominaSemanasRows(from: string, to: string) {
  const supabase = await createServerClient();
  const rows = await fetchNominaSemanasForPeriod(supabase, { from, to });
  return rows.map((r) => ({
    id: r.id,
    semana_inicio: r.semana_inicio,
    semana_fin: r.semana_fin,
    area: r.area ?? undefined,
    total_pagado: Number(r.total_pagado ?? 0),
  }));
}

async function fetchExtraccionQuemadoRows(from: string, to: string) {
  const supabase = await createServerClient();
  const [ext, quem] = await Promise.all([
    supabase.from('reportes_extraccion').select('fecha, sacos_extraidos, mina').gte('fecha', from).lte('fecha', to),
    supabase.from('reportes_quemado').select('fecha, total_oro_g').gte('fecha', from).lte('fecha', to),
  ]);
  return {
    extraccion: ext.data ?? [],
    quemado: quem.data ?? [],
  };
}

export async function loadCatalogForReconciliation() {
  const db = await loadBibliotecaCompleta();
  if (!db.length) return BIBLIOTECA_FALLBACK_RECONCILIATION;
  const slugs = new Set(db.map((c) => c.slug));
  const extras = BIBLIOTECA_FALLBACK_RECONCILIATION.filter((c) => !slugs.has(c.slug));
  return [...db, ...extras];
}

export async function fetchReconciliationParamsOnly(): Promise<ReconciliationParams> {
  const catalogo = await loadCatalogForReconciliation();
  return loadReconciliationParamsFromCatalog(catalogo);
}

export async function fetchGoldPriceForReports(): Promise<number> {
  const params = await fetchReconciliationParamsOnly();
  const precio = await resolvePrecioOroAplicado(params);
  return precio.usdPorGramo;
}

export type OperationalContext = {
  dateRange: DateRange;
  params: ReconciliationParams;
  precioOro: PrecioOroAplicado;
  balance: BalanceReportData;
  inputs: ReconciliationRawInputs;
  produccion: ReporteProduccion[];
  sacosExtraccion: number;
  oroQuemadoG: number;
  nominaSemanasUsd: number;
};

/** Carga datos del periodo y calcula inputs financieros (única vía para motor y balance). */
export async function gatherOperationalContext(
  dateRange: DateRange,
  filters?: ReconciliationFilters,
  paramsOverride?: Partial<ReconciliationParams>,
): Promise<OperationalContext> {
  const catalogo = await loadCatalogForReconciliation();
  const params = loadReconciliationParamsFromCatalog(catalogo, paramsOverride);

  const balance = await fetchBalanceReport({ dateRange });
  let produccion = balance.produccion;
  if (filters?.molinos?.length) {
    produccion = produccion.filter((p) => filters.molinos!.includes(p.molino));
  }

  const { extraccion, quemado } = await fetchExtraccionQuemadoRows(dateRange.from, dateRange.to);
  const sacosExtraccion = extraccion.reduce((s, r) => s + Number(r.sacos_extraidos ?? 0), 0);
  const oroQuemadoG = quemado.reduce((s, r) => s + Number(r.total_oro_g ?? 0), 0);
  const nominaSemanasUsd = await fetchNominaSemanasTotal(dateRange.from, dateRange.to);
  const precioOro = await resolvePrecioOroAplicado(params);

  const inputs = computeOperationalInputs({
    balance,
    produccion,
    sacosExtraccion,
    oroQuemadoG,
    nominaSemanasUsd,
    precioOroUsd: precioOro.usdPorGramo,
  });

  return {
    dateRange,
    params,
    precioOro,
    balance,
    inputs,
    produccion,
    sacosExtraccion,
    oroQuemadoG,
    nominaSemanasUsd,
  };
}

export type BalanceReportPayload = {
  aggregated: BalanceSummary;
  precioOro: PrecioOroAplicado;
};

/** Reporte Balance: mismos totales y precio oro que Reconciliación. */
export async function fetchBalanceReportAggregated(
  dateRange: DateRange,
  agruparPor: 'semana' | 'mes' = 'semana',
): Promise<BalanceReportPayload> {
  const ctx = await gatherOperationalContext(dateRange);
  const aggregated = aggregateBalance(
    ctx.balance,
    agruparPor,
    ctx.precioOro.usdPorGramo,
    ctx.sacosExtraccion,
    ctx.oroQuemadoG,
    ctx.nominaSemanasUsd,
  );
  return { aggregated, precioOro: ctx.precioOro };
}

/** Constructor universal: balance en vivo (paridad con pestaña Balance / Reconciliación). */
export async function fetchBalanceConstructorModule(
  dateRange: DateRange,
  groupBy?: string | null,
): Promise<ModuleReportData> {
  const ctx = await gatherOperationalContext(dateRange);
  return buildBalanceModuleReportData(
    ctx.balance,
    normalizeBalanceGroupBy(groupBy),
    ctx.precioOro.usdPorGramo,
    ctx.sacosExtraccion,
    ctx.oroQuemadoG,
    ctx.nominaSemanasUsd,
  );
}

export async function fetchReconciliationSnapshot(
  dateRange: DateRange,
  filters?: ReconciliationFilters,
  paramsOverride?: Partial<ReconciliationParams>,
): Promise<ReconciliationSnapshot> {
  const ctx = await gatherOperationalContext(dateRange, filters, paramsOverride);
  const rentabilidadRpc = await getRentabilidad(dateRange.from, dateRange.to);
  return buildSnapshot(dateRange, ctx.params, ctx.inputs, rentabilidadRpc, ctx.precioOro);
}

export async function saveReconciliationParams(
  params: ReconciliationParams,
): Promise<ReconciliationActionResult> {
  try {
    const divCheck = validateNominaDivisiones(params.nominaDivisiones);
    if (!divCheck.ok) {
      return { ok: false, message: divCheck.message ?? 'Reparto de nómina inválido.' };
    }

    const catalogo = await loadCatalogForReconciliation();
    const rows = reconciliationParamsToBibliotecaRows(params);

    for (const row of rows) {
      const cat = catalogo.find((c) => c.slug === row.categoriaSlug);
      if (!cat) continue;
      const existing = cat.variables.find((v) => v.clave === row.clave);
      const res = await upsertBibliotecaVariableAction({
        id: existing?.id,
        categoria_id: cat.id,
        clave: row.clave,
        etiqueta: row.etiqueta,
        valor: row.valor,
        unidad: row.unidad || undefined,
        orden: existing?.orden ?? 0,
        metadata: existing?.metadata ?? {},
      });
      if (!res.ok) return res;
    }

    revalidatePath('/reportes-balances');
    revalidatePath('/plataforma/biblioteca-variables');
    return { ok: true, message: 'Parámetros guardados.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error al guardar parámetros.' };
  }
}

export async function fetchReconciliationDrillDown(
  ruleId: string,
  dateRange: DateRange,
): Promise<DrillDownRow[]> {
  const ctx = await gatherOperationalContext(dateRange);
  const { extraccion, quemado } = await fetchExtraccionQuemadoRows(dateRange.from, dateRange.to);
  const [semanasNomina, prodDiariaRpc, rentabilidadRpc] = await Promise.all([
    fetchNominaSemanasRows(dateRange.from, dateRange.to),
    getProduccionDiaria(dateRange.from, dateRange.to),
    ruleId === 'rpc_divergencia'
      ? getRentabilidad(dateRange.from, dateRange.to)
      : Promise.resolve(null),
  ]);

  return buildReconciliationDrillDown({
    ruleId,
    dateRange,
    params: ctx.params,
    precioOroUsd: ctx.precioOro.usdPorGramo,
    produccion: ctx.produccion,
    extraccion,
    quemado,
    balance: ctx.balance,
    semanasNomina,
    prodDiariaRpc,
    rentabilidadRpc,
    tolNominaPct: ctx.params.tolNominaVsSemanasPct,
    tolRpcPct: ctx.params.tolRpcIngresoPct,
    tolSacosPct: ctx.params.tolSacosMinaPlantaPct,
    tolOroPct: ctx.params.tolOroPlantaQuemadoPct,
  });
}

/** Intenta leer agregados vía RPC (opcional si la migración está aplicada). */
export async function fetchBalanceOperativoRpc(
  dateRange: DateRange,
): Promise<Record<string, unknown> | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('get_balance_operativo', {
    p_desde: dateRange.from,
    p_hasta: dateRange.to,
  });
  if (error) {
    console.warn('[RPC] get_balance_operativo:', error.message);
    return null;
  }
  return (data as Record<string, unknown>) ?? null;
}
