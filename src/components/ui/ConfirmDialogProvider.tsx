'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { PageFormModal, PageFormModalFooter } from './PageFormModal';
import { SheetIconBadge } from '@/components/mobile/SheetIconBadge';
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
  const openTimeRef = useRef<number>(0);
  const isMobile = useIsMobile();

  const confirm = useCallback((opts: ConfirmOptions) => {
    openTimeRef.current = Date.now();
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback(() => {
    // Evitar cierres accidentales producidos por bubbling en el tick de apertura
    if (Date.now() - openTimeRef.current < 150) return;
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const variant = options?.variant || 'danger';
  const sheetTone =
    variant === 'danger' ? 'danger' : variant === 'warning' ? 'warn' : 'info';
  const SheetIcon = variant === 'info' ? Info : AlertTriangle;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      <PageFormModal
        open={isOpen}
        onClose={handleClose}
        panelClassName="max-w-md"
        sheetTitle={options?.title}
        sheetIcon={<SheetIconBadge icon={SheetIcon} tone={sheetTone} />}
      >
        <div className="flex items-start gap-4 p-1 sm:p-2">
          <div
            className={cn(
              'shrink-0 rounded-xl p-2.5',
              variant === 'danger'
                ? 'bg-red-500/10 text-red-500'
                : variant === 'warning'
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-blue-500/10 text-blue-500',
              isMobile && 'rounded-lg p-2',
            )}
          >
            <SheetIcon className="h-6 w-6" />
          </div>

          <div className="mt-0.5 flex-1">
            <h3 className={cn('font-bold text-white/95', isMobile ? 'text-base' : 'text-lg')}>
              {options?.title}
            </h3>
            <p className={cn('mt-2 leading-relaxed text-slate-300', isMobile ? 'text-[13px]' : 'text-sm')}>
              {options?.message}
            </p>
          </div>
        </div>

        <PageFormModalFooter className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/5">
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
        </PageFormModalFooter>
      </PageFormModal>
    </ConfirmContext.Provider>
  );
}
