'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import { format, subDays } from 'date-fns';
import { Loader2, Download, FileSpreadsheet, Calendar, RefreshCw } from 'lucide-react';
import type { DateRange, FilterOptions } from '@/lib/reports/report-types';
import { fetchReconciliationSnapshot } from '@/lib/actions/reconciliation-actions';
import { getRuleDef } from '@/lib/reconciliation/rules-registry';
import type { ReconciliationSnapshot } from '@/lib/reconciliation/types';
import { buildOperationalFilters } from '@/lib/reports/live-modules/operational-filters';
import { uniqueMinasFromOptions } from '@/lib/reports/hub/report-tab-fetch';
import { ReconciliacionMacroKpis } from '@/components/reportes/ReconciliacionMacroKpis';
import { ReconciliacionRulesMatrix } from '@/components/reportes/ReconciliacionRulesMatrix';
import { ReconciliacionParametros } from '@/components/reportes/ReconciliacionParametros';
import { ReconciliacionDrillDown } from '@/components/reportes/ReconciliacionDrillDown';
import { ReconciliacionDateField } from '@/components/reportes/ReconciliacionDateField';
import { ReconciliacionDivergenceBanner } from '@/components/reportes/ReconciliacionDivergenceBanner';
import { ReconciliacionOperationalFilters } from '@/components/reportes/ReconciliacionOperationalFilters';
import { downloadReconciliationCSV } from '@/lib/reports/reconciliation-export';
import { useReconciliationDrillDown } from '@/hooks/useReconciliationDrillDown';
import { HubConstructorLink } from '@/components/reportes/HubConstructorLink';
import {
  MobileFilterTrigger,
  MobileFilterSheet,
  SheetIconBadge,
  useMobileFilterSheet,
} from '@/components/mobile';

type SubView = 'analisis' | 'parametros';

type Props = {
  initialOptions: FilterOptions;
};

function toggleChip(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ReconciliacionPanel({ initialOptions }: Props) {
  const [subView, setSubView] = useState<SubView>('analisis');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedMolinos, setSelectedMolinos] = useState<string[]>([]);
  const [selectedMinas, setSelectedMinas] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<ReconciliationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { open: filtersOpen, setOpen: setFiltersOpen } = useMobileFilterSheet();
  const {
    drillRuleId,
    drillRows,
    drillLoading,
    openDrillDown,
    closeDrillDown,
  } = useReconciliationDrillDown(dateRange);

  const minasOptions = useMemo(() => uniqueMinasFromOptions(initialOptions), [initialOptions]);
  const operationalFilters = useMemo(
    () => buildOperationalFilters(selectedMolinos, selectedMinas),
    [selectedMolinos, selectedMinas],
  );

  const load = () => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await fetchReconciliationSnapshot(dateRange, operationalFilters);
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
  }, [dateRange.from, dateRange.to, operationalFilters]);

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

      <ReconciliacionOperationalFilters
        molinos={initialOptions.produccion.molinos}
        minas={minasOptions}
        selectedMolinos={selectedMolinos}
        selectedMinas={selectedMinas}
        onToggleMolino={(m) => setSelectedMolinos((prev) => toggleChip(prev, m))}
        onToggleMina={(m) => setSelectedMinas((prev) => toggleChip(prev, m))}
        onClear={() => {
          setSelectedMolinos([]);
          setSelectedMinas([]);
        }}
      />

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
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
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

        <HubConstructorLink
          payload={{
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            modules: ['reconciliacion'],
            groupBy: 'periodo',
            filters: {
              reconciliacion: {
                ...(selectedMolinos.length ? { molinos: { in: selectedMolinos } } : {}),
                ...(selectedMinas.length ? { minas: { in: selectedMinas } } : {}),
              },
            },
          }}
        />

        <MobileFilterTrigger
          label="Periodo y filtros"
          showBadge={selectedMolinos.length + selectedMinas.length > 0}
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
            ) : error ? (
              <button
                type="button"
                onClick={load}
                className="text-xs text-amber-400 underline underline-offset-2"
              >
                Reintentar
              </button>
            ) : (
              <p className="text-xs text-zinc-500">Sin datos</p>
            )}
          </div>
        )}
      </aside>

      <div className="reconciliacion-panel__main md:col-span-3 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={load}
              className="text-xs font-semibold text-red-300 hover:text-red-200"
            >
              Reintentar
            </button>
          </div>
        )}

        {isPending && !snapshot && !error && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-xs text-zinc-500">Calculando reglas del periodo…</p>
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
            <ReconciliacionDivergenceBanner
              snapshot={snapshot}
              onDrillRpc={() => openDrillDown('rpc_divergencia')}
            />
            <ReconciliacionRulesMatrix
              rules={snapshot.rules}
              nominaDivisiones={snapshot.params.nominaDivisiones}
              onDrillDown={openDrillDown}
            />
            {drillRuleId ? (
              <ReconciliacionDrillDown
                ruleId={drillRuleId}
                ruleLabel={getRuleDef(drillRuleId)?.label ?? drillRuleId}
                rows={drillRows}
                isLoading={drillLoading}
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
                onClose={closeDrillDown}
              />
            ) : null}
          </div>
        )}

        {!isPending && !snapshot && !error && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm text-zinc-400">No hay snapshot para este periodo</p>
            <button
              type="button"
              onClick={load}
              className="text-xs font-semibold text-amber-400"
            >
              Recalcular
            </button>
          </div>
        )}
      </div>

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Periodo y filtros"
        icon={<SheetIconBadge icon={Calendar} tone="info" />}
      >
        {reconciliacionControlsPanel}
      </MobileFilterSheet>
    </div>
  );
}
