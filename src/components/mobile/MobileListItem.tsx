'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileListItemProps = {
  label: string;
  value?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  dot?: string;
  badge?: string | number;
  className?: string;
  compact?: boolean;
};

export function MobileListItem({
  label,
  value,
  subtitle,
  icon,
  onClick,
  dot,
  badge,
  className,
  compact,
}: MobileListItemProps) {
  const hasRight = value || badge || onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'mobile-list-item flex w-full items-center gap-2.5 border-b text-left transition-colors last:border-b-0',
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
        onClick && 'active:bg-[color-mix(in_srgb,var(--dashboard-text)_6%,transparent)]',
        !onClick && 'cursor-default',
        className,
      )}
    >
      {dot && (
        <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
      )}
      {icon && (
        <span className={cn('mobile-list-item__icon flex shrink-0 items-center justify-center rounded-xl', compact ? 'h-8 w-8' : 'h-9 w-9')}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="mobile-list-item__label truncate text-sm font-medium">
            {label}
          </span>
          {hasRight && (
            <span className="flex shrink-0 items-center gap-1.5">
              {value && (
                <span className="mobile-list-item__value text-sm font-semibold tabular-nums">
                  {value}
                </span>
              )}
              {badge != null && (
                <span className="mobile-list-item__badge flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[9px] font-bold">
                  {badge}
                </span>
              )}
              {onClick && <ChevronRight className="mobile-list-item__chevron h-3.5 w-3.5" />}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mobile-list-item__subtitle mt-0.5 text-[12px] leading-tight">{subtitle}</p>
        )}
      </div>
    </button>
  );
}
