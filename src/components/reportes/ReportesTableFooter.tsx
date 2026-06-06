'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATA_TABLE_PAGE_BUTTONS_MAX, DATA_TABLE_PAGE_MAX } from '@/hooks/useDataTablePagination';

export { DATA_TABLE_PAGE_MAX as REPORTES_TABLE_PAGE_SIZE };

const PAGE_BUTTONS_MAX = DATA_TABLE_PAGE_BUTTONS_MAX;

export function buildPageNumbers(pageCount: number, pageIndex: number) {
  const pageWindowStart = Math.floor(pageIndex / PAGE_BUTTONS_MAX) * PAGE_BUTTONS_MAX;
  return Array.from(
    { length: Math.min(PAGE_BUTTONS_MAX, Math.max(0, pageCount - pageWindowStart)) },
    (_, i) => pageWindowStart + i,
  );
}

type ReportesTableFooterProps = {
  summaryLabel: string;
  summaryValue: string;
  countLabel: string;
  pageIndex: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function ReportesTableFooter({
  summaryLabel,
  summaryValue,
  countLabel,
  pageIndex,
  pageCount,
  onPageChange,
  className,
}: ReportesTableFooterProps) {
  const pageNumbers = useMemo(
    () => buildPageNumbers(pageCount, pageIndex),
    [pageCount, pageIndex],
  );

  return (
    <div
      className={cn(
        'reportes-ui__table-footer gastos-page__table-footer gastos-footer-bar flex h-8 shrink-0 items-center justify-between gap-2 overflow-hidden px-3',
        className,
      )}
    >
      <span className="gastos-footer-label min-w-0 truncate text-[10px]">
        <span className="text-[9px] uppercase tracking-wider">{summaryLabel}</span>{' '}
        <span className="gastos-amount text-xs font-semibold tabular-nums">{summaryValue}</span>
        {' · '}
        {countLabel}
      </span>
      {pageCount > 1 ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex <= 0}
            className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-label={`Página ${page + 1}`}
              aria-current={page === pageIndex ? 'page' : undefined}
              className={cn(
                'gastos-page-btn min-w-[1.35rem] rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors',
                page === pageIndex && 'gastos-page-btn--active',
              )}
            >
              {page + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount - 1, pageIndex + 1))}
            disabled={pageIndex >= pageCount - 1}
            className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
