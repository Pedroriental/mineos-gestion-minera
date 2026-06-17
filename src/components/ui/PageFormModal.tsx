'use client';

import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useBottomSheetSnap } from '@/hooks/useBottomSheetSnap';
import { MobileSheetChrome } from '@/components/mobile/MobileSheetChrome';
import { useMobileOverlayLock } from '@/hooks/useMobileOverlayLock';

export function PageFormModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('page-form-modal-footer', className)}>{children}</div>;
}

function splitModalChildren(children: ReactNode) {
  const content: ReactNode[] = [];
  let footer: ReactNode = null;

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === PageFormModalFooter) {
      footer = child;
      return;
    }
    content.push(child);
  });

  return { content, footer };
}

type PageFormModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  align?: 'center' | 'bottom';
  sheetTitle?: string;
  sheetIcon?: ReactNode;
};

export function PageFormModal({
  open,
  onClose,
  children,
  panelClassName,
  backdropClassName,
  align = 'center',
  sheetTitle,
  sheetIcon,
}: PageFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const onCloseRef = useRef(onClose);
  const pathnameRef = useRef(pathname);
  const ignoreBackdropCloseRef = useRef(false);
  onCloseRef.current = onClose;
  const resolvedAlign = align === 'center' && isMobile ? 'bottom' : align;
  const isSheet = isMobile && resolvedAlign === 'bottom';
  const { content, footer } = splitModalChildren(children);

  const {
    snap,
    scrollRef,
    sheetStyle,
    toggleSnap,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useBottomSheetSnap({ enabled: isSheet, open, onClose });

  useMobileOverlayLock(open, isSheet);

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

  useEffect(() => {
    if (!open) return;
    ignoreBackdropCloseRef.current = true;
    const t = window.setTimeout(() => {
      ignoreBackdropCloseRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    onCloseRef.current();
  }, [pathname]);

  if (!open || !mounted) return null;

  const sheetChildren = isSheet ? content : children;

  return createPortal(
    <div
      className={cn(
        'page-form-modal-backdrop fixed inset-0 z-[9500] flex justify-center overflow-hidden bg-black/70 backdrop-blur-sm',
        resolvedAlign === 'bottom'
          ? 'items-end p-0 sm:items-center sm:p-4'
          : 'items-center p-4',
        isSheet && snap === 'expanded' && 'page-form-modal-backdrop--sheet-expanded',
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
        style={isSheet ? sheetStyle : undefined}
        onTouchStart={isSheet ? handleTouchStart : undefined}
        onTouchMove={isSheet ? handleTouchMove : undefined}
        onTouchEnd={isSheet ? handleTouchEnd : undefined}
        className={cn(
          'page-form-modal-panel relative w-full bg-[var(--dashboard-card-bg)]',
          isSheet
            ? cn(
                'mobile-bottom-sheet flex max-h-none flex-col overflow-hidden shadow-[0_-12px_48px_rgba(0,0,0,0.45)] transition-[max-height,border-radius,margin] duration-300 ease-out',
                snap === 'expanded' ? 'mobile-bottom-sheet--expanded' : 'mobile-bottom-sheet--peek',
                footer && 'mobile-bottom-sheet--has-footer',
              )
            : 'max-h-[92dvh] overflow-y-auto overscroll-contain p-6 sm:max-w-2xl sm:rounded-2xl sm:p-8',
          !isSheet &&
            resolvedAlign === 'bottom' &&
            'rounded-t-[1.25rem] px-[1.125rem] pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:max-h-[92dvh] sm:overflow-y-auto sm:rounded-2xl sm:p-8',
          panelClassName,
        )}
      >
        {isSheet ? (
          <>
            <MobileSheetChrome
              onClose={onClose}
              onToggleSnap={toggleSnap}
              snap={snap}
              title={sheetTitle}
              icon={sheetIcon}
            />
            <div className="mobile-bottom-sheet__body flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={scrollRef}
                className="mobile-bottom-sheet__scroll page-form-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3"
              >
                {sheetChildren}
              </div>
              {footer}
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </div>,
    document.body,
  );
}
