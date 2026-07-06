'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeFixedMenuPosition } from '@/lib/popover-position';
import { useTheme } from '@/lib/theme-context';
import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  setMonth,
  setYear,
} from 'date-fns';
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

type CalendarView = 'days' | 'months' | 'years';

const MENU_MAX_H = 360;

const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export function AppDatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className,
  disabled,
  id: idProp,
  theme: themeProp,
}: AppDatePickerProps) {
  const { theme: contextTheme } = useTheme();
  const theme = themeProp ?? contextTheme;
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('days');

  const parsedValue = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const initialDate = isValid(parsedValue) ? parsedValue! : new Date();

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
    setCalendarView('days');
  }, []);

  const updateMenuPos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pos = computeFixedMenuPosition({
      anchorRect: rect,
      menuWidth: 300,
      estimatedHeight: calendarView === 'days' ? 310 : 280,
      maxHeightCap: MENU_MAX_H,
      centerHorizontally: true,
    });
    setMenuPos(pos);
  }, [calendarView]);

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
  }, [open, updateMenuPos, calendarView]);

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

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const selectedYear = parsedValue && isValid(parsedValue) ? parsedValue.getFullYear() : null;
  const selectedMonth = parsedValue && isValid(parsedValue) ? parsedValue.getMonth() : null;

  const navBtn = cn(
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
    theme === 'light'
      ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100',
  );

  const navBtnJump = cn(
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold transition-colors',
    theme === 'light'
      ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
      : 'text-zinc-500 hover:bg-white/10 hover:text-zinc-200',
  );

  const tileBtn = (active: boolean) =>
    cn(
      'flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-all',
      active
        ? 'border border-amber-500/30 bg-amber-500/20 font-semibold text-amber-500'
        : theme === 'light'
          ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          : 'text-zinc-300 hover:bg-white/10 hover:text-white',
    );

  const monthStart = startOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) });
  const startDayOfWeek = getDay(monthStart);
  const paddingDays = Array.from({ length: startDayOfWeek }).map((_, i) => i);

  const decadeStart = Math.floor(viewYear / 10) * 10;
  const yearOptions = Array.from({ length: 12 }, (_, i) => decadeStart + i);

  const renderHeader = () => {
    if (calendarView === 'years') {
      return (
        <div className="mb-3 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setViewDate(setYear(viewDate, viewYear - 10));
            }}
            className={navBtnJump}
            title="10 años atrás"
            aria-label="10 años atrás"
          >
            «
          </button>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              theme === 'light' ? 'text-slate-800' : 'text-zinc-200',
            )}
          >
            {decadeStart} – {decadeStart + 11}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setViewDate(setYear(viewDate, viewYear + 10));
            }}
            className={navBtnJump}
            title="10 años adelante"
            aria-label="10 años adelante"
          >
            »
          </button>
        </div>
      );
    }

    if (calendarView === 'months') {
      return (
        <div className="mb-3 flex items-center justify-between gap-1 px-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setViewDate(setYear(viewDate, viewYear - 10));
            }}
            className={navBtnJump}
            title="10 años atrás"
            aria-label="10 años atrás"
          >
            «
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setViewDate(setYear(viewDate, viewYear - 1));
            }}
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
              setCalendarView('years');
            }}
            className={cn(
              'min-w-[4.5rem] rounded-md px-2 py-1 text-sm font-semibold tabular-nums transition-colors',
              theme === 'light'
                ? 'text-slate-800 hover:bg-slate-100'
                : 'text-zinc-200 hover:bg-white/10',
            )}
            title="Elegir año"
          >
            {viewYear}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setViewDate(setYear(viewDate, viewYear + 1));
            }}
            className={navBtn}
            title="Año siguiente"
            aria-label="Año siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setViewDate(setYear(viewDate, viewYear + 10));
            }}
            className={navBtnJump}
            title="10 años adelante"
            aria-label="10 años adelante"
          >
            »
          </button>
        </div>
      );
    }

    return (
      <div className="mb-4 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setViewDate(subMonths(viewDate, 1));
          }}
          className={navBtn}
          title="Mes anterior"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setCalendarView('months');
          }}
          className={cn(
            'rounded-md px-2 py-1 text-sm font-semibold capitalize transition-colors',
            theme === 'light'
              ? 'text-slate-800 hover:bg-slate-100'
              : 'text-zinc-200 hover:bg-white/10',
          )}
          title="Elegir mes y año"
        >
          {format(viewDate, 'MMMM yyyy', { locale: es })}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setViewDate(addMonths(viewDate, 1));
          }}
          className={navBtn}
          title="Mes siguiente"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const menu =
    open && menuPos && mounted
      ? createPortal(
          <div
            id={`${id}-menu`}
            data-popover-content
            className={cn(
              'z-[10000] rounded-xl border p-3 shadow-2xl',
              'animate-in fade-in zoom-in-95 duration-100',
              theme === 'light'
                ? 'border-slate-200 bg-white text-slate-900'
                : 'border-white/10 bg-[#111113] text-white',
              menuPos.dropUp && 'slide-in-from-bottom-2',
            )}
            style={{
              position: 'fixed',
              left: menuPos.left,
              width: menuPos.width,
              top: menuPos.top,
              bottom: menuPos.bottom,
            }}
          >
            {renderHeader()}

            {calendarView === 'years' ? (
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
                        setViewDate(setYear(viewDate, year));
                        setCalendarView('months');
                      }}
                      className={cn(
                        tileBtn(isSelected),
                        isCurrent && !isSelected && 'ring-1 ring-amber-500/25',
                      )}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            ) : calendarView === 'months' ? (
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((mon, idx) => {
                  const isSelected = viewYear === selectedYear && idx === selectedMonth;
                  const isCurrent =
                    viewYear === new Date().getFullYear() && idx === new Date().getMonth();
                  return (
                    <button
                      key={mon}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setViewDate(setMonth(setYear(viewDate, viewYear), idx));
                        setCalendarView('days');
                      }}
                      className={cn(
                        tileBtn(isSelected),
                        isCurrent && !isSelected && 'ring-1 ring-amber-500/25',
                      )}
                    >
                      {mon}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className={cn(
                        'text-center text-[11px] font-bold',
                        theme === 'light' ? 'text-slate-400' : 'text-zinc-500',
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {paddingDays.map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-8 w-full" />
                  ))}
                  {days.map((day) => {
                    const isSelected =
                      parsedValue && isValid(parsedValue) ? isSameDay(day, parsedValue) : false;
                    const isToday = isSameDay(day, new Date());

                    return (
                      <button
                        key={day.toString()}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          pick(day);
                        }}
                        className={cn(
                          'flex h-8 w-full items-center justify-center rounded-md text-[13px] transition-all',
                          isSelected
                            ? 'bg-amber-500 font-semibold text-black shadow-sm'
                            : isToday
                              ? theme === 'light'
                                ? 'bg-amber-50 font-bold text-amber-600 hover:bg-amber-100'
                                : 'bg-white/10 font-bold text-amber-400 hover:bg-white/20'
                              : theme === 'light'
                                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                : 'text-zinc-300 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div
              className={cn(
                'mt-3 flex items-center justify-between border-t px-1 pt-3',
                theme === 'light' ? 'border-slate-100' : 'border-white/10',
              )}
            >
              {calendarView !== 'days' ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setCalendarView('days');
                  }}
                  className={cn(
                    'text-xs font-medium',
                    theme === 'light'
                      ? 'text-slate-500 hover:text-slate-700'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  Ver días
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onChange('');
                    close();
                  }}
                  className={cn(
                    'text-xs font-medium',
                    theme === 'light'
                      ? 'text-slate-500 hover:text-slate-700'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (calendarView === 'days') {
                    pick(new Date());
                    return;
                  }
                  const today = new Date();
                  setViewDate(today);
                  setCalendarView('days');
                }}
                className={cn(
                  'text-xs font-medium',
                  theme === 'light'
                    ? 'text-amber-600 hover:text-amber-700'
                    : 'text-amber-500 hover:text-amber-400',
                )}
              >
                {calendarView === 'days' ? 'Hoy' : 'Mes actual'}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn('app-date-picker block w-full min-w-0 max-w-full', className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          'app-date-picker__trigger',
          theme === 'light' && 'app-date-picker__trigger--light',
        )}
        onClick={() => {
          if (disabled) return;
          if (!open) {
            setViewDate(isValid(parsedValue) && parsedValue ? parsedValue : new Date());
            setCalendarView('days');
          }
          setOpen((o) => !o);
        }}
      >
        <span
          className={cn(
            'app-date-picker__value min-w-0 flex-1 truncate text-left capitalize',
            !value && 'app-date-picker__placeholder',
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <CalendarIcon className="app-date-picker__icon h-4 w-4 shrink-0" />
            <span className="truncate">{getDisplayValue()}</span>
          </span>
        </span>
        <ChevronDown
          className={cn('app-date-picker__chevron h-4 w-4 shrink-0', open && 'app-date-picker__chevron--open')}
        />
      </button>
      {menu}
    </div>
  );
}
