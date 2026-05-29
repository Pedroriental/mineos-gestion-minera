'use client';

import type { MacroSummary } from '@/lib/reconciliation/types';
import { cn } from '@/lib/utils';

export function ReconciliacionMacroKpis({
  macro,
  variant = 'grid',
}: {
  macro: MacroSummary;
  variant?: 'grid' | 'sidebar' | 'compact';
}) {
  const cards: Array<{
    label: string;
    value: string;
    accent: string;
  }> = [
    { label: 'Meta periodo (oro)', value: `${macro.metaPeriodoOroG.toFixed(1)} g`, accent: 'text-zinc-300' },
    { label: 'Real acumulado', value: `${macro.realOroG.toFixed(1)} g`, accent: 'text-amber-400' },
    { label: 'Proyección cierre', value: `${macro.proyeccionOroG.toFixed(1)} g`, accent: 'text-emerald-400' },
    {
      label: 'Cumplimiento',
      value: `${macro.cumplimientoOroPct}%`,
      accent:
        macro.cumplimientoOroPct >= 100
          ? 'text-emerald-400'
          : macro.cumplimientoOroPct >= 80
            ? 'text-amber-400'
            : 'text-red-400',
    },
    { label: 'Margen real', value: `${macro.realMargenPct.toFixed(1)}%`, accent: 'text-white/90' },
    { label: 'Meta margen', value: `${macro.metaPeriodoMargenPct}%`, accent: 'text-zinc-400' },
    {
      label: 'Precio oro ref.',
      value: `$${macro.precioOroUsd.toFixed(2)}/g`,
      accent: 'text-zinc-300',
    },
    {
      label: 'Días',
      value: `${macro.diasTranscurridos} / ${macro.diasPeriodo}`,
      accent: 'text-zinc-400',
    },
  ];

  const isSidebar = variant === 'sidebar';
  const isCompact = variant === 'compact';

  if (isSidebar) {
    return (
      <div className="divide-y divide-white/5 rounded-lg border border-white/5 bg-zinc-900/30">
        {cards.map((c) => (
          <div
            key={c.label}
            className="flex items-center justify-between gap-2 px-2 py-1 min-h-0"
          >
            <span className="text-[8px] font-bold uppercase leading-tight tracking-wide text-white/35 shrink">
              {c.label}
            </span>
            <span className={cn('text-xs font-extrabold tabular-nums shrink-0', c.accent)}>
              {c.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        isCompact && 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2',
        !isCompact && 'grid grid-cols-2 md:grid-cols-4 gap-3',
      )}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            'rounded-lg border border-white/5 bg-zinc-900/50 backdrop-blur-md',
            isCompact ? 'px-2 py-1.5 text-center' : 'px-4 py-3',
          )}
        >
          <p
            className={cn(
              'font-bold uppercase tracking-wider text-white/40',
              isCompact ? 'text-[8px] leading-tight' : 'text-[10px]',
            )}
          >
            {c.label}
          </p>
          <p
            className={cn(
              'font-extrabold tabular-nums',
              isCompact ? 'mt-0.5 text-sm' : 'mt-1 text-lg',
              c.accent,
            )}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
