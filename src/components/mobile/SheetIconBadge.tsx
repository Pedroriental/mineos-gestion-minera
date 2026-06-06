'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SheetIconTone = 'general' | 'danger' | 'accent' | 'warn' | 'success' | 'info';

const toneClasses: Record<SheetIconTone, string> = {
  general:
    'border-[color-mix(in_srgb,var(--mineos-general)_28%,transparent)] bg-[color-mix(in_srgb,var(--mineos-general)_12%,transparent)] text-[var(--mineos-general-bright)]',
  danger: 'border-red-500/20 bg-red-500/10 text-red-400',
  accent:
    'border-[var(--dashboard-accent-soft)] bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]',
  warn: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
};

export function SheetIconBadge({
  icon: Icon,
  tone = 'general',
  className,
}: {
  icon: LucideIcon;
  tone?: SheetIconTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'mobile-sheet-chrome__icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
        toneClasses[tone],
        className,
      )}
      aria-hidden
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
