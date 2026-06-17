import type { ExecuteReportResult, ReportPayload } from '@/lib/reports/report-types';
import { resolvePreviewMode } from '@/lib/reports/live-modules/module-view-mode';
import { parseOperationalFilters } from '@/lib/reports/live-modules/operational-filters';
import { normalizeBalanceGroupBy } from '@/lib/reconciliation/aggregate-balance';
import {
  fetchBalanceReportAggregated,
  fetchReconciliationSnapshot,
} from '@/lib/actions/reconciliation-actions';
import {
  downloadReportPDF,
  downloadUnifiedReportPDF,
} from '@/lib/reports/report-pdf-generator';
import {
  downloadReportCSV,
  downloadUnifiedReportCSV,
} from '@/lib/reports/report-csv-generator';
import { downloadReconciliationCSV } from '@/lib/reports/reconciliation-export';

function liveOperationalFilters(payload: ReportPayload) {
  return parseOperationalFilters(payload.filters?.reconciliacion);
}

export async function downloadConstructorPDF(
  result: ExecuteReportResult,
  payload: ReportPayload,
): Promise<void> {
  const modules = payload.modules ?? [];
  const mode = resolvePreviewMode(modules);
  const dateRange = { from: payload.dateFrom, to: payload.dateTo };

  if (mode === 'balance-rich' && result.ok) {
    const balance = await fetchBalanceReportAggregated(
      dateRange,
      normalizeBalanceGroupBy(payload.groupBy),
      liveOperationalFilters(payload),
    );
    downloadReportPDF('balance', balance.aggregated, dateRange, payload.groupBy ?? 'semana');
    return;
  }

  await downloadUnifiedReportPDF(result, payload.dateFrom, payload.dateTo, payload.groupBy ?? 'dia');
}

export async function downloadConstructorCSV(
  result: ExecuteReportResult,
  payload: ReportPayload,
): Promise<void> {
  const modules = payload.modules ?? [];
  const mode = resolvePreviewMode(modules);
  const dateRange = { from: payload.dateFrom, to: payload.dateTo };

  if (mode === 'reconciliation-rich' && result.ok) {
    const snapshot = await fetchReconciliationSnapshot(
      dateRange,
      liveOperationalFilters(payload),
    );
    downloadReconciliationCSV(snapshot);
    return;
  }

  if (mode === 'balance-rich' && result.ok) {
    const balance = await fetchBalanceReportAggregated(
      dateRange,
      normalizeBalanceGroupBy(payload.groupBy),
      liveOperationalFilters(payload),
    );
    downloadReportCSV('balance', balance.aggregated, payload.groupBy ?? 'semana');
    return;
  }

  await downloadUnifiedReportCSV(result, payload.groupBy ?? 'dia');
}
