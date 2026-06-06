'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MobileSectionProps = {
  title?: string;
  children: ReactNode;
  className?: string;
  tight?: boolean;
};

export function MobileSection({ title, children, className, tight }: MobileSectionProps) {
  return (
    <section className={cn('mobile-section', tight && 'mobile-section--tight', className)}>
      {title ? (
        <div className={cn('mobile-section__head flex items-center gap-2', tight ? 'mb-1.5' : 'mb-2')}>
          <span className="mobile-section__rule h-px flex-1" />
          <h2 className="mobile-section__title shrink-0 text-[10px] font-bold uppercase tracking-[0.14em]">
            {title}
          </h2>
          <span className="mobile-section__rule h-px flex-1" />
        </div>
      ) : null}
      <div className="mobile-section__card overflow-hidden rounded-2xl border">{children}</div>
    </section>
  );
}

type MobileKpiProps = {
  label: string;
  value: string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  tone?: 'general' | 'benefit' | 'expense' | 'neutral';
  compact?: boolean;
};

export function MobileKpi({
  label,
  value,
  unit,
  trend,
  icon,
  tone = 'general',
  compact,
}: MobileKpiProps) {
  return (
    <div
      className={cn(
        'mobile-kpi relative overflow-hidden rounded-2xl border transition-transform active:scale-[0.98]',
        compact ? 'p-2.5' : 'p-3.5',
        tone !== 'general' && `mobile-kpi--${tone}`,
      )}
    >
      <div className="mobile-kpi__glow" aria-hidden />
      <div className="relative flex items-start justify-between gap-2">
        <span className="mobile-kpi__label text-[9px] font-bold uppercase tracking-[0.12em] leading-tight">
          {label}
        </span>
        {icon ? <span className="mobile-kpi__icon shrink-0 opacity-80">{icon}</span> : null}
      </div>
      <div className={cn('relative flex items-baseline gap-1', compact ? 'mt-1' : 'mt-1.5')}>
        <span className={cn('mobile-kpi__value font-black tabular-nums tracking-tight', compact ? 'text-xl' : 'text-2xl')}>
          {value}
        </span>
        {unit ? <span className="mobile-kpi__unit text-[10px] font-semibold">{unit}</span> : null}
      </div>
      {trend ? (
        <span
          className={cn(
            'relative mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide',
            trend === 'up' && 'bg-[var(--mineos-benefit-soft)] text-[var(--mineos-benefit)]',
            trend === 'down' && 'bg-[var(--mineos-expense-soft)] text-[var(--mineos-expense)]',
            trend === 'neutral' && 'bg-[color-mix(in_srgb,var(--dashboard-text-muted)_12%,transparent)] text-[var(--dashboard-text-muted)]',
          )}
        >
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
        </span>
      ) : null}
    </div>
  );
}
