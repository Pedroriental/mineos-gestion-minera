'use client';

import { useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileActionSheet } from './MobileActionSheet';
import { SheetIconBadge } from './SheetIconBadge';

export type MobileToolbarAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
};

type MobileToolbarMoreProps = {
  actions: MobileToolbarAction[];
  title?: string;
  className?: string;
};

export function MobileToolbarMore({
  actions,
  title = 'Más acciones',
  className,
}: MobileToolbarMoreProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile || actions.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('mobile-toolbar-more-btn', className)}
        aria-label={title}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      <MobileActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        icon={<SheetIconBadge icon={MoreHorizontal} />}
        className="mobile-toolbar-more-sheet"
      >
        <div className="mobile-sheet-action-list mobile-toolbar-more-sheet__list">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              className={cn(
                'mobile-sheet-action-item',
                action.destructive && 'mobile-sheet-action-item--destructive',
              )}
            >
              {action.icon ? (
                <span className="mobile-sheet-action-item__icon">{action.icon}</span>
              ) : null}
              <span className="mobile-sheet-action-item__label">{action.label}</span>
            </button>
          ))}
        </div>
      </MobileActionSheet>
    </>
  );
}
