'use client';

import { Maximize2, Minimize2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { BottomSheetSnap } from '@/hooks/useBottomSheetSnap';

type MobileSheetChromeProps = {
  onClose: () => void;
  onToggleSnap?: () => void;
  snap?: BottomSheetSnap;
  title?: string;
  icon?: ReactNode;
  className?: string;
};

export function MobileSheetChrome({
  onClose,
  onToggleSnap,
  snap = 'peek',
  title,
  icon,
  className,
}: MobileSheetChromeProps) {
  const expanded = snap === 'expanded';

  return (
    <div className={cn('mobile-sheet-chrome shrink-0', className)}>
      <div className="mobile-sheet-chrome__accent" aria-hidden />

      <div className="mobile-sheet-chrome__top flex items-center gap-2 px-3 pb-2.5 pt-2">
        <div
          data-sheet-handle
          className="mobile-sheet-chrome__handle-row flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2.5 active:cursor-grabbing"
          onClick={onToggleSnap}
          role="button"
          tabIndex={-1}
          aria-label={expanded ? 'Reducir panel' : 'Expandir panel'}
        >
          {icon}
          {title ? (
            <h2 className="mobile-sheet-chrome__title min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-[var(--dashboard-text)]">
              {title}
            </h2>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onToggleSnap ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSnap();
              }}
              className="mobile-sheet-chrome__expand flex h-8 w-8 items-center justify-center rounded-full text-[var(--dashboard-text-muted)] transition-colors active:bg-[var(--dashboard-card-muted)]"
              aria-label={expanded ? 'Reducir' : 'Expandir'}
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="mobile-sheet-chrome__close flex h-8 w-8 items-center justify-center rounded-full text-[var(--dashboard-text-muted)] transition-colors active:scale-95"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
