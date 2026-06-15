import type { DateRange, ModuleFilters, ModuleReportData } from '@/lib/reports/report-types';
import type { ReconciliationFilters, ReconciliationSnapshot } from '@/lib/reconciliation/types';
import { fetchReconciliationSnapshot } from '@/lib/actions/reconciliation-actions';
import { buildReconciliationModuleReportData } from '@/lib/reconciliation/reconciliation-module-data';
import { parseOperationalFilters } from '@/lib/reports/live-modules/operational-filters';

export async function fetchReconciliationLive(
  dateRange: DateRange,
  operationalFilters?: ReconciliationFilters,
): Promise<ReconciliationSnapshot> {
  return fetchReconciliationSnapshot(dateRange, operationalFilters);
}

export async function fetchReconciliationLiveModule(
  dateRange: DateRange,
  moduleFilters?: ModuleFilters,
): Promise<ModuleReportData> {
  const filters = parseOperationalFilters(moduleFilters);
  const snapshot = await fetchReconciliationLive(dateRange, filters);
  return buildReconciliationModuleReportData(snapshot);
}
