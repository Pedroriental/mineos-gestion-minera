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
  /** Clases extra del backdrop (p. ej. ocultar en desktop). */
  backdropClassName?: string;
  /** center: modal centrado (por defecto). bottom: hoja inferior en móvil. */
  align?: 'center' | 'bottom';
};

/**
 * Modal de formulario a nivel de ventana (portal en document.body).
 * Cubre toda la vista, incluido el topbar (z-index por encima del header).
 */
export function PageFormModal({
  open,
  onClose,
  children,
  panelClassName,
  backdropClassName,
  align = 'center',
}: PageFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const onCloseRef = useRef(onClose);
  const pathnameRef = useRef(pathname);
  const ignoreBackdropCloseRef = useRef(false);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);

  /** Evita que el mismo clic que abrió el modal cierre el backdrop (mouseup sobre el overlay). */
  useEffect(() => {
    if (!open) return;
    ignoreBackdropCloseRef.current = true;
    const t = window.setTimeout(() => {
      ignoreBackdropCloseRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  /** Cerrar al navegar a otra ruta. */
  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    onCloseRef.current();
  }, [pathname]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        'page-form-modal-backdrop fixed inset-0 z-[9500] flex justify-center overflow-hidden bg-black/70 backdrop-blur-sm',
        align === 'bottom'
          ? 'items-end p-0 sm:items-center sm:p-4'
          : 'items-center p-4',
        backdropClassName,
      )}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (ignoreBackdropCloseRef.current) return;
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'page-form-modal-panel relative max-h-[92dvh] w-full overflow-y-auto p-6 sm:max-w-2xl sm:rounded-2xl sm:p-8',
          align === 'bottom' && 'rounded-t-2xl sm:rounded-2xl',
          panelClassName,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
