'use client';

import { memo } from 'react';
import type { BalanceSummary } from '@/lib/reconciliation/aggregate-balance';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { ReportesTableFooter } from '@/components/reportes/ReportesTableFooter';
import { ReportesTableRowPadding } from '@/components/reportes/ReportesTableRowPadding';
import { useDataTablePagination } from '@/hooks/useDataTablePagination';

const COL_SPAN = 10;

type Props = {
  rows: BalanceSummary['rows'];
};

export const BalancePeriodTable = memo(function BalancePeriodTable({ rows }: Props) {
  const {
    tableAreaRef,
    pageIndex,
    setPageIndex,
    pageCount,
    visibleRows: pageRows,
    emptyRowSlots,
  } = useDataTablePagination(rows, 12);

  if (rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500 italic py-4 text-center">
        Sin periodos en el rango seleccionado
      </p>
    );
  }

  return (
    <div ref={tableAreaRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className={ui.tableWrap}>
        <table className="w-full text-left">
          <thead className={ui.tableHead}>
            <tr>
              <th className="px-2.5 py-2">Periodo</th>
              <th className="px-2.5 py-2 text-right">Oro (g)</th>
              <th className="px-2.5 py-2 text-right">Ing. oro</th>
              <th className="px-2.5 py-2 text-right">Ing. arenas</th>
              <th className="px-2.5 py-2 text-right">Ing. total</th>
              <th className="px-2.5 py-2 text-right">Nómina</th>
              <th className="px-2.5 py-2 text-right">Insumos</th>
              <th className="px-2.5 py-2 text-right">Operativo</th>
              <th className="px-2.5 py-2 text-right">Rentab.</th>
              <th className="px-2.5 py-2 text-right">Margen</th>
            </tr>
          </thead>
          <tbody className={ui.tableBody}>
            {pageRows.map((row) => (
              <tr key={row.periodoKey} className={ui.tableRow}>
                <td className="px-2.5 py-1.5 whitespace-nowrap">{row.grupo}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">{row.oroGramos.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">${row.ingresosOro.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">${row.ingresosArenas.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold">${row.ingresosTotal.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">${row.gastosNomina.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">${row.gastosInsumos.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">${row.gastosOperativos.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold">${row.rentabilidad.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">{row.margenPct.toFixed(1)}%</td>
              </tr>
            ))}
            <ReportesTableRowPadding colSpan={COL_SPAN} count={emptyRowSlots} />
          </tbody>
        </table>
      </div>
      <ReportesTableFooter
        summaryLabel="Periodos"
        summaryValue={String(rows.length)}
        countLabel="filas"
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={setPageIndex}
      />
    </div>
  );
});
