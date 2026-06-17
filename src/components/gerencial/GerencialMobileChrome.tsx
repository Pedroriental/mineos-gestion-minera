'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeMap } from '@/lib/safe-map';
import {
  mineosIcon,
  mineosIconRing,
  mineosKpiGlow,
  mineosKpiValue,
  type MineosTone,
} from '@/lib/mineos-visual';

export type GerencialKpiChip = {
  label: string;
  value: string;
  tone?: MineosTone;
  icon?: LucideIcon;
};

export function GerencialMobileKpiStrip({
  items,
  className,
  footer,
}: {
  items: GerencialKpiChip[];
  className?: string;
  footer?: React.ReactNode;
}) {
  if (items.length === 0 && !footer) return null;

  return (
    <div className={cn('gerencial-mobile-kpi-block space-y-1.5', className)}>
      {items.length > 0 ? (
        <div className="gerencial-mobile-kpi-strip -mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 snap-x snap-mandatory scroll-smooth">
          {safeMap(items, (k) => {
            const Icon = k.icon;
            const tone = k.tone ?? 'general';
            return (
              <div
                key={k.label}
                className="gerencial-mobile-kpi-card produccion-surface gerencial-kpi-card relative flex min-w-[7.25rem] shrink-0 snap-start items-center gap-2 rounded-lg px-2.5 py-2"
              >
                <div className={mineosKpiGlow(tone)} aria-hidden />
                {Icon ? (
                  <div
                    className={cn(
                      mineosIconRing(tone),
                      'gerencial-mobile-kpi-card__ring !h-8 !w-8 shrink-0',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', mineosIcon(tone))} />
                  </div>
                ) : null}
                <div className="relative min-w-0 flex-1">
                  <span className="produccion-kpi-label block truncate text-[7px] font-bold uppercase leading-tight tracking-wider">
                    {k.label}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-bold leading-tight tabular-nums',
                      mineosKpiValue(tone),
                    )}
                  >
                    {k.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {footer ? <div className="gerencial-mobile-kpi-footer">{footer}</div> : null}
    </div>
  );
}

export function GerencialMobileChartFold({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      className={cn(
        'gerencial-mobile-chart produccion-surface group rounded-xl lg:hidden',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-bold [&::-webkit-details-marker]:hidden">
        <Icon className="h-4 w-4 shrink-0 text-amber-400" />
        <span className="flex-1">{title}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-[var(--prod-border)] px-3 pb-3 pt-2">{children}</div>
    </details>
  );
}
