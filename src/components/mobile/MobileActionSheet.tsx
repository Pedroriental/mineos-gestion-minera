'use client';

import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useBottomSheetSnap } from '@/hooks/useBottomSheetSnap';
import { useMobileOverlayLock } from '@/hooks/useMobileOverlayLock';
import { MobileSheetChrome } from './MobileSheetChrome';

type MobileActionSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Acciones principales tipo botón */
  actions?: { label: string; onClick: () => void; destructive?: boolean }[];
  className?: string;
  initialSnap?: 'peek' | 'expanded';
};

/**
 * Bottom action sheet nativo para mobile.
 * Se puede expandir deslizando hacia arriba o tocando el asa.
 */
export function MobileActionSheet({
  open,
  onClose,
  title,
  icon,
  children,
  actions,
  className,
  initialSnap: initialSnapProp,
}: MobileActionSheetProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  };

  const isFilterSheet = className?.includes('mobile-filter-sheet');
  const initialSnap = initialSnapProp ?? (isFilterSheet ? 'expanded' : 'peek');

  const {
    snap,
    scrollRef,
    sheetStyle,
    toggleSnap,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useBottomSheetSnap({ enabled: true, open, onClose: handleClose, initialSnap });

  useMobileOverlayLock(open, true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isMobile && open) onClose();
  }, [isMobile, open, onClose]);

  if (!isMobile || !open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[9500] flex justify-center',
        snap === 'expanded' ? 'items-start pt-[max(0.375rem,env(safe-area-inset-top))]' : 'items-end',
      )}
      role="presentation"
    >
      <div
        className={cn(
          'absolute inset-0 backdrop-blur-[2px] transition-opacity duration-200',
          isFilterSheet ? 'bg-black/72' : 'bg-black/60 backdrop-blur-sm',
          closing ? 'opacity-0' : 'opacity-100',
        )}
        onClick={handleClose}
      />

      <div
        className={cn(
          'mobile-action-sheet mobile-bottom-sheet relative z-10 flex w-full flex-col overflow-hidden border-t border-[color-mix(in_srgb,var(--mineos-general)_18%,var(--dashboard-border))] bg-[var(--dashboard-card-bg)] shadow-[0_-12px_48px_rgba(0,0,0,0.5)] transition-[max-height,transform] duration-300 ease-out',
          snap === 'expanded' ? 'mobile-bottom-sheet--expanded' : 'mobile-bottom-sheet--peek',
          closing && 'translate-y-full',
          className,
        )}
        style={closing ? undefined : sheetStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <MobileSheetChrome
          onClose={handleClose}
          onToggleSnap={toggleSnap}
          snap={snap}
          title={title}
          icon={icon}
        />

        <div className="mobile-bottom-sheet__body flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            className="mobile-bottom-sheet__scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1"
          >
            {children}
          </div>
        </div>

        {actions && actions.length > 0 ? (
          <div className="shrink-0 space-y-2 border-t border-[var(--dashboard-border)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={() => {
                  a.onClick();
                  handleClose();
                }}
                className={cn(
                  'flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-[0.98]',
                  a.destructive
                    ? 'bg-red-500/10 text-red-400 active:bg-red-500/20'
                    : 'bg-amber-500/10 text-amber-400 active:bg-amber-500/20',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
