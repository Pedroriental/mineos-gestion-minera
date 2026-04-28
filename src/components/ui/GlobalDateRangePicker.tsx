'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

export default function GlobalDateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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
    try {
      const fromD = parseISO(dateRange.from);
      const toD = parseISO(dateRange.to);
      if (isValid(fromD) && isValid(toD)) {
        return `${format(fromD, 'dd MMM', { locale: es })} - ${format(toD, 'dd MMM yyyy', { locale: es })}`;
      }
    } catch (e) {}
    return 'Seleccionar fechas';
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white/90 text-xs px-3 py-1.5 rounded-lg transition-colors"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="capitalize font-medium text-zinc-300 whitespace-nowrap">{formatDateLabel()}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Content */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-4">
            <h4 className="text-white/90 font-bold text-sm border-b border-zinc-800 pb-2">Rango Histórico</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Desde</label>
                <input 
                  type="date" 
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Hasta</label>
                <input 
                  type="date" 
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white/80 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleApply}
                className="bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs px-4 py-1.5 rounded-md transition-colors"
              >
                Aplicar Rango
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
