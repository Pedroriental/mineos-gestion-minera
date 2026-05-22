'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Pie estándar de modales crear/editar: separación clara respecto a los campos. */
export function PageFormModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('page-form-modal-footer', className)}>{children}</div>;
}

type PageFormModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Contenedor del panel (formulario). */
  panelClassName?: string;
};

/**
 * Modal de formulario a nivel de ventana: el backdrop cubre topbar y contenido
 * con el mismo efecto (oscuro + blur), sin ocultar el header.
 */
export function PageFormModal({
  open,
  onClose,
  children,
  panelClassName,
}: PageFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    return () => {
      onCloseRef.current();
    };
  }, [pathname, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="page-form-modal-backdrop fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'page-form-modal-panel relative max-h-[92dvh] w-full overflow-y-auto p-6 sm:max-w-2xl sm:rounded-2xl sm:p-8 rounded-t-2xl',
          panelClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
