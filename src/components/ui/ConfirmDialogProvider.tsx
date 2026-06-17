'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { AlertTriangle, Info } from 'lucide-react';
import { MobileSheetChrome } from '@/components/mobile/MobileSheetChrome';
import { SheetIconBadge } from '@/components/mobile/SheetIconBadge';
import { useBottomSheetSnap } from '@/hooks/useBottomSheetSnap';
import { useMobileOverlayLock } from '@/hooks/useMobileOverlayLock';
import { FadeIn } from './motion';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

type ConfirmVariant = 'danger' | 'warning' | 'info';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return context.confirm;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const isMobile = useIsMobile();

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
  }, []);

  const variant = options?.variant || 'danger';

  const {
    snap,
    scrollRef,
    sheetStyle,
    toggleSnap,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useBottomSheetSnap({ enabled: isMobile, open: isOpen, onClose: handleClose });

  useMobileOverlayLock(isOpen, isMobile);

  const sheetTone =
    variant === 'danger' ? 'danger' : variant === 'warning' ? 'warn' : 'info';
  const SheetIcon = variant === 'info' ? Info : AlertTriangle;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="relative z-[9999]"
      >
        {/* Backdrop */}
        <div
          className={cn(
            'fixed inset-0 backdrop-blur-[6px]',
            isMobile ? 'bg-black/72' : 'bg-black/40',
          )}
          aria-hidden="true"
        />

        {/* Dialog Content */}
        <div
          className={cn(
            'fixed inset-0 flex p-4',
            isMobile ? 'confirm-dialog-mobile-sheet items-end' : 'items-center justify-center',
          )}
        >
          <Dialog.Panel
            style={isMobile ? sheetStyle : undefined}
            onTouchStart={isMobile ? handleTouchStart : undefined}
            onTouchMove={isMobile ? handleTouchMove : undefined}
            onTouchEnd={isMobile ? handleTouchEnd : undefined}
            className={cn(
              'mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border shadow-2xl',
              isMobile
                ? 'confirm-dialog-panel--mobile mobile-bottom-sheet border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)]'
                : 'border-white/10 bg-[#1e293b]',
              isMobile && (snap === 'expanded' ? 'mobile-bottom-sheet--expanded' : 'mobile-bottom-sheet--peek'),
            )}
          >
            {isMobile ? (
              <MobileSheetChrome
                onClose={handleClose}
                onToggleSnap={toggleSnap}
                snap={snap}
                title={options?.title}
                icon={<SheetIconBadge icon={SheetIcon} tone={sheetTone} />}
              />
            ) : null}
            <FadeIn>
              <div
                ref={isMobile ? scrollRef : undefined}
                className={cn(
                  'p-6',
                  isMobile && 'max-h-none overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3',
                )}
              >
                <div className={cn('flex items-start gap-4', isMobile && 'gap-3')}>
                  <div className={cn(
                    'shrink-0 rounded-xl p-2.5',
                    variant === 'danger' ? 'bg-red-500/10 text-red-500' :
                    variant === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-blue-500/10 text-blue-500',
                    isMobile && 'rounded-lg p-2',
                  )}>
                    {variant === 'info' ? (
                      <Info className="h-6 w-6" />
                    ) : (
                      <AlertTriangle className="h-6 w-6" />
                    )}
                  </div>
                  
                  <div className="mt-1 flex-1">
                    <Dialog.Title className={cn('font-bold text-white/95', isMobile ? 'text-base' : 'text-lg')}>
                      {options?.title}
                    </Dialog.Title>
                    <Dialog.Description className={cn('mt-2 leading-relaxed text-slate-300', isMobile ? 'text-[13px]' : 'text-sm')}>
                      {options?.message}
                    </Dialog.Description>
                  </div>
                </div>

                <div
                  className={cn(
                    'confirm-dialog-actions mt-8 flex gap-3',
                    !isMobile && 'justify-end',
                  )}
                >
                  <button type="button" onClick={handleClose} className="btn-secondary">
                    {options?.cancelLabel || 'Cancelar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
                  >
                    {options?.confirmLabel || 'Aceptar'}
                  </button>
                </div>
              </div>
            </FadeIn>
          </Dialog.Panel>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
