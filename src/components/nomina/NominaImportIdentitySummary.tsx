'use client';

import {
  computeIdentitySummary,
  type IdentityCase,
  type IdentitySummaryFilter,
} from '@/lib/nomina/worker-identity-cases';
import type { ParsedNominaPeriod } from '@/lib/nomina/types';
import { cn } from '@/lib/utils';

type Chip = {
  id: IdentitySummaryFilter;
  label: string;
  count: number;
  tone: string;
};

export function NominaImportIdentitySummary({
  rawPeriod,
  cases,
  aliasResolved = 0,
  activeFilter,
  onFilterChange,
  compact = false,
}: {
  rawPeriod: ParsedNominaPeriod;
  cases: IdentityCase[];
  aliasResolved?: number;
  activeFilter: IdentitySummaryFilter;
  onFilterChange: (filter: IdentitySummaryFilter) => void;
  compact?: boolean;
}) {
  const summary = computeIdentitySummary(rawPeriod, cases, aliasResolved);

  const chips = ([
    {
      id: 'matched',
      label: 'Identificados',
      count: summary.autoMatched,
      tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    {
      id: 'alias',
      label: 'Por alias',
      count: summary.aliasResolved,
      tone: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    },
    {
      id: 'corrected',
      label: 'Cédulas corregidas',
      count: summary.corrected,
      tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    },
    {
      id: 'shared',
      label: 'Cédulas compartidas',
      count: summary.shared,
      tone: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    },
    {
      id: 'unknown',
      label: 'Sin base',
      count: summary.unknown,
      tone: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    },
    {
      id: 'conflict',
      label: 'Conflictos',
      count: summary.conflict,
      tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    },
    {
      id: 'pending',
      label: 'Pendientes',
      count: summary.pending,
      tone: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-200',
    },
  ] as Chip[]).filter((chip) => chip.count > 0 || chip.id === 'pending');

  if (summary.totalWorkers === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/8 bg-zinc-900/40',
        compact ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Resumen identidad · {summary.totalWorkers} trabajadores
        </p>
        {activeFilter !== 'all' ? (
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className="text-[10px] font-medium text-amber-400 hover:text-amber-300"
          >
            Ver todos
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
            activeFilter === 'all'
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-white/8 bg-zinc-950/40 text-zinc-400 hover:border-white/15',
          )}
        >
          Todos ({summary.totalWorkers})
        </button>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onFilterChange(chip.id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
              chip.tone,
              activeFilter === chip.id && 'ring-1 ring-white/20',
            )}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>
    </div>
  );
}

export function buildIdentitySummaryForReport(
  rawPeriod: ParsedNominaPeriod,
  cases: IdentityCase[],
  aliasResolved = 0,
) {
  return computeIdentitySummary(rawPeriod, cases, aliasResolved);
}
