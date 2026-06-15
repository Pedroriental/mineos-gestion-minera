import type {
  ExecuteReportResult,
  ModuleReportData,
  ReportModule,
  ReportPayload,
} from '@/lib/reports/report-types';

export type ExecuteReportDeps = {
  callRpc: (payload: ReportPayload) => Promise<ExecuteReportResult>;
  fetchBalanceModule: (
    dateRange: { from: string; to: string },
    groupBy?: string | null,
  ) => Promise<ModuleReportData>;
};

/** Balance usa motor en vivo; el resto pasa por execute_dynamic_report. */
export function splitReportModules(modules: ReportModule[]): {
  rpcModules: ReportModule[];
  includesBalance: boolean;
} {
  const includesBalance = modules.includes('balance');
  const rpcModules = modules.filter((m) => m !== 'balance');
  return { rpcModules, includesBalance };
}

/** Payload enviado al RPC (sin balance). */
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
  const { includesBalance } = splitReportModules(modules);

  let data: Record<string, ModuleReportData> = {};

  const rpcPayload = buildExecuteReportRpcPayload(payload);
  if (rpcPayload) {
    const rpcResult = await deps.callRpc(rpcPayload);
    data = { ...(rpcResult.data ?? {}) };
  }

  if (includesBalance) {
    data.balance = await deps.fetchBalanceModule(dateRange, payload.groupBy);
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
