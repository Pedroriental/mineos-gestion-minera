'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeFixedMenuPosition, isMobileViewport } from '@/lib/popover-position';

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
  theme?: 'light' | 'dark';
  menuClassName?: string;
  /** En móvil abre anclado al botón hacia arriba (filtros en sheets). */
  anchorMenu?: boolean;
};

const MENU_MAX_H = 224;

type MenuPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  dropUp: boolean;
};

export function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  className,
  disabled,
  id: idProp,
  theme,
  menuClassName,
  anchorMenu = false,
}: AppSelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuListRef = useRef<HTMLUListElement>(null);
  const menuPosRef = useRef<MenuPosition | null>(null);
  const menuTouchRef = useRef({ startY: 0, startScrollTop: 0, scrolling: false });
  const openedAtRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  const close = useCallback(() => {
    setOpen(false);
    setHighlightIndex(-1);
    setMenuPos(null);
    menuPosRef.current = null;
  }, []);

  const updateMenuPos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mobile = isMobileViewport();
    const useAnchor = anchorMenu || mobile;
    const rowH = 38;
    const listHeight = Math.max(options.length, 1) * rowH + 12;
    const maxCap = mobile
      ? Math.min(window.innerHeight * 0.52, Math.max(MENU_MAX_H, listHeight))
      : MENU_MAX_H;
    const estimatedHeight = Math.min(maxCap, listHeight);
    const menuWidth = useAnchor
      ? Math.min(Math.max(rect.width, 200), window.innerWidth - 24)
      : Math.max(rect.width, 200);

    const pos = computeFixedMenuPosition({
      anchorRect: rect,
      menuWidth,
      estimatedHeight,
      maxHeightCap: maxCap,
      centerOnMobile: !useAnchor,
      preferDropUp: useAnchor,
    });
    menuPosRef.current = pos;
    setMenuPos(pos);
  }, [anchorMenu, options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    menuTouchRef.current = { startY: 0, startScrollTop: 0, scrolling: false };
    updateMenuPos();
    const onReflow = () => updateMenuPos();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, updateMenuPos, anchorMenu]);

  const shouldPickOption = () => !menuTouchRef.current.scrolling;

  useEffect(() => {
    if (!open) return;
    openedAtRef.current = Date.now();
    const onDoc = (e: MouseEvent) => {
      if (Date.now() - openedAtRef.current < 320) return;
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuListRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', onDoc, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const pick = (next: string) => {
    onChange(next);
    close();
  };

  const openMenu = useCallback(() => {
    updateMenuPos();
    setOpen(true);
  }, [updateMenuPos]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) close();
      else openMenu();
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

  const resolvedMenuPos = menuPos ?? menuPosRef.current;

  const menu =
    open && resolvedMenuPos && mounted ? (
      <ul
        ref={menuListRef}
        id={`${id}-menu`}
        role="listbox"
        aria-labelledby={id}
        data-theme={theme}
        className={cn(
          'app-select__menu app-select__menu--portal',
          resolvedMenuPos.dropUp && 'app-select__menu--up',
          menuClassName,
        )}
        style={{
          position: 'fixed',
          left: resolvedMenuPos.left,
          width: resolvedMenuPos.width,
          maxHeight: resolvedMenuPos.maxHeight,
          top: resolvedMenuPos.top ?? 'auto',
          bottom: resolvedMenuPos.bottom ?? 'auto',
          zIndex: 10050,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          const list = menuListRef.current;
          menuTouchRef.current = {
            startY: e.touches[0].clientY,
            startScrollTop: list?.scrollTop ?? 0,
            scrolling: false,
          };
        }}
        onTouchMove={(e) => {
          const list = menuListRef.current;
          const dy = Math.abs(e.touches[0].clientY - menuTouchRef.current.startY);
          const scrollDelta = Math.abs((list?.scrollTop ?? 0) - menuTouchRef.current.startScrollTop);
          if (dy > 12 || scrollDelta > 1) {
            menuTouchRef.current.scrolling = true;
          }
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
              onMouseEnter={() => {
                if (menuTouchRef.current.scrolling) return;
                setHighlightIndex(index);
              }}
              onClick={(e) => {
                if (e.detail === 0) return;
                if (!shouldPickOption()) return;
                pick(opt.value);
              }}
              onTouchEnd={(e) => {
                if (!shouldPickOption()) {
                  e.preventDefault();
                  return;
                }
                pick(opt.value);
              }}
              onMouseDown={(e) => {
                if (e.pointerType === 'touch') return;
                e.preventDefault();
                pick(opt.value);
              }}
            >
              {opt.label}
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className={cn('app-select', className)} data-theme={theme}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="app-select__trigger"
        onClick={() => {
          if (disabled) return;
          if (open) close();
          else openMenu();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
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
