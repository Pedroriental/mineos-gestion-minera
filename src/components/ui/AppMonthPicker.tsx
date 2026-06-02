'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

type AppMonthPickerProps = {
  value: string; // 'YYYY-MM'
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
};

const MENU_MAX_H = 300;

const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export function AppMonthPicker({
  value,
  onChange,
  placeholder = 'Mes',
  className,
  disabled,
  id: idProp,
}: AppMonthPickerProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  
  // Parse initial value for internal state
  const [viewYear, setViewYear] = useState(() => {
    if (value && value.length >= 4) return parseInt(value.substring(0, 4), 10);
    return new Date().getFullYear();
  });

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
    const estHeight = 240; // Approx height of our picker
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const dropUp = spaceBelow < estHeight && spaceAbove > spaceBelow;

    setMenuPos({
      left: rect.left,
      width: Math.max(rect.width, 240), // minimum width for picker
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

  const pick = (monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, '0');
    onChange(`${viewYear}-${mm}`);
    close();
  };

  const getDisplayValue = () => {
    if (!value) return placeholder;
    try {
      const d = parse(value, 'yyyy-MM', new Date());
      return format(d, 'MMMM yyyy', { locale: es });
    } catch {
      return value;
    }
  };

  const selectedYear = value ? parseInt(value.substring(0, 4), 10) : null;
  const selectedMonthIndex = value ? parseInt(value.substring(5, 7), 10) - 1 : null;

  const menu =
    open && menuPos && mounted ? createPortal(
      <div
        id={`${id}-menu`}
        className={cn(
          'z-[10000] rounded-xl border border-white/10 bg-[#111113] p-3 shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-100',
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
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setViewYear(y => y - 1); }}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-zinc-200">{viewYear}</span>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setViewYear(y => y + 1); }}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((mon, idx) => {
            const isSelected = viewYear === selectedYear && idx === selectedMonthIndex;
            return (
              <button
                key={mon}
                type="button"
                onClick={(e) => { e.preventDefault(); pick(idx); }}
                className={cn(
                  'flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-all',
                  isSelected 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                )}
              >
                {mon}
              </button>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
             <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const today = new Date();
                  onChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
                  close();
                }}
                className="text-xs font-medium text-amber-500 hover:text-amber-400"
             >
                Este mes
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
          'flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-200 transition-colors',
          'focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50',
          'disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white/10'
        )}
        onClick={() => {
          if (disabled) return;
          if (!open) {
            if (value && value.length >= 4) {
              setViewYear(parseInt(value.substring(0, 4), 10));
            } else {
              setViewYear(new Date().getFullYear());
            }
          }
          setOpen((o) => !o);
        }}
      >
        <span className="truncate capitalize flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500/70" />
            {getDisplayValue()}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-zinc-500 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {menu}
    </div>
  );
}
