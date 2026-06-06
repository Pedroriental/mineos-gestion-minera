'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileSheetAction = {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  iconNode?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  hidden?: boolean;
};

export function MobileSheetActionList({
  actions,
  className,
}: {
  actions: MobileSheetAction[];
  className?: string;
}) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <div className={cn('mobile-sheet-action-list', className)}>
      {visible.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={cn(
              'mobile-sheet-action-item',
              action.destructive && 'mobile-sheet-action-item--destructive',
            )}
          >
            {(Icon || action.iconNode) && (
              <span className="mobile-sheet-action-item__icon" aria-hidden>
                {Icon ? <Icon className="h-4 w-4" /> : action.iconNode}
              </span>
            )}
            <span className="mobile-sheet-action-item__label">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
