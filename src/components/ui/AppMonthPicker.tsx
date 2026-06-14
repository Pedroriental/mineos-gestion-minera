'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeFixedMenuPosition } from '@/lib/popover-position';
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

type MonthPickerView = 'months' | 'years';

const MENU_MAX_H = 320;

const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
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
  const [pickerView, setPickerView] = useState<MonthPickerView>('months');

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
    setPickerView('months');
  }, []);

  const updateMenuPos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pos = computeFixedMenuPosition({
      anchorRect: rect,
      menuWidth: 280,
      estimatedHeight: pickerView === 'years' ? 220 : 260,
      maxHeightCap: MENU_MAX_H,
    });
    setMenuPos(pos);
  }, [pickerView]);

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
  }, [open, updateMenuPos, pickerView]);

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

  const navBtn = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100';
  const navBtnJump = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200';

  const decadeStart = Math.floor(viewYear / 10) * 10;
  const yearOptions = Array.from({ length: 12 }, (_, i) => decadeStart + i);

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
        {pickerView === 'years' ? (
          <>
            <div className="mb-3 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setViewYear((y) => y - 10); }}
                className={navBtnJump}
                title="10 años atrás"
                aria-label="10 años atrás"
              >
                «
              </button>
              <span className="text-sm font-semibold tabular-nums text-zinc-200">
                {decadeStart} – {decadeStart + 11}
              </span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setViewYear((y) => y + 10); }}
                className={navBtnJump}
                title="10 años adelante"
                aria-label="10 años adelante"
              >
                »
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {yearOptions.map((year) => {
                const isSelected = year === selectedYear;
                const isCurrent = year === new Date().getFullYear();
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setViewYear(year);
                      setPickerView('months');
                    }}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-all',
                      isSelected
                        ? 'border border-amber-500/30 bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white',
                      isCurrent && !isSelected && 'ring-1 ring-amber-500/25',
                    )}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-1 px-1">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setViewYear((y) => y - 10); }}
                className={navBtnJump}
                title="10 años atrás"
                aria-label="10 años atrás"
              >
                «
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setViewYear((y) => y - 1); }}
                className={navBtn}
                title="Año anterior"
                aria-label="Año anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setPickerView('years');
                }}
                className="min-w-[4.5rem] rounded-md px-2 py-1 text-sm font-semibold tabular-nums text-zinc-200 transition-colors hover:bg-white/10"
                title="Elegir año"
              >
                {viewYear}
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setViewYear((y) => y + 1); }}
                className={navBtn}
                title="Año siguiente"
                aria-label="Año siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setViewYear((y) => y + 10); }}
                className={navBtnJump}
                title="10 años adelante"
                aria-label="10 años adelante"
              >
                »
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((mon, idx) => {
                const isSelected = viewYear === selectedYear && idx === selectedMonthIndex;
                const isCurrent =
                  viewYear === new Date().getFullYear() && idx === new Date().getMonth();
                return (
                  <button
                    key={mon}
                    type="button"
                    onClick={(e) => { e.preventDefault(); pick(idx); }}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-all',
                      isSelected
                        ? 'border border-amber-500/30 bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white',
                      isCurrent && !isSelected && 'ring-1 ring-amber-500/25',
                    )}
                  >
                    {mon}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          {pickerView === 'years' ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setPickerView('months');
              }}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
            >
              Ver meses
            </button>
          ) : (
            <span />
          )}
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
            setPickerView('months');
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
