'use client';

import { memo, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ExecuteReportResult,
  ModuleReportData,
  ModuleFilters,
  ReportModule,
} from '@/lib/reports/report-types';
import { resolvePreviewMode } from '@/lib/reports/live-modules/module-view-mode';
import { ConstructorBalanceRich } from '@/components/reportes/ConstructorBalanceRich';
import { ConstructorReconciliationRich } from '@/components/reportes/ConstructorReconciliationRich';
import { fetchReconciliationDrillDown } from '@/lib/actions/reconciliation-actions';
import { getRuleDef } from '@/lib/reconciliation/rules-registry';
import { ReconciliacionDrillDown } from '@/components/reportes/ReconciliacionDrillDown';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';

export type ConstructorLiveContext = {
  dateFrom: string;
  dateTo: string;
  groupBy: string;
  filters: Partial<Record<ReportModule, ModuleFilters>>;
};

type Props = {
  result: ExecuteReportResult | null;
  loading: boolean;
  liveContext?: ConstructorLiveContext;
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
      return ui.statusBenefit;
    case 'warning':
      return ui.statusGeneral;
    case 'error':
      return ui.statusExpense;
    default:
      return 'text-[var(--dashboard-text-muted)]';
  }
}

function formatNum(n: unknown, decimals = 2): string {
  const num = Number(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function renderRows(
  rows: Record<string, unknown>[] | undefined,
  opts?: { clickable?: boolean; onRowClick?: (row: Record<string, unknown>) => void },
) {
  if (!rows || rows.length === 0) return null;
  const hasPeriod = rows.some((r) => r.periodo_label != null);
  const columns = Object.keys(rows[0]).filter(
    (k) => k !== 'periodo' && k !== 'periodo_label' && !k.startsWith('_'),
  );
  const allColumns = hasPeriod ? ['periodo_label', ...columns] : columns;

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
            <tr
              key={i}
              className={cn(
                'transition-colors',
                opts?.clickable ? 'cursor-pointer hover:bg-amber-500/5' : 'hover:bg-white/[0.02]',
              )}
              onClick={opts?.clickable ? () => opts.onRowClick?.(row) : undefined}
            >
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

export const ReportPreview = memo(function ReportPreview({ result, loading, liveContext }: Props) {
  const [drillRuleId, setDrillRuleId] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<Awaited<ReturnType<typeof fetchReconciliationDrillDown>>>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [, startDrillTransition] = useTransition();

  const openReconciliationDrill = (ruleId: string, dateRange: { from: string; to: string }) => {
    setDrillRuleId(ruleId);
    setDrillRows([]);
    setDrillLoading(true);
    startDrillTransition(async () => {
      try {
        const rows = await fetchReconciliationDrillDown(ruleId, dateRange);
        setDrillRows(rows);
      } catch {
        setDrillRows([]);
      } finally {
        setDrillLoading(false);
      }
    });
  };

  if (loading) {
    return (
      <div className={cn(ui.emptyState, 'h-64')}>
        <Loader2 className={cn('h-5 w-5 animate-spin', ui.statusGeneral)} />
        <p className={ui.metaText}>Ejecutando reporte...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={cn(ui.emptyState, 'h-64')}>
        <p className={ui.metaText}>
          Selecciona módulos y filtros, luego presiona Ejecutar
        </p>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className={cn(ui.emptyState, 'h-64 border-[color-mix(in_srgb,var(--mineos-expense)_28%,var(--dashboard-border))]')}>
        <p className={ui.statusExpense}>Error al ejecutar el reporte</p>
      </div>
    );
  }

  const modules = Object.keys(result.data);
  if (modules.length === 0) {
    return (
      <div className={cn(ui.emptyState, 'h-64')}>
        <p className={ui.metaText}>Sin datos para los filtros seleccionados</p>
      </div>
    );
  }

  const selectedModules = (result.modules ?? modules) as ReportModule[];
  const previewMode = resolvePreviewMode(selectedModules);
  const dateRange = result.dateRange ?? { from: '', to: '' };
  const ctx = liveContext ?? {
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    groupBy: result.groupBy ?? 'dia',
    filters: {},
  };

  if (previewMode === 'balance-rich') {
    return (
      <div className="space-y-3">
        <p className="text-[10px] text-zinc-500">
          Vista rica de balance · {dateRange.from} → {dateRange.to}
        </p>
        <ConstructorBalanceRich
          dateRange={{ from: ctx.dateFrom, to: ctx.dateTo }}
          groupBy={ctx.groupBy}
          moduleFilters={ctx.filters.balance}
          reconciliationFilters={ctx.filters.reconciliacion}
        />
      </div>
    );
  }

  if (previewMode === 'reconciliation-rich') {
    return (
      <div className="space-y-3">
        <p className="text-[10px] text-zinc-500">
          Vista rica de reconciliación · {dateRange.from} → {dateRange.to}
        </p>
        <ConstructorReconciliationRich
          dateRange={{ from: ctx.dateFrom, to: ctx.dateTo }}
          moduleFilters={ctx.filters.reconciliacion}
        />
      </div>
    );
  }

  const renderModuleData = (mod: string, data: ModuleReportData) => {
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

    const isReconciliation = mod === 'reconciliacion';

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
        {renderRows(data.rows, {
          clickable: isReconciliation,
          onRowClick: isReconciliation
            ? (row) => {
                const ruleId = String(row._rule_id ?? '');
                if (ruleId) openReconciliationDrill(ruleId, dateRange);
              }
            : undefined,
        })}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {result.crossModule ? (
        <p className="text-[10px] text-amber-400/90 border border-amber-500/20 rounded-lg px-3 py-2">
          Modo cruce: {result.crossModule.type} = {result.crossModule.value}
        </p>
      ) : null}
      {modules.map((mod) => renderModuleData(mod, result.data[mod]))}
      {drillRuleId && dateRange.from ? (
        <ReconciliacionDrillDown
          ruleId={drillRuleId}
          ruleLabel={getRuleDef(drillRuleId)?.label ?? drillRuleId}
          rows={drillRows}
          isLoading={drillLoading}
          dateFrom={dateRange.from}
          dateTo={dateRange.to}
          onClose={() => {
            setDrillRuleId(null);
            setDrillRows([]);
          }}
        />
      ) : null}
    </div>
  );
});
