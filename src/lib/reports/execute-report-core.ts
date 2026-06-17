import type {
  CrossModuleJoin,
  ExecuteReportResult,
  ModuleFilters,
  ModuleReportData,
  ReportModule,
  ReportPayload,
  ReportRow,
} from '@/lib/reports/report-types';
import { parseReconciliationFiltersFromModule } from '@/lib/reconciliation/reconciliation-module-data';
import type { ReconciliationFilters } from '@/lib/reconciliation/types';

const LIVE_MODULES = new Set<ReportModule>(['balance', 'reconciliacion']);

const RPC_CROSS_MODULES = new Set<ReportModule>([
  'produccion',
  'extraccion',
  'quemado',
  'voladuras',
  'gastos',
  'nomina',
]);

export type ExecuteReportDeps = {
  callRpc: (payload: ReportPayload) => Promise<ExecuteReportResult>;
  fetchBalanceModule: (
    dateRange: { from: string; to: string },
    groupBy?: string | null,
    balanceFilters?: ModuleFilters,
    operationalFilters?: ReconciliationFilters,
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

export function resolveOperationalFilters(payload: ReportPayload): ReconciliationFilters | undefined {
  return parseReconciliationFiltersFromModule(payload.filters?.reconciliacion);
}

export function isCrossModuleJoinActive(cross?: CrossModuleJoin | null): boolean {
  return Boolean(cross?.value?.trim() && (cross.include?.length ?? 0) > 0);
}

export function buildCrossModuleRpcPayload(payload: ReportPayload): ReportPayload | null {
  if (!isCrossModuleJoinActive(payload.crossModuleJoin)) return null;
  const include = (payload.crossModuleJoin!.include ?? []).filter((m) => RPC_CROSS_MODULES.has(m));
  if (include.length === 0) return null;
  return {
    ...payload,
    modules: include,
    crossModuleJoin: {
      type: payload.crossModuleJoin!.type,
      value: payload.crossModuleJoin!.value.trim(),
      include,
    },
  };
}

/** Normaliza respuesta cruzada del RPC (arrays planos) al formato del constructor. */
export function normalizeCrossModuleRpcData(
  data: Record<string, unknown>,
): Record<string, ModuleReportData> {
  const out: Record<string, ModuleReportData> = {};
  for (const [mod, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      out[mod] = { rows: val as ReportRow[] };
      continue;
    }
    if (val && typeof val === 'object') {
      out[mod] = val as ModuleReportData;
    }
  }
  return out;
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
  const operationalFilters = resolveOperationalFilters(payload);

  let data: Record<string, ModuleReportData> = {};

  const crossPayload = buildCrossModuleRpcPayload(payload);
  if (crossPayload) {
    const crossResult = await deps.callRpc(crossPayload);
    data = normalizeCrossModuleRpcData(crossResult.data ?? {});
  } else {
    const rpcPayload = buildExecuteReportRpcPayload(payload);
    if (rpcPayload) {
      const rpcResult = await deps.callRpc(rpcPayload);
      data = { ...(rpcResult.data ?? {}) };
    }
  }

  if (includesBalance) {
    data.balance = await deps.fetchBalanceModule(
      dateRange,
      payload.groupBy,
      payload.filters?.balance,
      operationalFilters,
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
