/** Clases compartidas — reportes (estética sobria, alineada con reconciliación). */
export const reportesUi = {
  sidebar: 'lg:col-span-1 space-y-3 rounded-lg border border-white/5 bg-zinc-900/20 p-4',
  sectionTitle: 'text-[10px] font-semibold uppercase tracking-widest text-zinc-500',
  fieldLabel: 'text-[11px] text-zinc-500',
  input:
    'w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15',
  chipBase: 'border px-2 py-0.5 text-[10px] font-medium transition-colors rounded-md',
  chipActive: 'border-zinc-500/40 bg-zinc-800/70 text-zinc-200',
  chipInactive: 'border-white/5 bg-transparent text-zinc-500 hover:border-white/10 hover:text-zinc-400',
  chipPill: 'rounded-full px-2.5',
  previewPanel: 'rounded-lg border border-white/5 bg-zinc-900/15 p-4 space-y-4',
  previewTitle: 'text-sm font-semibold text-zinc-200',
  btnExport:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/5',
  kpiCard: 'rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-2.5',
  kpiLabel: 'text-[9px] font-semibold uppercase tracking-wider text-zinc-500',
  kpiValue: 'mt-0.5 text-base font-semibold tabular-nums text-zinc-200',
  kpiValueAccent: 'mt-0.5 text-base font-semibold tabular-nums text-zinc-100',
  kpiValueSmall: 'mt-1 text-[11px] font-medium tabular-nums text-zinc-400 leading-snug',
  tableWrap: 'overflow-x-auto rounded-lg border border-white/5',
  tableHead: 'border-b border-white/5 bg-zinc-900/40 text-[10px] font-semibold uppercase tracking-wider text-zinc-500',
  tableBody: 'divide-y divide-white/5 text-zinc-400 text-xs',
  tableRow: 'hover:bg-white/[0.02] transition-colors',
  emptyState: 'flex h-52 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-10',
} as const;
