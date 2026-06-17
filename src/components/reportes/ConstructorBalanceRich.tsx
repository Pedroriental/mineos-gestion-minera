'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { HelpCircle, Loader2 } from 'lucide-react';
import type { DateRange, ModuleFilters } from '@/lib/reports/report-types';
import type { BalanceGroupBy } from '@/lib/reconciliation/aggregate-balance';
import { fetchBalanceReportAggregated } from '@/lib/actions/reconciliation-actions';
import { buildOperationalFilters, parseOperationalFilters } from '@/lib/reports/live-modules/operational-filters';
import { normalizeBalanceGroupBy } from '@/lib/reconciliation/aggregate-balance';
import { BalanceKpiStrip } from '@/components/reportes/BalanceKpiStrip';
import { BalancePeriodTable } from '@/components/reportes/BalancePeriodTable';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { cn } from '@/lib/utils';

type Props = {
  dateRange: DateRange;
  groupBy: string;
  moduleFilters?: ModuleFilters;
  reconciliationFilters?: ModuleFilters;
};

export function ConstructorBalanceRich({
  dateRange,
  groupBy,
  moduleFilters,
  reconciliationFilters,
}: Props) {
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof fetchBalanceReportAggregated>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const balanceGroupBy = useMemo(
    () => normalizeBalanceGroupBy(groupBy) as BalanceGroupBy,
    [groupBy],
  );

  const operationalFilters = useMemo(() => {
    const fromRecon = parseOperationalFilters(reconciliationFilters);
    if (fromRecon) return fromRecon;
    const molinos = moduleFilters?.molino ?? moduleFilters?.molinos;
    const minas = moduleFilters?.mina ?? moduleFilters?.minas;
    const molList = Array.isArray(molinos)
      ? molinos.map(String)
      : molinos && typeof molinos === 'object' && 'in' in molinos
        ? molinos.in.map(String)
        : [];
    const minaList = Array.isArray(minas)
      ? minas.map(String)
      : minas && typeof minas === 'object' && 'in' in minas
        ? minas.in.map(String)
        : [];
    return buildOperationalFilters(molList, minaList);
  }, [moduleFilters, reconciliationFilters]);

  const load = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await fetchBalanceReportAggregated(
          dateRange,
          balanceGroupBy,
          operationalFilters,
        );
        setPayload(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar balance');
        setPayload(null);
      }
    });
  }, [dateRange, balanceGroupBy, operationalFilters]);

  useEffect(() => {
    load();
  }, [load]);

  if (isPending && !payload) {
    return (
      <div className={ui.emptyState}>
        <Loader2 className={cn('h-6 w-6 animate-spin', ui.metaText)} />
        <p className={ui.emptyTitle}>Calculando balance en vivo…</p>
      </div>
    );
  }

  if (error) {
    return <p className={ui.inlineError}>{error}</p>;
  }

  if (!payload || payload.aggregated.rows.length === 0) {
    return (
      <div className={ui.emptyState}>
        <HelpCircle className="h-8 w-8 text-[var(--dashboard-text-muted)] opacity-60" />
        <p className={ui.emptyTitle}>Sin periodos en el rango</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className={cn(ui.fieldLabel, 'flex items-center gap-1')}>Precio oro aplicado</label>
        <p className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-2.5 py-1.5 text-sm tabular-nums text-[var(--dashboard-text)]">
          {`${payload.precioOro.usdPorGramo.toFixed(2)}/g · ${payload.precioOro.origenUi}`}
        </p>
      </div>
      <BalanceKpiStrip kpis={payload.aggregated.kpis} />
      <BalancePeriodTable rows={payload.aggregated.rows} />
    </div>
  );
}
