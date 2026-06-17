'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import type { DateRange, ModuleFilters } from '@/lib/reports/report-types';
import { fetchReconciliationSnapshot } from '@/lib/actions/reconciliation-actions';
import type { ReconciliationSnapshot } from '@/lib/reconciliation/types';
import { parseOperationalFilters } from '@/lib/reports/live-modules/operational-filters';
import { useReconciliationDrillDown } from '@/hooks/useReconciliationDrillDown';
import { ReconciliacionAnalysisView } from '@/components/reportes/ReconciliacionAnalysisView';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { cn } from '@/lib/utils';

type Props = {
  dateRange: DateRange;
  moduleFilters?: ModuleFilters;
};

export function ConstructorReconciliationRich({ dateRange, moduleFilters }: Props) {
  const [snapshot, setSnapshot] = useState<ReconciliationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const operationalFilters = useMemo(
    () => parseOperationalFilters(moduleFilters),
    [moduleFilters],
  );
  const {
    drillRuleId,
    drillRows,
    drillLoading,
    openDrillDown,
    closeDrillDown,
  } = useReconciliationDrillDown(dateRange);

  useEffect(() => {
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
  }, [dateRange.from, dateRange.to, operationalFilters]);

  if (isPending && !snapshot) {
    return (
      <div className={ui.emptyState}>
        <Loader2 className={cn('h-6 w-6 animate-spin', ui.statusGeneral)} />
        <p className={ui.emptyTitle}>Cargando matriz de reconciliación…</p>
      </div>
    );
  }

  if (error) {
    return <p className={ui.inlineError}>{error}</p>;
  }

  if (!snapshot) {
    return (
      <p className={cn(ui.metaText, 'py-4 text-center italic')}>
        Sin snapshot para el periodo seleccionado
      </p>
    );
  }

  return (
    <ReconciliacionAnalysisView
      snapshot={snapshot}
      dateRange={dateRange}
      drillRuleId={drillRuleId}
      drillRows={drillRows}
      drillLoading={drillLoading}
      onDrillDown={openDrillDown}
      onCloseDrill={closeDrillDown}
    />
  );
}
