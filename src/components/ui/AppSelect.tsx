'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppSelectOption = {
  readonly value: string;
  readonly label: string;
};

type AppSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly AppSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
};

const MENU_MAX_H = 224;

export function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  className,
  disabled,
  id: idProp,
}: AppSelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
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

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  const close = useCallback(() => {
    setOpen(false);
    setHighlightIndex(-1);
    setMenuPos(null);
  }, []);

  const updateMenuPos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estHeight = Math.min(MENU_MAX_H, Math.max(options.length, 1) * 38 + 12);
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const dropUp = spaceBelow < estHeight && spaceAbove > spaceBelow;

    setMenuPos({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MENU_MAX_H, dropUp ? spaceAbove : spaceBelow),
      dropUp,
      ...(dropUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, [options.length]);

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

  const pick = (next: string) => {
    onChange(next);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      pick(options[highlightIndex].value);
    }
  };

  const menu =
    open && menuPos && mounted ? (
      <ul
        id={`${id}-menu`}
        role="listbox"
        aria-labelledby={id}
        className={cn('app-select__menu app-select__menu--portal', menuPos.dropUp && 'app-select__menu--up')}
        style={{
          position: 'fixed',
          left: menuPos.left,
          width: menuPos.width,
          maxHeight: menuPos.maxHeight,
          top: menuPos.top,
          bottom: menuPos.bottom,
          zIndex: 10000,
        }}
      >
        {options.map((opt, index) => {
          const isSelected = opt.value === value;
          const isHighlighted = index === highlightIndex;
          return (
            <li
              key={opt.value || `opt-${index}`}
              role="option"
              aria-selected={isSelected}
              className={cn(
                'app-select__option',
                isSelected && 'app-select__option--selected',
                isHighlighted && 'app-select__option--active',
              )}
              onMouseEnter={() => setHighlightIndex(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(opt.value)}
            >
              {opt.label}
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className={cn('app-select', className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="app-select__trigger"
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        onKeyDown={onKeyDown}
      >
        <span className={cn('app-select__value truncate', !selected && 'app-select__placeholder')}>
          {label}
        </span>
        <ChevronDown
          className={cn('app-select__chevron h-4 w-4 shrink-0 opacity-60', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
