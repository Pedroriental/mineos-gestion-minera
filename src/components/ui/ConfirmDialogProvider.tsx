'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { FadeIn } from './motion';

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
  
  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="relative z-[9999]"
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />

        {/* Dialog Content */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-[#1e293b] border border-white/10 shadow-2xl">
            <FadeIn>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 rounded-full p-2.5 ${
                    variant === 'danger' ? 'bg-red-500/10 text-red-500' :
                    variant === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}>
                    {variant === 'info' ? (
                      <Info className="h-6 w-6" />
                    ) : (
                      <AlertTriangle className="h-6 w-6" />
                    )}
                  </div>
                  
                  <div className="mt-1 flex-1">
                    <Dialog.Title className="text-lg font-bold text-white/95">
                      {options?.title}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-slate-300 leading-relaxed">
                      {options?.message}
                    </Dialog.Description>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-[#1e293b]"
                  >
                    {options?.cancelLabel || 'Cancelar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1e293b] ${
                      variant === 'danger' ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500/50' :
                      variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/50' :
                      'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500/50'
                    }`}
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
