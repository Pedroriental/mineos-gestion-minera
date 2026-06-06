'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileActionSheet } from './MobileActionSheet';
import { SheetIconBadge } from './SheetIconBadge';

type MobileFilterTriggerProps = {
  activeCount?: number;
  label?: string;
  subtitle?: string;
  showBadge?: boolean;
  className?: string;
  onOpen: () => void;
};

export function MobileFilterTrigger({
  activeCount = 0,
  label = 'Filtros',
  subtitle,
  showBadge = true,
  className,
  onOpen,
}: MobileFilterTriggerProps) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('mobile-filter-trigger', className)}
      aria-label={activeCount > 0 ? `${label}, ${activeCount} activos` : label}
    >
      <SlidersHorizontal className="mobile-filter-trigger__icon" aria-hidden />
      <span className="mobile-filter-trigger__content">
        <span className="mobile-filter-trigger__label">{label}</span>
        {subtitle ? (
          <span className="mobile-filter-trigger__subtitle">{subtitle}</span>
        ) : null}
      </span>
      {showBadge ? (
        activeCount > 0 ? (
          <span className="mobile-filter-trigger__badge" aria-hidden>
            {activeCount}
          </span>
        ) : (
          <span className="mobile-filter-trigger__badge mobile-filter-trigger__badge--empty" aria-hidden />
        )
      ) : null}
    </button>
  );
}

type MobileFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
};

export function MobileFilterSheet({
  open,
  onClose,
  title = 'Filtros',
  icon,
  children,
}: MobileFilterSheetProps) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile && open) onClose();
  }, [isMobile, open, onClose]);

  if (!isMobile) return null;

  return (
    <MobileActionSheet
      open={open}
      onClose={onClose}
      title={title}
      icon={icon ?? <SheetIconBadge icon={SlidersHorizontal} />}
      className="mobile-filter-sheet"
    >
      <div className="mobile-filter-sheet__body">{children}</div>
    </MobileActionSheet>
  );
}

type MobileFiltersSlotProps = {
  title?: string;
  activeCount?: number;
  panelClassName?: string;
  triggerClassName?: string;
  children: ReactNode;
  /** Si true, el botón se renderiza aquí (p. ej. en la toolbar). */
  showTrigger?: boolean;
};

/**
 * En desktop muestra el panel inline. En móvil oculta el panel y expone trigger + sheet.
 */
export function MobileFiltersSlot({
  title = 'Filtros',
  activeCount = 0,
  panelClassName,
  triggerClassName,
  children,
  showTrigger = false,
}: MobileFiltersSlotProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return <div className={panelClassName}>{children}</div>;
  }

  return (
    <>
      {showTrigger ? (
        <MobileFilterTrigger
          activeCount={activeCount}
          label={title}
          className={triggerClassName}
          onOpen={() => setOpen(true)}
        />
      ) : null}
      <MobileFilterSheet open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </MobileFilterSheet>
    </>
  );
}

export function useMobileFilterSheet() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setOpen(false);
  }, [isMobile]);

  return {
    isMobile,
    open,
    setOpen,
    close: () => setOpen(false),
  };
}
