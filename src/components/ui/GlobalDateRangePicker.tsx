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
  isThemedShell,
}: {
  dateRange: { from: string; to: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
  isThemedShell: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label
          className={cn(
            'mb-1 block text-[10px] font-bold uppercase tracking-wider',
            isThemedShell ? 'text-[var(--dashboard-text-muted)]' : 'text-white/50',
          )}
        >
          Desde
        </label>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none',
            isThemedShell
              ? 'border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] text-[var(--dashboard-text)] focus:border-[var(--dashboard-accent)]/50'
              : 'border-zinc-800 bg-zinc-900 text-white focus:border-amber-500/50',
          )}
          style={{ colorScheme: isThemedShell ? 'dark' : undefined }}
        />
      </div>
      <div>
        <label
          className={cn(
            'mb-1 block text-[10px] font-bold uppercase tracking-wider',
            isThemedShell ? 'text-[var(--dashboard-text-muted)]' : 'text-white/50',
          )}
        >
          Hasta
        </label>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none',
            isThemedShell
              ? 'border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] text-[var(--dashboard-text)] focus:border-[var(--dashboard-accent)]/50'
              : 'border-zinc-800 bg-zinc-900 text-white focus:border-amber-500/50',
          )}
          style={{ colorScheme: isThemedShell ? 'dark' : undefined }}
        />
      </div>
    </div>
  );
}

function DateRangeActions({
  isThemedShell,
  onClear,
  onCancel,
  onApply,
}: {
  isThemedShell: boolean;
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <button
        type="button"
        onClick={onClear}
        className={cn(
          'px-3 py-1.5 text-xs font-semibold transition-colors',
          isThemedShell
            ? 'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]'
            : 'text-white/50 hover:text-white/80',
        )}
      >
        Limpiar
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold transition-colors',
            isThemedShell
              ? 'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]'
              : 'text-white/50 hover:text-white/80',
          )}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onApply}
          className={cn(
            'rounded-md px-4 py-1.5 text-xs font-bold transition-colors',
            isThemedShell
              ? 'bg-[var(--dashboard-accent)] text-[#0a0a0a] hover:opacity-90'
              : 'bg-amber-600 text-black hover:bg-amber-500',
          )}
        >
          Aplicar Rango
        </button>
      </div>
    </div>
  );
}

export default function GlobalDateRangePicker({ variant = 'default' }: GlobalDateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isThemedShell = pathname !== '/';

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useCloseOnRouteChange(() => setIsOpen(false));

  // Parse URLs
  const fromParam = searchParams.get('desde');
  const toParam = searchParams.get('hasta');

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dateRange, setDateRange] = useState({
    from: fromParam || format(firstDay, 'yyyy-MM-dd'),
    to: toParam || format(today, 'yyyy-MM-dd')
  });

  // Sync state if URL changes externally
  useEffect(() => {
    if (fromParam) setDateRange(prev => ({ ...prev, from: fromParam }));
    if (toParam) setDateRange(prev => ({ ...prev, to: toParam }));
  }, [fromParam, toParam]);

  // Handle outside click
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

  if (variant === 'mobile') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            'mobile-shell__header-date',
            hasCustomRange && 'mobile-shell__header-date--active',
          )}
          aria-label={`Rango histórico: ${label}`}
        >
          <CalendarIcon className="mobile-shell__header-date__icon" aria-hidden />
          <span className="mobile-shell__header-date__label capitalize">{label}</span>
          <ChevronDown className="mobile-shell__header-date__chevron" aria-hidden />
        </button>

        <MobileActionSheet
          open={isOpen}
          onClose={() => setIsOpen(false)}
          title="Rango Histórico"
          icon={<SheetIconBadge icon={CalendarIcon} />}
          className="mobile-global-date-sheet"
        >
          <div className="mobile-filter-sheet__body space-y-4">
            <DateRangeFields
              dateRange={dateRange}
              setDateRange={setDateRange}
              isThemedShell={isThemedShell}
            />
            <DateRangeActions
              isThemedShell={isThemedShell}
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
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'hidden sm:flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors',
          isThemedShell
            ? 'border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] hover:border-[var(--dashboard-accent)]/35'
            : 'border-zinc-800 bg-zinc-900 text-white/90 hover:border-zinc-700',
        )}
      >
        <CalendarIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            isThemedShell ? 'text-[var(--dashboard-accent)]' : 'text-amber-500',
          )}
        />
        <span
          className={cn(
            'whitespace-nowrap font-medium capitalize',
            isThemedShell ? 'text-[var(--dashboard-text-muted)]' : 'text-zinc-300',
          )}
        >
          {label}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            isOpen && 'rotate-180',
            isThemedShell ? 'text-[var(--dashboard-text-muted)]' : 'text-white/40',
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 z-50 mt-2 w-72 rounded-xl border p-4 shadow-2xl animate-in fade-in slide-in-from-top-2',
            isThemedShell
              ? 'border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)]'
              : 'border-zinc-800 bg-zinc-950',
          )}
        >
          <div className="space-y-4">
            <h4
              className={cn(
                'border-b pb-2 text-sm font-bold',
                isThemedShell
                  ? 'border-[var(--dashboard-border)] text-[var(--dashboard-text)]'
                  : 'border-zinc-800 text-white/90',
              )}
            >
              Rango Histórico
            </h4>
            <DateRangeFields
              dateRange={dateRange}
              setDateRange={setDateRange}
              isThemedShell={isThemedShell}
            />
            <DateRangeActions
              isThemedShell={isThemedShell}
              onClear={handleClear}
              onCancel={() => setIsOpen(false)}
              onApply={handleApply}
            />
          </div>
        </div>
      )}
    </div>
  );
}
