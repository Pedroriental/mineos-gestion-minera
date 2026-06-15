import type { BalanceReportData } from '@/lib/actions/report-actions';
import type { ModuleFilters, ModuleReportData } from '@/lib/reports/report-types';
import type { PrecioOroAplicado } from '@/lib/reconciliation/types';
import {
  aggregateBalance,
  buildBalanceModuleReportData,
  normalizeBalanceGroupBy,
  type BalanceGroupBy,
  type BalanceSummary,
} from '@/lib/reconciliation/aggregate-balance';
import { applyBalanceModuleFilters } from '@/lib/reports/apply-module-filters';

export type BalanceLiveContext = {
  balance: BalanceReportData;
  precioOro: PrecioOroAplicado;
  sacosExtraccion: number;
  oroQuemadoG: number;
  nominaSemanasUsd: number;
};

export type BalanceLiveResult = {
  aggregated: BalanceSummary;
  precioOro: PrecioOroAplicado;
};

/** Agrega balance en vivo a partir de contexto ya cargado (sin I/O). */
export function aggregateBalanceFromContext(
  ctx: BalanceLiveContext,
  groupBy: BalanceGroupBy | string | null = 'semana',
): BalanceLiveResult {
  const normalized = normalizeBalanceGroupBy(groupBy);
  const aggregated = aggregateBalance(
    ctx.balance,
    normalized,
    ctx.precioOro.usdPorGramo,
    ctx.sacosExtraccion,
    ctx.oroQuemadoG,
    ctx.nominaSemanasUsd,
  );
  return { aggregated, precioOro: ctx.precioOro };
}

export function buildBalanceModuleFromContext(
  ctx: BalanceLiveContext,
  groupBy?: string | null,
  balanceFilters?: ModuleFilters,
): ModuleReportData {
  const normalized = normalizeBalanceGroupBy(groupBy);
  const moduleData = buildBalanceModuleReportData(
    ctx.balance,
    normalized,
    ctx.precioOro.usdPorGramo,
    ctx.sacosExtraccion,
    ctx.oroQuemadoG,
    ctx.nominaSemanasUsd,
  );
  return applyBalanceModuleFilters(moduleData, balanceFilters);
}
