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
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
          className="input-field"
        />
      </div>
      <div>
        <label className="input-label">Hasta</label>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
          className="input-field"
        />
      </div>
    </div>
  );
}

function DateRangeActions({
  onClear,
  onCancel,
  onApply,
  className,
}: {
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
  className?: string;
}) {
  return (
    <div className={cn('global-date-panel__actions flex items-center justify-between gap-2 pt-1', className)}>
      <button type="button" onClick={onClear} className="btn-secondary !h-8 px-3 text-xs">
        Limpiar
      </button>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary !h-8 px-3 text-xs">
          Cancelar
        </button>
        <button type="button" onClick={onApply} className="btn-primary !h-8 px-4 text-xs">
          Aplicar Rango
        </button>
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
}: {
  dateRange: { from: string; to: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  return (
    <div className="global-date-panel__body space-y-4">
      <h4 className="global-date-panel__title">Rango Histórico</h4>
      <DateRangeFields dateRange={dateRange} setDateRange={setDateRange} />
      <DateRangeActions onClear={onClear} onCancel={onCancel} onApply={onApply} />
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
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApply = () => {
    setIsOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('desde', dateRange.from);
    params.set('hasta', dateRange.to);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const label = formatDateLabel(fromParam, toParam);
  const hasCustomRange = Boolean(fromParam && toParam);

  const handleClear = () => {
    setIsOpen(false);
    router.push(pathname, { scroll: false });
  };

  const triggerClassName = cn(
    'global-date-trigger',
    variant === 'mobile' && 'mobile-shell__header-date',
    (isOpen || hasCustomRange) && 'global-date-trigger--active',
    isOpen && 'global-date-trigger--open',
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
        <div className="global-date-panel app-popover absolute right-0 z-50 mt-2 w-72 p-4 animate-in fade-in slide-in-from-top-2">
          <DateRangePanelContent
            dateRange={dateRange}
            setDateRange={setDateRange}
            onClear={handleClear}
            onCancel={() => setIsOpen(false)}
            onApply={handleApply}
          />
        </div>
      ) : null}
    </div>
  );
}
