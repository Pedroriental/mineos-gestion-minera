'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCloseOnRouteChange } from '@/hooks/useCloseOnRouteChange';
import { AppDatePicker } from '@/components/ui/AppDatePicker';

export default function GlobalDateRangePicker() {
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

  const formatDateLabel = () => {
    if (!fromParam || !toParam) return 'Histórico General';
    
    try {
      const fromD = parseISO(fromParam);
      const toD = parseISO(toParam);
      if (isValid(fromD) && isValid(toD)) {
        return `${format(fromD, 'dd MMM', { locale: es })} - ${format(toD, 'dd MMM yyyy', { locale: es })}`;
      }
    } catch (e) {}
    return 'Histórico General';
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button 
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
          {formatDateLabel()}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            isOpen && 'rotate-180',
            isThemedShell ? 'text-[var(--dashboard-text-muted)]' : 'text-white/40',
          )}
        />
      </button>

      {/* Popover Content */}
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
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
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
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
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

            <div className="pt-2 flex items-center justify-between gap-2">
              <button 
                onClick={() => {
                  setIsOpen(false);
                  router.push(pathname, { scroll: false }); // Reset to Histórico
                }}
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
                  onClick={() => setIsOpen(false)}
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
                  onClick={handleApply}
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
          </div>
        </div>
      )}
    </div>
  );
}
