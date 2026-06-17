'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { DateRange, ReportModule } from '@/lib/reports/report-types';
import {
  aggregateOperationalTab,
  fetchOperationalTabRaw,
  type AggregatedReportResult,
  type OperationalReportTab,
  type ReportTabFilters,
} from '@/lib/reports/hub/report-tab-fetch';

type Params = {
  activeTab: ReportModule;
  dateRange: DateRange;
  filters: ReportTabFilters;
  enabled: boolean;
};

export function useReportTabData({ activeTab, dateRange, filters, enabled }: Params) {
  const [rawData, setRawData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOperational =
    enabled &&
    activeTab !== 'reconciliacion' &&
    activeTab !== 'balance';

  useEffect(() => {
    if (!isOperational) {
      setRawData(null);
      return;
    }

    const tab = activeTab as OperationalReportTab;
    setError(null);
    startTransition(async () => {
      try {
        const fetched = await fetchOperationalTabRaw(tab, dateRange, filters[tab]);
        setRawData(fetched);
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError('No se pudieron obtener los datos filtrados de la base de datos.');
        setRawData(null);
      }
    });
  }, [isOperational, activeTab, dateRange, filters]);

  const aggregated = useMemo<AggregatedReportResult | null>(() => {
    if (!isOperational || !rawData || error) return null;
    return aggregateOperationalTab(activeTab as OperationalReportTab, rawData, filters[activeTab as OperationalReportTab]);
  }, [isOperational, rawData, error, activeTab, filters]);

  return { aggregated, error, isPending, rawData };
}
