'use client';

import type { DateRange } from '@/lib/reports/report-types';
import type { ReconciliationSnapshot } from '@/lib/reconciliation/types';
import { getRuleDef } from '@/lib/reconciliation/rules-registry';
import { ReconciliacionDivergenceBanner } from '@/components/reportes/ReconciliacionDivergenceBanner';
import { ReconciliacionRulesMatrix } from '@/components/reportes/ReconciliacionRulesMatrix';
import { ReconciliacionDrillDown } from '@/components/reportes/ReconciliacionDrillDown';
import { ReconciliacionMacroKpis } from '@/components/reportes/ReconciliacionMacroKpis';

type DrillRow = Awaited<
  ReturnType<typeof import('@/lib/actions/reconciliation-actions').fetchReconciliationDrillDown>
>;

type Props = {
  snapshot: ReconciliationSnapshot;
  dateRange: DateRange;
  drillRuleId: string | null;
  drillRows: DrillRow;
  drillLoading: boolean;
  onDrillDown: (ruleId: string) => void;
  onCloseDrill: () => void;
  showMacroKpis?: boolean;
};

export function ReconciliacionAnalysisView({
  snapshot,
  dateRange,
  drillRuleId,
  drillRows,
  drillLoading,
  onDrillDown,
  onCloseDrill,
  showMacroKpis = true,
}: Props) {
  return (
    <div className="reconciliacion-analysis flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {showMacroKpis ? (
        <ReconciliacionMacroKpis macro={snapshot.macro} variant="compact" />
      ) : null}
      <ReconciliacionDivergenceBanner
        snapshot={snapshot}
        onDrillRpc={() => onDrillDown('rpc_divergencia')}
      />
      <ReconciliacionRulesMatrix
        rules={snapshot.rules}
        nominaDivisiones={snapshot.params.nominaDivisiones}
        onDrillDown={onDrillDown}
      />
      {drillRuleId ? (
        <ReconciliacionDrillDown
          ruleId={drillRuleId}
          ruleLabel={getRuleDef(drillRuleId)?.label ?? drillRuleId}
          rows={drillRows}
          isLoading={drillLoading}
          dateFrom={dateRange.from}
          dateTo={dateRange.to}
          onClose={onCloseDrill}
        />
      ) : null}
    </div>
  );
}
