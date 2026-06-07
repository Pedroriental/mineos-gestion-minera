'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeFixedMenuPosition } from '@/lib/popover-position';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MENU_MAX_H = 280;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function normalizeTime(value?: string | null) {
  if (!value?.trim()) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
  return `${pad2(hour)}:${pad2(minute)}`;
}

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
  const [draftHour, setDraftHour] = useState(parsed?.hour ?? 0);
  const [draftMinute, setDraftMinute] = useState(parsed?.minute ?? 0);
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
      menuWidth: 260,
      estimatedHeight: 260,
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
    setDraftHour(next?.hour ?? 0);
    setDraftMinute(next?.minute ?? 0);
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
    onChange(`${pad2(draftHour)}:${pad2(draftMinute)}`);
    close();
  };

  const displayValue = parsed ? `${pad2(parsed.hour)}:${pad2(parsed.minute)}` : placeholder;

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
                {pad2(draftHour)}:{pad2(draftMinute)}
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

            <div className="grid grid-cols-2 gap-2">
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
                  {HOURS.map((hour) => {
                    const selected = hour === draftHour;
                    return (
                      <button
                        key={hour}
                        type="button"
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => setDraftHour(hour)}
                        className={cn(
                          'app-time-picker__option flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm tabular-nums transition-colors',
                          selected
                            ? 'bg-amber-500 font-semibold text-black'
                            : theme === 'light'
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-zinc-300 hover:bg-white/10',
                        )}
                      >
                        {pad2(hour)}
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
                        className={cn(
                          'app-time-picker__option flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm tabular-nums transition-colors',
                          selected
                            ? 'bg-amber-500 font-semibold text-black'
                            : theme === 'light'
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-zinc-300 hover:bg-white/10',
                        )}
                      >
                        {pad2(minute)}
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
                  setDraftHour(now.getHours());
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

export { normalizeTime as normalizeAppTimeValue };
