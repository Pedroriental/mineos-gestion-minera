'use client';

import { useState, useEffect, useTransition } from 'react';
import { format, subDays } from 'date-fns';
import { Loader2, Download, FileSpreadsheet, Calendar } from 'lucide-react';
import type { DateRange } from '@/lib/reports/report-types';
import {
  fetchReconciliationDrillDown,
  fetchReconciliationSnapshot,
} from '@/lib/actions/reconciliation-actions';
import { getRuleDef } from '@/lib/reconciliation/rules-registry';
import type { ReconciliationSnapshot } from '@/lib/reconciliation/types';
import { ReconciliacionMacroKpis } from '@/components/reportes/ReconciliacionMacroKpis';
import { ReconciliacionRulesMatrix } from '@/components/reportes/ReconciliacionRulesMatrix';
import { ReconciliacionParametros } from '@/components/reportes/ReconciliacionParametros';
import { ReconciliacionDrillDown } from '@/components/reportes/ReconciliacionDrillDown';
import { ReconciliacionDateField } from '@/components/reportes/ReconciliacionDateField';
import { downloadReconciliationCSV } from '@/lib/reports/reconciliation-export';
import {
  MobileFilterTrigger,
  MobileFilterSheet,
  SheetIconBadge,
  useMobileFilterSheet,
} from '@/components/mobile';

type SubView = 'analisis' | 'parametros';

export function ReconciliacionPanel() {
  const [subView, setSubView] = useState<SubView>('analisis');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [snapshot, setSnapshot] = useState<ReconciliationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [drillRuleId, setDrillRuleId] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<Awaited<ReturnType<typeof fetchReconciliationDrillDown>>>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const { open: filtersOpen, setOpen: setFiltersOpen } = useMobileFilterSheet();

  const load = () => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await fetchReconciliationSnapshot(dateRange);
        setSnapshot(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar reconciliación');
        setSnapshot(null);
      }
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.from, dateRange.to]);

  const handleDrillDown = (ruleId: string) => {
    setDrillRuleId(ruleId);
    setDrillRows([]);
    setDrillLoading(true);
    startTransition(async () => {
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

  const reconciliacionControlsPanel = (
    <>
      <div className="app-date-range-fields app-date-range-fields--pair">
        <ReconciliacionDateField
          label="Desde"
          value={dateRange.from}
          onChange={(from) => setDateRange((d) => ({ ...d, from }))}
        />
        <ReconciliacionDateField
          label="Hasta"
          value={dateRange.to}
          onChange={(to) => setDateRange((d) => ({ ...d, to }))}
        />
      </div>

      <div className={`mineos-export-actions reconciliacion-panel__action-pair ${!snapshot ? 'mineos-export-actions--single' : ''}`}>
        <button
          type="button"
          onClick={load}
          disabled={isPending}
          className="mineos-export-btn mineos-export-btn--accent"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Download className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span>Recalcular</span>
        </button>
        {snapshot ? (
          <button
            type="button"
            onClick={() => downloadReconciliationCSV(snapshot)}
            className="mineos-export-btn"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
            <span>CSV</span>
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="reconciliacion-panel reconciliacion-panel--layout grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 sm:gap-6 pt-0 sm:pt-2 md:grid-cols-4">
      {/* Controles + KPIs — arriba en móvil */}
      <aside className="reconciliacion-panel__controls reportes-ui__sidebar md:col-span-1 flex min-h-0 flex-col gap-3 min-w-0 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-4 md:overflow-y-auto md:overscroll-contain custom-scrollbar">
        <h3 className="reconciliacion-panel__label text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 pt-0.5">
          Reconciliación
        </h3>

        <div className="reconciliacion-panel__subview-toggle flex rounded-lg border border-white/10 p-0.5 bg-zinc-900/40 sm:rounded-xl">
          <button
            type="button"
            onClick={() => setSubView('analisis')}
            className={`flex-1 rounded-md px-2 py-1 text-[10px] font-bold sm:rounded-lg sm:py-1.5 ${
              subView === 'analisis' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'
            }`}
          >
            Análisis
          </button>
          <button
            type="button"
            onClick={() => setSubView('parametros')}
            className={`flex-1 rounded-md px-2 py-1 text-[10px] font-bold sm:rounded-lg sm:py-1.5 ${
              subView === 'parametros' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'
            }`}
          >
            Parámetros
          </button>
        </div>

        <MobileFilterTrigger
          label="Periodo"
          showBadge={false}
          onOpen={() => setFiltersOpen(true)}
          className="reconciliacion-panel__period-trigger lg:hidden"
        />

        <div className="reconciliacion-panel__controls-extra hidden flex-col gap-2 md:flex">
          {reconciliacionControlsPanel}
        </div>

        {snapshot ? (
          <ReconciliacionMacroKpis macro={snapshot.macro} variant="sidebar" />
        ) : (
          <div className="flex justify-center py-6">
            {isPending ? (
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            ) : (
              <p className="text-xs text-zinc-500">Sin datos</p>
            )}
          </div>
        )}
      </aside>

      {/* Matriz / parámetros — debajo en móvil */}
      <div className="reconciliacion-panel__main md:col-span-3 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
        {error && (
          <p className="text-sm text-red-400 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            {error}
          </p>
        )}

        {isPending && !snapshot && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        )}

        {subView === 'parametros' && snapshot && (
          <ReconciliacionParametros
            params={snapshot.params}
            macro={snapshot.macro}
            dateRange={snapshot.dateRange}
            inputs={snapshot.inputs}
            onSaved={load}
          />
        )}

        {subView === 'analisis' && snapshot && (
          <div className="reconciliacion-panel__analysis flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {snapshot.rpcDivergence?.flagged && (
              <p className="shrink-0 text-xs text-amber-400/90 border border-amber-500/20 rounded-lg px-3 py-2">
                Divergencia con Resumen: ingreso Δ ${snapshot.rpcDivergence.ingresoDiffUsd.toFixed(2)}
              </p>
            )}
            {snapshot.balanceOperativoDivergence?.flagged && (
              <p className="shrink-0 text-xs text-amber-400/90 border border-amber-500/20 rounded-lg px-3 py-2">
                Divergencia RPC operativo: nómina Δ ${snapshot.balanceOperativoDivergence.nominaDiffUsd.toFixed(2)}
                {' · '}
                ingreso oro Δ ${snapshot.balanceOperativoDivergence.ingresoOroDiffUsd.toFixed(2)}
              </p>
            )}
            <ReconciliacionRulesMatrix
              rules={snapshot.rules}
              nominaDivisiones={snapshot.params.nominaDivisiones}
              onDrillDown={handleDrillDown}
            />
            {drillRuleId && (
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
            )}
          </div>
        )}
      </div>

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Periodo y acciones"
        icon={<SheetIconBadge icon={Calendar} tone="info" />}
      >
        {reconciliacionControlsPanel}
      </MobileFilterSheet>
    </div>
  );
}
