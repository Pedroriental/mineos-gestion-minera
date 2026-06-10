'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeFixedMenuPosition } from '@/lib/popover-position';
import {
  formatTime12h,
  from24h,
  HOURS_12,
  MERIDIEMS,
  normalizeTime,
  pad2,
  to24h,
  type Meridiem,
} from '@/lib/format-time';

const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MENU_MAX_H = 300;

function parseTime(value: string) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return { hour: h, minute: m };
}

type AppTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  theme?: 'light' | 'dark';
};

export function AppTimePicker({
  value,
  onChange,
  placeholder = 'Seleccionar hora',
  className,
  disabled,
  id: idProp,
  theme = 'dark',
}: AppTimePickerProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const parsed = parseTime(value);
  const [open, setOpen] = useState(false);
  const [draftHour12, setDraftHour12] = useState(12);
  const [draftMinute, setDraftMinute] = useState(0);
  const [draftPeriod, setDraftPeriod] = useState<Meridiem>('AM');
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
    const pos = computeFixedMenuPosition({
      anchorRect: rect,
      menuWidth: 300,
      estimatedHeight: 300,
      maxHeightCap: MENU_MAX_H,
      centerHorizontally: true,
    });
    setMenuPos(pos);
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

  useEffect(() => {
    if (!open) return;
    const next = parseTime(value);
    if (next) {
      const { hour12, period } = from24h(next.hour);
      setDraftHour12(hour12);
      setDraftPeriod(period);
      setDraftMinute(next.minute);
    } else {
      setDraftHour12(12);
      setDraftPeriod('AM');
      setDraftMinute(0);
    }
    requestAnimationFrame(() => {
      hourListRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center' });
      minuteListRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center' });
    });
  }, [open, value]);

  const applyDraft = () => {
    const hour24 = to24h(draftHour12, draftPeriod);
    onChange(`${pad2(hour24)}:${pad2(draftMinute)}`);
    close();
  };

  const draftPreview = `${draftHour12}:${pad2(draftMinute)} ${draftPeriod}`;
  const displayValue = parsed ? formatTime12h(value) : placeholder;

  const optionClass = (selected: boolean) =>
    cn(
      'app-time-picker__option flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm tabular-nums transition-colors',
      selected
        ? 'bg-amber-500 font-semibold text-black'
        : theme === 'light'
          ? 'text-slate-600 hover:bg-slate-100'
          : 'text-zinc-300 hover:bg-white/10',
    );

  const menu =
    open && menuPos && mounted
      ? createPortal(
          <div
            id={`${id}-menu`}
            className={cn(
              'app-time-picker__menu z-[10000] rounded-xl border p-3 shadow-2xl',
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
            <div className="mb-3 flex items-center justify-between px-1">
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  theme === 'light' ? 'text-slate-800' : 'text-zinc-200',
                )}
              >
                {draftPreview}
              </span>
              <button
                type="button"
                onClick={applyDraft}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-semibold',
                  theme === 'light'
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'bg-amber-500 text-black hover:bg-amber-400',
                )}
              >
                Aplicar
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <p
                  className={cn(
                    'mb-1 px-1 text-[10px] font-bold uppercase tracking-wider',
                    theme === 'light' ? 'text-slate-400' : 'text-zinc-500',
                  )}
                >
                  Hora
                </p>
                <div
                  ref={hourListRef}
                  className={cn(
                    'app-time-picker__list max-h-40 overflow-y-auto rounded-lg border p-1',
                    theme === 'light' ? 'border-slate-200' : 'border-white/10',
                  )}
                >
                  {HOURS_12.map((hour) => {
                    const selected = hour === draftHour12;
                    return (
                      <button
                        key={hour}
                        type="button"
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => setDraftHour12(hour)}
                        className={optionClass(selected)}
                      >
                        {hour}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p
                  className={cn(
                    'mb-1 px-1 text-[10px] font-bold uppercase tracking-wider',
                    theme === 'light' ? 'text-slate-400' : 'text-zinc-500',
                  )}
                >
                  Min
                </p>
                <div
                  ref={minuteListRef}
                  className={cn(
                    'app-time-picker__list max-h-40 overflow-y-auto rounded-lg border p-1',
                    theme === 'light' ? 'border-slate-200' : 'border-white/10',
                  )}
                >
                  {MINUTES.map((minute) => {
                    const selected = minute === draftMinute;
                    return (
                      <button
                        key={minute}
                        type="button"
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => setDraftMinute(minute)}
                        className={optionClass(selected)}
                      >
                        {pad2(minute)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p
                  className={cn(
                    'mb-1 px-1 text-[10px] font-bold uppercase tracking-wider',
                    theme === 'light' ? 'text-slate-400' : 'text-zinc-500',
                  )}
                >
                  Periodo
                </p>
                <div
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-1',
                    theme === 'light' ? 'border-slate-200' : 'border-white/10',
                  )}
                >
                  {MERIDIEMS.map((period) => {
                    const selected = period === draftPeriod;
                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setDraftPeriod(period)}
                        className={optionClass(selected)}
                      >
                        {period}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className={cn(
                'mt-3 flex items-center justify-between border-t px-1 pt-3',
                theme === 'light' ? 'border-slate-100' : 'border-white/10',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  close();
                }}
                className={cn(
                  'text-xs font-medium',
                  theme === 'light' ? 'text-slate-500 hover:text-slate-700' : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const { hour12, period } = from24h(now.getHours());
                  setDraftHour12(hour12);
                  setDraftPeriod(period);
                  setDraftMinute(now.getMinutes());
                }}
                className={cn(
                  'text-xs font-medium',
                  theme === 'light' ? 'text-amber-600 hover:text-amber-700' : 'text-amber-500 hover:text-amber-400',
                )}
              >
                Ahora
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn('app-time-picker block w-full min-w-0 max-w-full', className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          'app-time-picker__trigger box-border flex w-full max-w-full min-w-0 items-center justify-between gap-2 transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-amber-500/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          theme === 'light'
            ? 'rounded-lg border border-slate-200 bg-white text-sm text-slate-900 hover:border-slate-300 focus:border-amber-500/50'
            : 'rounded-xl border border-white/10 bg-white/5 text-sm text-zinc-200 focus:border-amber-500/50 hover:bg-white/10',
        )}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
      >
        <span
          className={cn(
            'app-time-picker__value min-w-0 flex-1 truncate text-left tabular-nums',
            !parsed && (theme === 'light' ? 'text-slate-400' : 'text-zinc-400'),
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Clock
              className={cn('h-4 w-4 shrink-0', theme === 'light' ? 'text-amber-500/80' : 'text-amber-500/70')}
            />
            <span className="truncate">{displayValue}</span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform',
            open && 'rotate-180',
            theme === 'light' ? 'text-slate-400' : 'text-zinc-500',
          )}
        />
      </button>
      {menu}
    </div>
  );
}

export { normalizeTime as normalizeAppTimeValue, formatTime12h };
