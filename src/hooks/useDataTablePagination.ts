'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

/** Mismos defaults que Inventario — filas dinámicas según altura del contenedor. */
export const DATA_TABLE_PAGE_MAX = 50;
export const DATA_TABLE_ROW_MIN_PX = 32;
export const DATA_TABLE_HEAD_FALLBACK_PX = 32;
export const DATA_TABLE_MOBILE_CARD_MIN_PX = 132;
export const DATA_TABLE_PAGE_BUTTONS_MAX = 5;

type UseDataTablePaginationOptions = {
  pageMax?: number;
  rowMinPx?: number;
  headFallbackPx?: number;
  mobileCardMinPx?: number;
  enabled?: boolean;
};

function measureRowHeight(container: HTMLElement, fallback: number) {
  const sample = container.querySelector<HTMLElement>(
    'tbody tr:not(.reportes-table__row-pad):not(.reconciliacion-rules-matrix__split-row)',
  );
  const measured = sample?.getBoundingClientRect().height ?? 0;
  return measured > 8 ? measured : fallback;
}

function measureHeadHeight(container: HTMLElement, fallback: number) {
  const thead = container.querySelector('thead');
  const measured = thead?.getBoundingClientRect().height ?? 0;
  return measured > 8 ? measured : fallback;
}

export function useDataTablePagination<T>(
  items: T[],
  resetDeps: unknown[],
  options: UseDataTablePaginationOptions = {},
) {
  const {
    pageMax = DATA_TABLE_PAGE_MAX,
    rowMinPx = DATA_TABLE_ROW_MIN_PX,
    headFallbackPx = DATA_TABLE_HEAD_FALLBACK_PX,
    mobileCardMinPx = DATA_TABLE_MOBILE_CARD_MIN_PX,
    enabled = true,
  } = options;

  const isMobile = useIsMobile();
  const tableAreaRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: pageMax });

  const syncTableLayout = useCallback(() => {
    const el = tableAreaRef.current;
    if (!el || !enabled) return;

    const body =
      el.querySelector<HTMLElement>('.gastos-page__table-body') ??
      el.querySelector<HTMLElement>('.reportes-ui__table-body') ??
      el;

    const available = body.clientHeight;
    const isDesktop =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches && !isMobile;

    let nextPageSize: number;
    if (isDesktop) {
      const headH = measureHeadHeight(el, headFallbackPx);
      const rowH = measureRowHeight(el, rowMinPx);
      const bodyAvailable = Math.max(0, available - headH);
      nextPageSize = Math.max(1, Math.floor(bodyAvailable / rowH));
    } else {
      nextPageSize = Math.max(1, Math.floor(available / mobileCardMinPx));
    }

    nextPageSize = Math.min(pageMax, nextPageSize);
    setPagination((prev) => (prev.pageSize === nextPageSize ? prev : { ...prev, pageSize: nextPageSize }));
  }, [enabled, headFallbackPx, isMobile, mobileCardMinPx, pageMax, rowMinPx]);

  useEffect(() => {
    const el = tableAreaRef.current;
    if (!el || !enabled) return;

    const run = () => syncTableLayout();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const mq = window.matchMedia('(min-width: 768px)');
    mq.addEventListener('change', run);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', run);
    };
  }, [enabled, syncTableLayout, items.length]);

  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)));
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  const activePageIndex = total === 0 ? 0 : pageIndex;

  useEffect(() => {
    const maxIndex = Math.max(0, pageCount - 1);
    if (pagination.pageIndex > maxIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxIndex }));
    }
  }, [pageCount, pagination.pageIndex]);

  const visibleRows = useMemo(
    () =>
      items.slice(
        activePageIndex * pagination.pageSize,
        activePageIndex * pagination.pageSize + pagination.pageSize,
      ),
    [activePageIndex, items, pagination.pageSize],
  );

  const emptyRowSlots = Math.max(0, pagination.pageSize - visibleRows.length);

  useEffect(() => {
    const el = tableAreaRef.current;
    if (!el || !enabled || isMobile) return;

    const body =
      el.querySelector<HTMLElement>('.gastos-page__table-body') ??
      el.querySelector<HTMLElement>('.reportes-ui__table-body');
    const table = el.querySelector('table');
    if (!body || !table) return;

    if (table.scrollHeight > body.clientHeight + 1 && pagination.pageSize > 1) {
      setPagination((prev) => ({ ...prev, pageSize: prev.pageSize - 1 }));
    }
  }, [enabled, isMobile, pagination.pageSize, visibleRows.length, emptyRowSlots]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return '0 filas';
    const from = activePageIndex * pagination.pageSize + 1;
    const to = Math.min(total, (activePageIndex + 1) * pagination.pageSize);
    return `${from}–${to} de ${total}`;
  }, [activePageIndex, pagination.pageSize, total]);

  const setPageIndex = useCallback((next: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: next }));
  }, []);

  return {
    tableAreaRef,
    pageIndex: activePageIndex,
    setPageIndex,
    pageSize: pagination.pageSize,
    pageCount,
    visibleRows,
    emptyRowSlots,
    total,
    rangeLabel,
  };
}
