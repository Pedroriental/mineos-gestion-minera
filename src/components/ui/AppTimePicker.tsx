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
  theme,
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

  const menu =
    open && menuPos && mounted
      ? createPortal(
          <div
            id={`${id}-menu`}
            data-theme={theme}
            className={cn('app-time-picker__menu', menuPos.dropUp && 'app-time-picker__menu--up')}
            style={{
              position: 'fixed',
              left: menuPos.left,
              width: menuPos.width,
              top: menuPos.top,
              bottom: menuPos.bottom,
            }}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="app-time-picker__preview">{draftPreview}</span>
              <button type="button" onClick={applyDraft} className="app-time-picker__apply">
                Aplicar
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="app-time-picker__section-label">Hora</p>
                <div ref={hourListRef} className="app-time-picker__list">
                  {HOURS_12.map((hour) => {
                    const selected = hour === draftHour12;
                    return (
                      <button
                        key={hour}
                        type="button"
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => setDraftHour12(hour)}
                        className={cn(
                          'app-time-picker__option',
                          selected && 'app-time-picker__option--selected',
                        )}
                      >
                        {hour}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="app-time-picker__section-label">Min</p>
                <div ref={minuteListRef} className="app-time-picker__list">
                  {MINUTES.map((minute) => {
                    const selected = minute === draftMinute;
                    return (
                      <button
                        key={minute}
                        type="button"
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => setDraftMinute(minute)}
                        className={cn(
                          'app-time-picker__option',
                          selected && 'app-time-picker__option--selected',
                        )}
                      >
                        {pad2(minute)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="app-time-picker__section-label">Periodo</p>
                <div className="app-time-picker__list flex flex-col gap-1">
                  {MERIDIEMS.map((period) => {
                    const selected = period === draftPeriod;
                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setDraftPeriod(period)}
                        className={cn(
                          'app-time-picker__option',
                          selected && 'app-time-picker__option--selected',
                        )}
                      >
                        {period}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="app-time-picker__footer">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  close();
                }}
                className="app-time-picker__link"
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
                className="app-time-picker__link app-time-picker__link--accent"
              >
                Ahora
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn('app-time-picker block w-full min-w-0 max-w-full', className)}
      data-theme={theme}
    >
      <button
        id={id}
        type="button"
        disabled={disabled}
        className="app-time-picker__trigger"
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
      >
        <span
          className={cn(
            'app-time-picker__value min-w-0 truncate tabular-nums',
            !parsed && 'app-time-picker__placeholder',
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Clock className="app-time-picker__icon h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{displayValue}</span>
          </span>
        </span>
        <ChevronDown
          className={cn('app-time-picker__chevron h-4 w-4 shrink-0', open && 'app-time-picker__chevron--open')}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  );
}

export { normalizeTime as normalizeAppTimeValue, formatTime12h };
