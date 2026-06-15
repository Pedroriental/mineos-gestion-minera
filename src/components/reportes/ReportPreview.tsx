'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ExecuteReportResult, ModuleReportData } from '@/lib/reports/report-types';

type Props = {
  result: ExecuteReportResult | null;
  loading: boolean;
};

const MODULE_LABELS: Record<string, string> = {
  produccion: 'Producción', extraccion: 'Extracción', quemado: 'Quemado',
  voladuras: 'Voladuras', gastos: 'Gastos', nomina: 'Nómina', balance: 'Balance',
  reconciliacion: 'Reconciliación',
};

const STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  warning: 'Alerta',
  error: 'Error',
  insufficient_data: 'Sin datos',
};

function statusClass(status: unknown): string {
  switch (String(status)) {
    case 'ok':
      return 'text-emerald-400';
    case 'warning':
      return 'text-amber-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-zinc-400';
  }
}

function formatNum(n: unknown, decimals = 2): string {
  const num = Number(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function renderRows(rows: Record<string, unknown>[] | undefined) {
  if (!rows || rows.length === 0) return null;
  const columns = Object.keys(rows[0]).filter(
    (k) => k !== 'periodo' && k !== 'periodo_label' && !k.startsWith('_'),
  );
  const allColumns = ['periodo_label', ...columns];

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-white/5')}>
      <table className="w-full text-left">
        <thead className="border-b border-white/5 bg-zinc-900/40 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <tr>
            {allColumns.map((col) => (
              <th key={col} className="px-2.5 py-2 whitespace-nowrap">
                {col === 'periodo_label' ? 'Periodo' : col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-[11px] text-zinc-400">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
              {allColumns.map((col) => {
                const val = row[col];
                const isNum = typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)));
                const isStatus = col === 'estado';
                return (
                  <td
                    key={col}
                    className={cn(
                      'px-2.5 py-1.5 whitespace-nowrap tabular-nums',
                      isStatus && statusClass(val),
                    )}
                  >
                    {isStatus
                      ? STATUS_LABELS[String(val)] ?? String(val ?? '—')
                      : isNum
                        ? formatNum(val)
                        : String(val ?? '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderTotals(totals: Record<string, number> | undefined) {
  if (!totals || Object.keys(totals).length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(totals).map(([key, val]) => (
        <div key={key} className="rounded-lg border border-white/5 bg-zinc-900/30 px-3 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
          <p className="text-xs font-semibold tabular-nums text-zinc-200">
            {formatNum(val)}
          </p>
        </div>
      ))}
    </div>
  );
}

function renderModuleData(mod: string, data: ModuleReportData) {
  if (data.error) {
    return (
      <div key={mod} className="space-y-2">
        <h4 className="text-sm font-semibold text-zinc-300">
          {MODULE_LABELS[mod] ?? mod}
        </h4>
        <p className="text-[11px] text-red-400 bg-red-500/5 rounded-lg border border-red-500/20 px-3 py-2">
          {data.error}
        </p>
      </div>
    );
  }

  if (!data.rows || data.rows.length === 0) {
    return (
      <div key={mod} className="space-y-2">
        <h4 className="text-sm font-semibold text-zinc-300">
          {MODULE_LABELS[mod] ?? mod}
        </h4>
        <p className="text-[11px] text-zinc-500 italic py-2">Sin resultados</p>
      </div>
    );
  }

  return (
    <div key={mod} className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-zinc-300">
          {MODULE_LABELS[mod] ?? mod}
        </h4>
        <span className="text-[10px] text-zinc-500 tabular-nums">
          {data.rows.length} filas
        </span>
      </div>
      {renderTotals(data.totals)}
      {renderRows(data.rows)}
    </div>
  );
}

export const ReportPreview = memo(function ReportPreview({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-amber-400" />
        <p className="text-xs text-zinc-500">Ejecutando reporte...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-10">
        <p className="text-xs text-zinc-500">
          Selecciona módulos y filtros, luego presiona Ejecutar
        </p>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-red-500/20 py-10">
        <p className="text-xs text-red-400">Error al ejecutar el reporte</p>
      </div>
    );
  }

  const modules = Object.keys(result.data);
  if (modules.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-10">
        <p className="text-xs text-zinc-500">Sin datos para los filtros seleccionados</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {modules.map((mod) => renderModuleData(mod, result.data[mod]))}
    </div>
  );
});
