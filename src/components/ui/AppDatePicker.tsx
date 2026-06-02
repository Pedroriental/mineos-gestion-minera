'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parse, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { es } from 'date-fns/locale';

type AppDatePickerProps = {
  value: string; // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  theme?: 'light' | 'dark';
};

const MENU_MAX_H = 340;

const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

export function AppDatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className,
  disabled,
  id: idProp,
  theme = 'dark',
}: AppDatePickerProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  
  const parsedValue = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const initialDate = isValid(parsedValue) ? parsedValue! : new Date();

  // The month currently being viewed in the calendar
  const [viewDate, setViewDate] = useState<Date>(initialDate);

  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    dropUp: boolean;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setOpen(false);
    setMenuPos(null);
  }, []);

  const updateMenuPos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estHeight = 310;
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const dropUp = spaceBelow < estHeight && spaceAbove > spaceBelow;

    setMenuPos({
      left: rect.left,
      width: Math.max(rect.width, 280),
      maxHeight: Math.min(MENU_MAX_H, dropUp ? spaceAbove : spaceBelow),
      dropUp,
      ...(dropUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPos();
    const onReflow = () => updateMenuPos();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const menu = document.getElementById(`${id}-menu`);
      if (menu?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, id]);

  const pick = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    close();
  };

  const getDisplayValue = () => {
    if (!value) return placeholder;
    try {
      const d = parse(value, 'yyyy-MM-dd', new Date());
      if (!isValid(d)) return value;
      return format(d, 'dd MMM yyyy', { locale: es });
    } catch {
      return value;
    }
  };

  // Calendar Math
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = monthStart;
  const endDate = monthEnd;

  const dateFormat = "d";
  const days = eachDayOfInterval({
      start: startDate,
      end: endDate
  });

  // Calculate padding days for the first week
  const startDayOfWeek = getDay(monthStart); // 0 = Sunday
  const paddingDays = Array.from({ length: startDayOfWeek }).map((_, i) => i);

  const menu =
    open && menuPos && mounted ? createPortal(
      <div
        id={`${id}-menu`}
        className={cn(
          'z-[10000] rounded-xl border p-3 shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-100',
          theme === 'light' 
            ? 'border-slate-200 bg-white text-slate-900' 
            : 'border-white/10 bg-[#111113] text-white',
          menuPos.dropUp && 'slide-in-from-bottom-2'
        )}
        style={{
          position: 'fixed',
          left: menuPos.left,
          width: menuPos.width,
          top: menuPos.top,
          bottom: menuPos.bottom,
        }}
      >
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setViewDate(subMonths(viewDate, 1)); }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              theme === 'light' ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900" : "hover:bg-white/10 text-zinc-400 hover:text-zinc-100"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className={cn("text-sm font-semibold capitalize", theme === 'light' ? 'text-slate-800' : 'text-zinc-200')}>
            {format(viewDate, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setViewDate(addMonths(viewDate, 1)); }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              theme === 'light' ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900" : "hover:bg-white/10 text-zinc-400 hover:text-zinc-100"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className={cn("text-center text-[11px] font-bold", theme === 'light' ? 'text-slate-400' : 'text-zinc-500')}>
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {paddingDays.map((_, idx) => (
             <div key={`empty-${idx}`} className="h-8 w-full" />
          ))}
          {days.map((day, idx) => {
            const isSelected = parsedValue && isValid(parsedValue) ? isSameDay(day, parsedValue) : false;
            const isToday = isSameDay(day, new Date());
            
            return (
              <button
                key={day.toString()}
                type="button"
                onClick={(e) => { e.preventDefault(); pick(day); }}
                className={cn(
                  'flex h-8 w-full items-center justify-center rounded-md text-[13px] transition-all',
                  isSelected 
                    ? 'bg-amber-500 text-black font-semibold shadow-sm'
                    : isToday 
                      ? theme === 'light' 
                          ? 'bg-amber-50 text-amber-600 font-bold hover:bg-amber-100'
                          : 'bg-white/10 text-amber-400 font-bold hover:bg-white/20'
                      : theme === 'light'
                          ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                )}
              >
                {format(day, dateFormat)}
              </button>
            );
          })}
        </div>
        
        <div className={cn("mt-3 pt-3 flex justify-between items-center px-1 border-t", theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
             <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onChange('');
                  close();
                }}
                className={cn("text-xs font-medium", theme === 'light' ? 'text-slate-500 hover:text-slate-700' : 'text-zinc-500 hover:text-zinc-300')}
             >
                Limpiar
             </button>
             <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  pick(new Date());
                }}
                className={cn("text-xs font-medium", theme === 'light' ? 'text-amber-600 hover:text-amber-700' : 'text-amber-500 hover:text-amber-400')}
             >
                Hoy
             </button>
        </div>
      </div>,
      document.body
    ) : null;

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between gap-2 transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-amber-500/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          theme === 'light'
            ? 'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 hover:border-slate-300 focus:border-amber-500/50'
            : 'rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-200 focus:border-amber-500/50 hover:bg-white/10'
        )}
        onClick={() => {
          if (disabled) return;
          if (!open) {
            setViewDate(isValid(parsedValue) && parsedValue ? parsedValue : new Date());
          }
          setOpen((o) => !o);
        }}
      >
        <span className={cn("truncate capitalize flex items-center gap-2", !value && (theme === 'light' ? "text-slate-400" : "text-zinc-400"))}>
            <CalendarIcon className={cn("h-4 w-4", theme === 'light' ? "text-amber-500/80" : "text-amber-500/70")} />
            {getDisplayValue()}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform',
            open && 'rotate-180',
            theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
          )}
        />
      </button>
      {menu}
    </div>
  );
}
