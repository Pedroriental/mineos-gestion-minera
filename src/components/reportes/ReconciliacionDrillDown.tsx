'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { DrillDownRow } from '@/lib/reconciliation/types';
import { buildPeriodDeepLink, formatCell } from '@/lib/reconciliation/drill-down';
import { ReportesTableFooter } from '@/components/reportes/ReportesTableFooter';
import { ReportesTableRowPadding } from '@/components/reportes/ReportesTableRowPadding';
import { useDataTablePagination } from '@/hooks/useDataTablePagination';

const DRILLDOWN_COL_SPAN = 5;

export function ReconciliacionDrillDown({
  ruleId,
  ruleLabel,
  rows,
  isLoading,
  dateFrom,
  dateTo,
  onClose,
}: {
  ruleId: string;
  ruleLabel: string;
  rows: DrillDownRow[];
  isLoading?: boolean;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
}) {
  const colA = rows[0]?.columnA ?? 'Fuente A';
  const colB = rows[0]?.columnB ?? 'Fuente B';
  const unitA = rows[0]?.unitA;
  const unitB = rows[0]?.unitB;
  const periodLink = buildPeriodDeepLink(ruleId, dateFrom, dateTo);

  const {
    tableAreaRef,
    pageIndex,
    setPageIndex,
    pageCount,
    visibleRows,
    emptyRowSlots,
    rangeLabel,
  } = useDataTablePagination(rows, [ruleId, rows.length]);

  const footerMeta = useMemo(() => {
    if (rows.length === 0) return null;
    const withDeviation = rows.filter((r) => r.deviationPct != null && r.deviationPct !== 0).length;
    return {
      summaryLabel: 'Periodos',
      summaryValue: String(rows.length),
      countLabel:
        withDeviation > 0 ? `${rangeLabel} · ${withDeviation} con desvío` : rangeLabel,
    };
  }, [rangeLabel, rows]);

  return (
    <div className="reconciliacion-drilldown app-surface-card flex min-h-0 flex-col overflow-hidden rounded-xl">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--dashboard-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold text-zinc-200">Detalle: {ruleLabel}</h3>
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-200">
          Cerrar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 justify-center text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando desglose…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-2 px-4 py-4 text-center">
          <p className="text-sm text-zinc-500">No hay filas de detalle para este periodo.</p>
          <Link href={periodLink} className="text-xs font-medium text-zinc-400 hover:text-zinc-200">
            Abrir módulo relacionado →
          </Link>
        </div>
      ) : (
        <>
          <div
            ref={tableAreaRef}
            className="reconciliacion-drilldown__area flex min-h-0 flex-1 flex-col overflow-hidden px-4"
          >
            <div className="reconciliacion-drilldown__body gastos-page__table-body min-h-0 flex-1 overflow-hidden">
              <table className="gastos-table w-full table-fixed border-collapse text-xs">
                <thead className="gastos-thead">
                  <tr>
                    <th className="gastos-th py-1 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider">Periodo</th>
                    <th className="gastos-th py-1 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider">{colA}</th>
                    <th className="gastos-th py-1 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider">{colB}</th>
                    <th className="gastos-th py-1 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider">Desvío</th>
                    <th className="gastos-th py-1" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.key} className="gastos-table__row gastos-tr">
                      <td className="gastos-table__cell gastos-td max-w-0 truncate py-0 pr-3 text-[11px]">{r.label}</td>
                      <td className="gastos-table__cell gastos-td max-w-0 truncate py-0 pr-3 text-[11px] text-right tabular-nums">
                        {formatCell(r.valueA, r.unitA ?? unitA)}
                      </td>
                      <td className="gastos-table__cell gastos-td max-w-0 truncate py-0 pr-3 text-[11px] text-right tabular-nums">
                        {formatCell(r.valueB, r.unitB ?? unitB)}
                      </td>
                      <td className="gastos-table__cell gastos-td max-w-0 truncate py-0 pr-3 text-[11px] text-right tabular-nums text-zinc-400">
                        {r.deviationPct != null ? `${r.deviationPct}%` : '—'}
                      </td>
                      <td className="gastos-table__cell gastos-td py-0 text-right">
                        {r.deepLink ? (
                          <Link
                            href={r.deepLink}
                            className="text-zinc-400 hover:text-zinc-200 font-medium whitespace-nowrap"
                          >
                            Abrir
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  <ReportesTableRowPadding colSpan={DRILLDOWN_COL_SPAN} count={emptyRowSlots} />
                </tbody>
              </table>
            </div>
          </div>
          {footerMeta ? (
            <ReportesTableFooter
              summaryLabel={footerMeta.summaryLabel}
              summaryValue={footerMeta.summaryValue}
              countLabel={footerMeta.countLabel}
              pageIndex={pageIndex}
              pageCount={pageCount}
              onPageChange={setPageIndex}
            />
          ) : null}
          <p className="shrink-0 border-t border-[var(--dashboard-border)] px-4 py-2 text-[10px] text-zinc-600 text-right">
            <Link href={periodLink} className="hover:text-zinc-400">
              Ver en operaciones
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
