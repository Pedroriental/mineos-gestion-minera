'use client';

import { useState, useEffect, useTransition } from 'react';
import { format, subDays } from 'date-fns';
import { Loader2, Download, FileSpreadsheet } from 'lucide-react';
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start pt-2">
      {/* Columna izquierda: controles + KPIs apilados, sin contenedor exterior */}
      <aside className="lg:col-span-1 flex flex-col gap-2 min-w-0 pt-1">
        <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 pt-0.5">
          Reconciliación
        </h3>

        <div className="flex rounded-xl border border-white/10 p-0.5 bg-zinc-900/40">
          <button
            type="button"
            onClick={() => setSubView('analisis')}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-bold ${
              subView === 'analisis' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'
            }`}
          >
            Análisis
          </button>
          <button
            type="button"
            onClick={() => setSubView('parametros')}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-bold ${
              subView === 'parametros' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'
            }`}
          >
            Parámetros
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
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

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={load}
            disabled={isPending}
            className={`flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-xs font-semibold leading-none text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 ${!snapshot ? 'col-span-2' : ''}`}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span>Recalcular</span>
          </button>
          {snapshot && (
            <button
              type="button"
              onClick={() => downloadReconciliationCSV(snapshot)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold leading-none text-zinc-300 hover:bg-white/5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>CSV</span>
            </button>
          )}
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

      {/* Columna derecha: matriz / parámetros */}
      <div className="lg:col-span-3 space-y-4 min-w-0 pt-1">
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
          <>
            {snapshot.rpcDivergence?.flagged && (
              <p className="text-xs text-amber-400/90 border border-amber-500/20 rounded-lg px-3 py-2">
                Divergencia con Resumen: ingreso Δ ${snapshot.rpcDivergence.ingresoDiffUsd.toFixed(2)}
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
          </>
        )}
      </div>
    </div>
  );
}
