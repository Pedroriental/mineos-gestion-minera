'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCloseOnRouteChange } from '@/hooks/useCloseOnRouteChange';
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet';
import { SheetIconBadge } from '@/components/mobile/SheetIconBadge';
import { AppDatePicker } from '@/components/ui/AppDatePicker';

type GlobalDateRangePickerProps = {
  variant?: 'default' | 'mobile';
};

function formatDateLabel(fromParam: string | null, toParam: string | null) {
  if (!fromParam || !toParam) return 'Histórico General';

  try {
    const fromD = parseISO(fromParam);
    const toD = parseISO(toParam);
    if (isValid(fromD) && isValid(toD)) {
      return `${format(fromD, 'dd MMM', { locale: es })} - ${format(toD, 'dd MMM yyyy', { locale: es })}`;
    }
  } catch {
    // fall through
  }
  return 'Histórico General';
}

function DateRangeFields({
  dateRange,
  setDateRange,
}: {
  dateRange: { from: string; to: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
}) {
  return (
    <div className="global-date-panel__fields space-y-3">
      <div>
        <label className="input-label">Desde</label>
        <AppDatePicker value={dateRange.from} onChange={(v) => setDateRange((prev) => ({ ...prev, from: v }))} />
      </div>
      <div>
        <label className="input-label">Hasta</label>
        <AppDatePicker value={dateRange.to} onChange={(v) => setDateRange((prev) => ({ ...prev, to: v }))} />
      </div>
    </div>
  );
}

function DateRangeActions({
  onClear,
  onCancel,
  onApply,
  className,
  applyDisabled,
  applyMessage,
}: {
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
  className?: string;
  applyDisabled?: boolean;
  applyMessage?: string | null;
}) {
  return (
    <div className={cn('global-date-panel__actions flex flex-col gap-2 pt-1', className)}>
      {applyMessage ? (
        <p className="text-[11px] font-medium text-amber-300" role="status">
          {applyMessage}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onClear} className="btn-secondary !h-8 px-3 text-xs">
          Limpiar
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary !h-8 px-3 text-xs">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={applyDisabled}
            className="btn-primary !h-8 px-4 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Aplicar Rango
          </button>
        </div>
      </div>
    </div>
  );
}

function DateRangePanelContent({
  dateRange,
  setDateRange,
  onClear,
  onCancel,
  onApply,
  applyDisabled,
  applyMessage,
}: {
  dateRange: { from: string; to: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
  applyDisabled?: boolean;
  applyMessage?: string | null;
}) {
  return (
    <div className="global-date-panel__body space-y-4">
      <h4 className="global-date-panel__title">Rango Histórico</h4>
      <DateRangeFields dateRange={dateRange} setDateRange={setDateRange} />
      <DateRangeActions
        onClear={onClear}
        onCancel={onCancel}
        onApply={onApply}
        applyDisabled={applyDisabled}
        applyMessage={applyMessage}
      />
    </div>
  );
}

export default function GlobalDateRangePicker({ variant = 'default' }: GlobalDateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useCloseOnRouteChange(() => setIsOpen(false));

  const fromParam = searchParams.get('desde');
  const toParam = searchParams.get('hasta');

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dateRange, setDateRange] = useState({
    from: fromParam || format(firstDay, 'yyyy-MM-dd'),
    to: toParam || format(today, 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (fromParam) setDateRange((prev) => ({ ...prev, from: fromParam }));
    if (toParam) setDateRange((prev) => ({ ...prev, to: toParam }));
  }, [fromParam, toParam]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      // No cerrar si el click cae en un popover anidado (p.ej. el menú
      // portal del AppDatePicker interno). El atributo data-popover-content
      // marca cualquier popover hijo que deba ignorarse.
      if (target instanceof Element && target.closest('[data-popover-content]')) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validateDate = (iso: string): boolean => {
    if (!iso) return false;
    try {
      const d = parseISO(iso);
      return isValid(d);
    } catch {
      return false;
    }
  };

  const fromValid = validateDate(dateRange.from);
  const toValid = validateDate(dateRange.to);
  const rangeValid = fromValid && toValid;
  const rangeInOrder = !rangeValid
    ? false
    : parseISO(dateRange.from).getTime() <= parseISO(dateRange.to).getTime();

  const applyDisabled = !rangeValid || !rangeInOrder;
  const applyMessage = !rangeValid
    ? 'Ambas fechas son obligatorias y deben ser válidas.'
    : !rangeInOrder
      ? 'La fecha inicial no puede ser posterior a la final.'
      : null;

  const handleApply = () => {
    if (applyDisabled) return;
    setIsOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('desde', dateRange.from);
    params.set('hasta', dateRange.to);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    router.refresh();
  };

  const label = formatDateLabel(fromParam, toParam);
  const hasCustomRange = Boolean(fromParam && toParam);

  const handleClear = () => {
    setIsOpen(false);
    setDateRange({ from: format(firstDay, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') });
    router.push(pathname, { scroll: false });
    router.refresh();
  };

  const triggerClassName = cn(
    'global-date-trigger',
    'topbar-date-trigger',
    variant === 'mobile' && 'mobile-shell__header-date',
    (isOpen || hasCustomRange) && 'global-date-trigger--active',
    (isOpen || hasCustomRange) && 'topbar-date-trigger--active',
    isOpen && 'global-date-trigger--open',
    isOpen && 'topbar-date-trigger--open',
  );

  const triggerButton = (
    <button
      type="button"
      onClick={() => (variant === 'mobile' ? setIsOpen(true) : setIsOpen((v) => !v))}
      className={triggerClassName}
      aria-label={`Rango histórico: ${label}`}
      aria-expanded={isOpen}
    >
      <CalendarIcon className="global-date-trigger__icon" aria-hidden />
      <span className="global-date-trigger__label capitalize">{label}</span>
      <ChevronDown className="global-date-trigger__chevron" aria-hidden />
    </button>
  );

  if (variant === 'mobile') {
    return (
      <>
        {triggerButton}
        <MobileActionSheet
          open={isOpen}
          onClose={() => setIsOpen(false)}
          title="Rango Histórico"
          icon={<SheetIconBadge icon={CalendarIcon} tone="general" />}
          className="mobile-global-date-sheet"
        >
          <div className="mobile-filter-sheet__body">
            <DateRangePanelContent
              dateRange={dateRange}
              setDateRange={setDateRange}
              onClear={handleClear}
              onCancel={() => setIsOpen(false)}
              onApply={handleApply}
              applyDisabled={applyDisabled}
              applyMessage={applyMessage}
            />
          </div>
        </MobileActionSheet>
      </>
    );
  }

  return (
    <div className="global-date-picker relative" ref={popoverRef}>
      {triggerButton}
      {isOpen ? (
        <div data-popover-content className="global-date-panel app-popover absolute right-0 z-50 mt-2 w-72 p-4 animate-in fade-in slide-in-from-top-2">
          <DateRangePanelContent
            dateRange={dateRange}
            setDateRange={setDateRange}
            onClear={handleClear}
            onCancel={() => setIsOpen(false)}
            onApply={handleApply}
            applyDisabled={applyDisabled}
            applyMessage={applyMessage}
          />
        </div>
      ) : null}
    </div>
  );
}
