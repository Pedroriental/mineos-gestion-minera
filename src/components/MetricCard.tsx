'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────
export type MetricVariant = 'gold' | 'positive' | 'negative' | 'neutral';

export interface MetricCardProps {
  /** Short uppercase label above the number */
  label: string;
  /** Main numeric or string value to display */
  value: string | number;
  /** Unit suffix rendered smaller (e.g. "g", "g/t", "%") */
  unit?: string;
  /** Percentage change. Positive = growth, negative = loss */
  delta?: number;
  /** Color semantics — gold: recovered gold/revenue | positive: growth | negative: loss/merma | neutral: info */
  variant?: MetricVariant;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Secondary data line beneath the main value */
  subValue?: string;
  /** Secondary label for subValue */
  subLabel?: string;
  /** Show skeleton loading state */
  loading?: boolean;
  className?: string;
}

// ── Number formatting helpers ─────────────────────────────────────────────
const ES = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const ES4 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4, minimumFractionDigits: 2 });

/** Smart-format based on magnitude and presumed unit type */
function formatValue(value: string | number, unit?: string): string {
  if (typeof value === 'string') return value;
  if (!isFinite(value)) return '—';
  if (unit === 'g/t' || unit === '%') return ES4.format(value);
  if (unit === 'g') return ES4.format(value);
  return ES.format(value);
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

// ── Variant maps ──────────────────────────────────────────────────────────
const variantValueClass: Record<MetricVariant, string> = {
  gold:     'text-amber-400',
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  neutral:  'text-white/90',
};

const variantIconBg: Record<MetricVariant, string> = {
  gold:     'bg-amber-500/10 text-amber-400',
  positive: 'bg-emerald-500/10 text-emerald-400',
  negative: 'bg-red-500/10 text-red-400',
  neutral:  'bg-zinc-800 text-zinc-400',
};

const variantDeltaClass = (delta: number): string =>
  delta > 0
    ? 'text-emerald-400 bg-emerald-500/10'
    : delta < 0
    ? 'text-red-400 bg-red-500/10'
    : 'text-zinc-400 bg-zinc-800';

// ── Skeleton ──────────────────────────────────────────────────────────────
function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded bg-zinc-800 animate-pulse',
        className,
      )}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export function MetricCard({
  label,
  value,
  unit,
  delta,
  variant = 'neutral',
  icon,
  subValue,
  subLabel,
  loading = false,
  className,
}: MetricCardProps) {
  const formattedValue = loading ? null : formatValue(value, unit);
  const valueColorClass = variantValueClass[variant];

  return (
    <div
      className={cn(
        // Base card — black with ultra-subtle 1px border (zinc-800)
        'relative rounded-2xl border border-zinc-800 bg-zinc-950 p-5 overflow-hidden',
        // Hover elevation — only moves border, no color change
        'hover:border-zinc-700 transition-colors duration-200',
        className,
      )}
    >
      {/* Top row: label + optional icon */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 leading-none">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[15px]',
              variantIconBg[variant],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Main value */}
      {loading ? (
        <SkeletonLine className="h-9 w-28 mb-1" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'text-3xl font-bold tracking-tight leading-none tabular-nums',
              valueColorClass,
            )}
          >
            {formattedValue}
          </span>
          {unit && (
            <span className="text-sm font-medium text-zinc-500 leading-none">
              {unit}
            </span>
          )}
        </div>
      )}

      {/* Sub-value row */}
      {(subValue || loading) && (
        <div className="mt-2 flex items-center gap-1.5">
          {loading ? (
            <SkeletonLine className="h-3.5 w-20" />
          ) : (
            <>
              {subLabel && (
                <span className="text-[10px] text-zinc-600 font-medium">
                  {subLabel}
                </span>
              )}
              <span className="text-[12px] text-zinc-400 font-semibold tabular-nums">
                {subValue}
              </span>
            </>
          )}
        </div>
      )}

      {/* Delta badge */}
      {typeof delta === 'number' && !loading && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold',
              variantDeltaClass(delta),
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : delta < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {formatDelta(delta)}
          </span>
          <span className="text-[10px] text-zinc-600">vs. período anterior</span>
        </div>
      )}
    </div>
  );
}

// ── Convenience re-exports ────────────────────────────────────────────────
export default MetricCard;
