'use client';

import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';

export type BottomSheetSnap = 'peek' | 'expanded';

const CLOSE_DRAG_PX = 96;
const EXPAND_DRAG_PX = 44;
const COLLAPSE_DRAG_PX = 56;

type UseBottomSheetSnapOptions = {
  enabled: boolean;
  open: boolean;
  onClose: () => void;
  initialSnap?: BottomSheetSnap;
};

export function useBottomSheetSnap({
  enabled,
  open,
  onClose,
  initialSnap = 'peek',
}: UseBottomSheetSnapOptions) {
  const [snap, setSnap] = useState<BottomSheetSnap>(initialSnap);
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startSnapRef = useRef<BottomSheetSnap>('peek');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setSnap(initialSnap);
  }, [open, initialSnap]);

  const canStartDrag = useCallback(
    (target: EventTarget | null) => {
      if (!enabled) return false;
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.closest('[data-sheet-handle]')) return true;
      if (
        el.closest(
          '.app-select, .app-combobox, .app-date-picker, .app-month-picker, input, textarea, select, [role="listbox"]',
        )
      ) {
        return false;
      }
      return (scrollRef.current?.scrollTop ?? 0) <= 0;
    },
    [enabled],
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!canStartDrag(e.target)) return;
      draggingRef.current = true;
      startYRef.current = e.touches[0].clientY;
      startSnapRef.current = snap;
    },
    [canStartDrag, snap],
  );

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!draggingRef.current) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) {
      setDragY(dy);
      return;
    }
    if (startSnapRef.current === 'peek') setDragY(dy);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const dy = dragY;
    setDragY(0);

    if (dy > CLOSE_DRAG_PX) {
      onClose();
      return;
    }
    if (dy < -EXPAND_DRAG_PX && startSnapRef.current === 'peek') {
      setSnap('expanded');
      return;
    }
    if (dy > COLLAPSE_DRAG_PX && startSnapRef.current === 'expanded') {
      setSnap('peek');
    }
  }, [dragY, onClose]);

  const toggleSnap = useCallback(() => {
    setSnap((s) => (s === 'peek' ? 'expanded' : 'peek'));
  }, []);

  const sheetStyle =
    dragY !== 0
      ? { transform: `translateY(${Math.max(0, dragY)}px)`, transition: 'none' as const }
      : undefined;

  return {
    snap,
    setSnap,
    dragY,
    scrollRef,
    sheetStyle,
    toggleSnap,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
