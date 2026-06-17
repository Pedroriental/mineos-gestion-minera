'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { format, subDays } from 'date-fns';
import { HelpCircle, Loader2, FileText, FileSpreadsheet, AlertCircle } from 'lucide-react';
import type { DateRange, FilterOptions } from '@/lib/reports/report-types';
import type { BalanceGroupBy } from '@/lib/reconciliation/aggregate-balance';
import { fetchBalanceReportAggregated } from '@/lib/actions/reconciliation-actions';
import { buildOperationalFilters } from '@/lib/reports/live-modules/operational-filters';
import { BalanceKpiStrip } from '@/components/reportes/BalanceKpiStrip';
import { BalancePeriodTable } from '@/components/reportes/BalancePeriodTable';
import { ReconciliacionOperationalFilters } from '@/components/reportes/ReconciliacionOperationalFilters';
import { AppDateRangeFields } from '@/components/ui/AppDateRangeFields';
import { AppSelect } from '@/components/ui/AppSelect';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { cn } from '@/lib/utils';
import { uniqueMinasFromOptions } from '@/lib/reports/hub/report-tab-fetch';
import { downloadReportPDF } from '@/lib/reports/report-pdf-generator';
import { downloadReportCSV } from '@/lib/reports/report-csv-generator';
import { HubConstructorLink } from '@/components/reportes/HubConstructorLink';
import {
  MobileFilterTrigger,
  MobileFilterSheet,
  useMobileFilterSheet,
} from '@/components/mobile';

type Props = {
  initialOptions: FilterOptions;
};

function toggleChip(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function BalanceReportPanel({ initialOptions }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [groupBy, setGroupBy] = useState<BalanceGroupBy>('semana');
  const [selectedMolinos, setSelectedMolinos] = useState<string[]>([]);
  const [selectedMinas, setSelectedMinas] = useState<string[]>([]);
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof fetchBalanceReportAggregated>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { open: filtersOpen, setOpen: setFiltersOpen, close: closeFilters } = useMobileFilterSheet();

  const minasOptions = uniqueMinasFromOptions(initialOptions);
  const operationalFilters = useMemo(
    () => buildOperationalFilters(selectedMolinos, selectedMinas),
    [selectedMolinos, selectedMinas],
  );

  const load = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await fetchBalanceReportAggregated(dateRange, groupBy, operationalFilters);
        setPayload(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar balance');
        setPayload(null);
      }
    });
  }, [dateRange, groupBy, operationalFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const filtersPanel = (
    <div className="space-y-3">
      <AppDateRangeFields
        from={dateRange.from}
        to={dateRange.to}
        onFromChange={(from) => setDateRange((d) => ({ ...d, from }))}
        onToChange={(to) => setDateRange((d) => ({ ...d, to }))}
        layout="pair"
      />
      <div className="flex flex-col gap-1.5">
        <label className={cn(ui.fieldLabel, 'flex items-center gap-1')}>Precio oro aplicado</label>
        <p className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-2.5 py-1.5 text-sm tabular-nums text-[var(--dashboard-text)]">
          {payload
            ? `${payload.precioOro.usdPorGramo.toFixed(2)}/g · ${payload.precioOro.origenUi}`
            : '—'}
        </p>
        <p className="text-[10px] text-[var(--dashboard-text-muted)]">
          Cambiar en Reconciliación → Parámetros.
        </p>
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
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--dashboard-border)]">
        <label className={ui.fieldLabel}>Agrupar balance por</label>
        <AppSelect
          value={groupBy}
          onChange={(v) => setGroupBy(v as BalanceGroupBy)}
          options={[
            { value: 'dia', label: 'Por día' },
            { value: 'semana', label: 'Por semana' },
            { value: 'mes', label: 'Por mes' },
          ]}
        />
      </div>
    </div>
  );

  const handleExportPDF = () => {
    if (!payload) return;
    downloadReportPDF('balance', payload.aggregated, dateRange, groupBy);
  };

  const handleExportCSV = () => {
    if (!payload) return;
    downloadReportCSV('balance', payload.aggregated, groupBy);
  };

  return (
    <div className="reportes-balance-panel grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 sm:gap-6 md:grid-cols-4">
      <aside className={cn(ui.sidebar, 'hidden md:flex md:min-h-0 md:overflow-y-auto custom-scrollbar')}>
        <h3 className={ui.sectionTitle}>Balance</h3>
        {filtersPanel}
      </aside>

      <div className="md:col-span-3 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <MobileFilterTrigger
          label="Filtros balance"
          showBadge={selectedMolinos.length + selectedMinas.length > 0}
          onOpen={() => setFiltersOpen(true)}
          className="md:hidden"
        />

        <div className={ui.previewPanel}>
          <div className="reportes-ui__preview-head flex shrink-0 flex-col gap-2.5">
            <h2 className={cn(ui.previewTitle, 'flex items-center gap-2')}>
              Vista previa
              {isPending ? <Loader2 className={cn('w-3.5 h-3.5 animate-spin', ui.metaText)} /> : null}
            </h2>
            {payload && payload.aggregated.rows.length > 0 ? (
              <div className={cn(ui.exportActions, 'flex-wrap items-center gap-2')}>
                <HubConstructorLink
                  payload={{
                    dateFrom: dateRange.from,
                    dateTo: dateRange.to,
                    modules: ['balance'],
                    groupBy,
                    filters: {
                      reconciliacion: {
                        ...(selectedMolinos.length ? { molinos: { in: selectedMolinos } } : {}),
                        ...(selectedMinas.length ? { minas: { in: selectedMinas } } : {}),
                      },
                    },
                  }}
                />
                <button type="button" onClick={handleExportPDF} className={ui.btnExport}>
                  <FileText className="h-4 w-4 shrink-0" />
                  PDF
                </button>
                <button type="button" onClick={handleExportCSV} className={ui.btnExport}>
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  CSV
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="flex gap-3 items-center p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : null}

          {isPending && !payload ? (
            <div className={ui.emptyState}>
              <Loader2 className={cn('h-6 w-6 animate-spin', ui.metaText)} />
              <p className={ui.emptyTitle}>Calculando balance en vivo…</p>
            </div>
          ) : null}

          {!isPending && payload && payload.aggregated.rows.length === 0 && !error ? (
            <div className={ui.emptyState}>
              <HelpCircle className="h-8 w-8 text-[var(--dashboard-text-muted)] opacity-60" />
              <p className={ui.emptyTitle}>Sin periodos en el rango</p>
              <p className={ui.emptyHint}>
                Amplía fechas o quita filtros de molino/mina.
              </p>
            </div>
          ) : null}

          {payload && payload.aggregated.rows.length > 0 && !error ? (
            <div className="reportes-ui__preview-body flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <BalanceKpiStrip kpis={payload.aggregated.kpis} />
              <BalancePeriodTable rows={payload.aggregated.rows} />
            </div>
          ) : null}
        </div>
      </div>

      <MobileFilterSheet open={filtersOpen} onClose={closeFilters} title="Filtros balance">
        {filtersPanel}
      </MobileFilterSheet>
    </div>
  );
}
