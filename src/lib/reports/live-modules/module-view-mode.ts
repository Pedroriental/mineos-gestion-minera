import type { ReportModule } from '@/lib/reports/report-types';

export type ReportPreviewMode = 'tabular' | 'balance-rich' | 'reconciliation-rich';

const LIVE_RICH_MODULES = new Set<ReportModule>(['balance', 'reconciliacion']);

/** Resuelve modo de vista del constructor según módulos seleccionados. */
export function resolvePreviewMode(modules: ReportModule[]): ReportPreviewMode {
  if (modules.length === 1 && modules[0] === 'reconciliacion') return 'reconciliation-rich';
  if (modules.length === 1 && modules[0] === 'balance') return 'balance-rich';
  return 'tabular';
}

export function isLiveModule(mod: ReportModule): boolean {
  return LIVE_RICH_MODULES.has(mod);
}
