'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { AppSelectOption } from './AppSelect';

type AppComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
};

const MENU_MAX_H = 240;

export function AppCombobox({
  value,
  onChange,
  options,
  placeholder = 'Escribe o selecciona…',
  className,
  disabled,
  id: idProp,
}: AppComboboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    dropUp: boolean;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, value]);

  const close = useCallback(() => {
    setOpen(false);
    setHighlightIndex(-1);
    setMenuPos(null);
  }, []);

  const updateMenuPos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const count = Math.max(filtered.length, 1);
    const estHeight = Math.min(MENU_MAX_H, count * 38 + 12);
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
  }, [filtered.length]);

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
  }, [open, updateMenuPos, filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const menu = document.getElementById(`${id}-menu`);
      if (menu?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close, id]);

  const pick = (next: string) => {
    onChange(next);
    close();
  };

  const menu =
    open && menuPos && mounted && filtered.length > 0 ? (
      <ul
        id={`${id}-menu`}
        role="listbox"
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
        {filtered.map((opt, index) => {
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
              onTouchStart={(e) => {
                e.preventDefault();
                pick(opt.value);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(opt.value);
              }}
              onClick={() => pick(opt.value)}
            >
              {opt.label}
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className={cn('app-combobox', className)}>
      <input
        id={id}
        type="text"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="app-combobox__input"
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Escape') {
            close();
            return;
          }
          if (!open || filtered.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && highlightIndex >= 0) {
            e.preventDefault();
            pick(filtered[highlightIndex].value);
          }
        }}
      />
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
