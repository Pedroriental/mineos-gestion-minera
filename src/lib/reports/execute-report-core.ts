import type {
  ExecuteReportResult,
  ModuleFilters,
  ModuleReportData,
  ReportModule,
  ReportPayload,
} from '@/lib/reports/report-types';

const LIVE_MODULES = new Set<ReportModule>(['balance', 'reconciliacion']);

export type ExecuteReportDeps = {
  callRpc: (payload: ReportPayload) => Promise<ExecuteReportResult>;
  fetchBalanceModule: (
    dateRange: { from: string; to: string },
    groupBy?: string | null,
    balanceFilters?: ModuleFilters,
  ) => Promise<ModuleReportData>;
  fetchReconciliationModule: (
    dateRange: { from: string; to: string },
    reconciliationFilters?: ModuleFilters,
  ) => Promise<ModuleReportData>;
};

/** Balance y reconciliación usan motor en vivo; el resto pasa por execute_dynamic_report. */
export function splitReportModules(modules: ReportModule[]): {
  rpcModules: ReportModule[];
  includesBalance: boolean;
  includesReconciliacion: boolean;
} {
  const includesBalance = modules.includes('balance');
  const includesReconciliacion = modules.includes('reconciliacion');
  const rpcModules = modules.filter((m) => !LIVE_MODULES.has(m));
  return { rpcModules, includesBalance, includesReconciliacion };
}

/** Payload enviado al RPC (sin módulos en vivo). */
export function buildExecuteReportRpcPayload(payload: ReportPayload): ReportPayload | null {
  const { rpcModules } = splitReportModules(payload.modules ?? []);
  if (rpcModules.length === 0) return null;
  return { ...payload, modules: rpcModules };
}

/**
 * Eje de fecha para nómina en execute_dynamic_report (migration_dynamic_report_rpc.sql).
 * Debe alinearse con nomina_semanas_deduped_in_range(..., p_use_semana_fin).
 */
export function resolveNominaRpcUsesSemanaFin(
  dateFrom: string,
  dateTo: string,
  groupBy?: string | null,
): boolean {
  const group = groupBy ?? 'mes';
  if (group === 'mes' || group === 'ano' || group === 'dia') return true;
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return spanDays > 7;
}

export async function runExecuteReport(
  deps: ExecuteReportDeps,
  payload: ReportPayload,
): Promise<ExecuteReportResult> {
  const modules = payload.modules ?? [];
  const dateRange = { from: payload.dateFrom, to: payload.dateTo };
  const { includesBalance, includesReconciliacion } = splitReportModules(modules);

  let data: Record<string, ModuleReportData> = {};

  const rpcPayload = buildExecuteReportRpcPayload(payload);
  if (rpcPayload) {
    const rpcResult = await deps.callRpc(rpcPayload);
    data = { ...(rpcResult.data ?? {}) };
  }

  if (includesBalance) {
    data.balance = await deps.fetchBalanceModule(
      dateRange,
      payload.groupBy,
      payload.filters?.balance,
    );
  }

  if (includesReconciliacion) {
    data.reconciliacion = await deps.fetchReconciliationModule(
      dateRange,
      payload.filters?.reconciliacion,
    );
  }

  return {
    ok: true,
    dateRange,
    groupBy: payload.groupBy,
    crossModule: payload.crossModuleJoin ?? undefined,
    modules,
    data,
  };
}
