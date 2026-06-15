'use client';

import { useCallback, useState, useTransition } from 'react';
import type { DateRange } from '@/lib/reports/report-types';
import { fetchReconciliationDrillDown } from '@/lib/actions/reconciliation-actions';
import type { DrillDownRow } from '@/lib/reconciliation/types';

export function useReconciliationDrillDown(dateRange: DateRange) {
  const [drillRuleId, setDrillRuleId] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<DrillDownRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [, startTransition] = useTransition();

  const openDrillDown = useCallback(
    (ruleId: string) => {
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
    },
    [dateRange],
  );

  const closeDrillDown = useCallback(() => {
    setDrillRuleId(null);
    setDrillRows([]);
  }, []);

  return {
    drillRuleId,
    drillRows,
    drillLoading,
    openDrillDown,
    closeDrillDown,
  };
}
