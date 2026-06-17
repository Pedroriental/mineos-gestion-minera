/** Clases compartidas — reportes (estética sobria, alineada con reconciliación). */
export const reportesUi = {
  sidebar:
    'reportes-ui__sidebar md:col-span-1 flex w-full min-w-0 flex-col space-y-3 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-4',
  sectionTitle:
    'reportes-ui__section-title text-[10px] font-semibold uppercase tracking-widest text-[var(--mineos-general)]',
  fieldLabel: 'reportes-ui__field-label app-date-range-fields__label text-[11px] font-medium text-[var(--dashboard-text-muted)]',
  input:
    'reportes-ui__input w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-2.5 py-1.5 text-sm text-[var(--dashboard-text)] outline-none focus:border-[color-mix(in_srgb,var(--mineos-general)_40%,var(--dashboard-border))] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--mineos-general)_18%,transparent)]',
  chipBase: 'border px-2 py-0.5 text-[10px] font-medium transition-colors rounded-md',
  chipActive:
    'reportes-ui__filter-chip--active border-[color-mix(in_srgb,var(--mineos-general)_32%,var(--dashboard-border))] bg-[color-mix(in_srgb,var(--mineos-general-soft)_50%,var(--dashboard-card-muted))] text-[var(--mineos-general-bright)]',
  chipInactive:
    'border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] text-[var(--dashboard-text-muted)] hover:border-[color-mix(in_srgb,var(--mineos-general)_20%,var(--dashboard-border))] hover:text-[var(--dashboard-text)]',
  chipPill: 'rounded-full px-2.5',
  previewPanel:
    'reportes-ui__preview rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-4 flex min-h-0 flex-1 flex-col overflow-hidden',
  previewTitle: 'text-sm font-semibold text-[var(--dashboard-text)]',
  exportActions: 'reportes-ui__export-actions mineos-export-actions',
  btnExport: 'reportes-ui__btn-export mineos-export-btn',
  kpiCard:
    'rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-3 py-2.5',
  kpiLabel: 'text-[9px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]',
  kpiValue: 'mt-0.5 text-base font-semibold tabular-nums text-[var(--dashboard-text)]',
  kpiValueAccent: 'mt-0.5 text-base font-semibold tabular-nums text-[var(--mineos-general-bright)]',
  kpiValueSmall: 'mt-1 text-[11px] font-medium tabular-nums text-[var(--dashboard-text-muted)] leading-snug',
  tableWrap: 'overflow-x-auto rounded-lg border border-[var(--dashboard-border)]',
  tableHead:
    'border-b border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] text-[10px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]',
  tableBody: 'divide-y divide-[var(--dashboard-border)] text-[var(--dashboard-text-muted)] text-xs',
  tableRow: 'hover:bg-[color-mix(in_srgb,var(--dashboard-card-muted)_65%,transparent)] transition-colors',
  emptyState:
    'flex h-52 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--dashboard-border)] py-10',
  linkSubtle:
    'inline-flex items-center gap-1.5 rounded-lg border border-[var(--dashboard-border)] bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-[var(--dashboard-text-muted)] transition-colors hover:border-[color-mix(in_srgb,var(--mineos-general)_30%,var(--dashboard-border))] hover:text-[var(--mineos-general-bright)]',
  btnSecondary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--dashboard-border)] bg-transparent px-3 py-1.5 text-[11px] font-medium text-[var(--dashboard-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--dashboard-card-muted)_80%,transparent)] disabled:opacity-40',
  btnExecute:
    'flex w-full items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--mineos-general)_32%,var(--dashboard-border))] bg-[color-mix(in_srgb,var(--mineos-general-soft)_55%,var(--dashboard-card-muted))] px-3 py-2 text-[12px] font-semibold text-[var(--mineos-general-bright)] transition-colors hover:bg-[color-mix(in_srgb,var(--mineos-general-soft)_75%,var(--dashboard-card-muted))] disabled:cursor-not-allowed disabled:opacity-40',
  validationBanner:
    'space-y-1 rounded-lg border border-[color-mix(in_srgb,var(--mineos-general)_25%,var(--dashboard-border))] bg-[color-mix(in_srgb,var(--mineos-general-soft)_35%,var(--dashboard-card-muted))] px-2.5 py-2',
  validationText: 'text-[10px] leading-snug text-[var(--mineos-general-bright)]',
  presetButton:
    'rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--dashboard-border)] hover:bg-[color-mix(in_srgb,var(--dashboard-card-muted)_80%,transparent)]',
  presetTitle: 'text-[11px] text-[var(--dashboard-text)]',
  presetDesc: 'truncate text-[9px] text-[var(--dashboard-text-muted)]',
  metaText: 'text-[10px] text-[var(--dashboard-text-muted)]',
  emptyTitle: 'text-sm font-medium text-[var(--dashboard-text-muted)]',
  emptyHint: 'max-w-[280px] text-center text-xs text-[var(--dashboard-text-muted)] opacity-80',
  inlineError:
    'rounded-lg border border-[color-mix(in_srgb,var(--mineos-expense)_28%,var(--dashboard-border))] bg-[color-mix(in_srgb,var(--mineos-expense-soft)_40%,transparent)] px-3 py-2 text-[11px] text-[var(--mineos-expense)]',
  statusBenefit: 'text-[var(--mineos-benefit)]',
  statusGeneral: 'text-[var(--mineos-general-bright)]',
  statusExpense: 'text-[var(--mineos-expense)]',
  divider: 'border-t border-[var(--dashboard-border)]',
} as const;
