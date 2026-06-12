'use client';

import { ManualPeriodsSessionBar } from '@/components/nomina/ManualPeriodsSessionBar';
import { NominaManualPeriodPanel } from '@/components/nomina/NominaManualPeriodPanel';
import { NominaPeriodosRegistradosPanel } from '@/components/nomina/NominaPeriodosRegistradosPanel';
import { RotacionInstanciaBanner } from '@/components/nomina/RotacionInstanciaPanel';
import type { InstanciaActivaSerialized } from '@/lib/rotacion-plantillas/instancia-serialize';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import { mineosPanel } from '@/lib/mineos-visual';
import {
  getEditorPeriod,
  type ManualPeriodsSession,
} from '@/lib/nomina/manual-period-session';
import type { ManualNominaPeriod } from '@/lib/nomina/manual-period';
import { getWeekEnd } from '@/lib/nomina/week-utils';
import type { NominaSemana } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react';

type Props = {
  area: string;
  canEdit: boolean;
  semanas: NominaSemana[];
  weekStart: string;
  workingWeekStart: string;
  periodsSession: ManualPeriodsSession;
  onSessionChange: (session: ManualPeriodsSession) => void;
  onEditorPeriodChange: (
    period: ManualNominaPeriod | null,
    meta?: { fromConsolidated?: boolean; resetReconsolidation?: boolean },
  ) => void;
  onWorkingWeekPeriodChange: (periodId: string | null) => void;
  onStartNewPeriod: () => void;
  onDeleteDraftPeriod?: () => void;
  plantillas: RotacionPlantillaRecord[];
  onGoToWeek: (inicio: string, fin: string) => void;
  onOpenSemanal: () => void;
  onGoPlantillas: () => void;
  instanciaActiva?: InstanciaActivaSerialized | null;
  userId?: string;
  onConsolidated?: () => void;
  periodosRefreshKey?: number;
  consolidatedLockedPeriodIds?: Set<string>;
};

export function NominaCiclosView({
  area,
  canEdit,
  semanas,
  weekStart,
  workingWeekStart,
  periodsSession,
  onSessionChange,
  onEditorPeriodChange,
  onWorkingWeekPeriodChange,
  onStartNewPeriod,
  onDeleteDraftPeriod,
  plantillas,
  onGoToWeek,
  onOpenSemanal,
  onGoPlantillas,
  instanciaActiva = null,
  userId,
  onConsolidated,
  periodosRefreshKey = 0,
  consolidatedLockedPeriodIds = new Set(),
}: Props) {
  const editorPeriod = getEditorPeriod(periodsSession);
  const editorLocked =
    editorPeriod != null && consolidatedLockedPeriodIds.has(editorPeriod.id);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-2.5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:gap-4 lg:p-3 lg:pb-3">
      <ManualPeriodsSessionBar
        session={periodsSession}
        workingWeekStart={workingWeekStart}
        canEdit={canEdit}
        onEditorPeriodChange={(id) =>
          onSessionChange({
            ...periodsSession,
            editorPeriodId: id,
            historicalPeriodId: id ?? periodsSession.historicalPeriodId,
          })
        }
        onWorkingWeekPeriodChange={onWorkingWeekPeriodChange}
        onStartNewPeriod={onStartNewPeriod}
        onDeleteEditorPeriod={canEdit ? onDeleteDraftPeriod : undefined}
      />

      <NominaManualPeriodPanel
        semanas={semanas}
        area={area}
        weekStart={weekStart}
        period={editorPeriod}
        plantillas={plantillas}
        onPeriodChange={onEditorPeriodChange}
        onGoToWeek={onGoToWeek}
        onOpenSemanal={onOpenSemanal}
        onOpenWeek={(w) => {
          if (editorPeriod) {
            onSessionChange({
              ...periodsSession,
              historicalPeriodId: editorPeriod.id,
            });
          }
        }}
        userId={userId}
        onConsolidated={onConsolidated}
        consolidatedLocked={editorLocked}
        canEdit={canEdit}
        onDeleteDraft={canEdit ? onDeleteDraftPeriod : undefined}
        onExitEditor={() =>
          onSessionChange({ ...periodsSession, editorPeriodId: null })
        }
      />

      {instanciaActiva && (
        <div className={cn(mineosPanel('general'), 'w-full min-w-0')}>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            <LayoutGrid className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
            Rotación operativa (plantilla)
          </div>
          <RotacionInstanciaBanner instanciaActiva={instanciaActiva} weekStart={weekStart} />
          <button
            type="button"
            onClick={onGoPlantillas}
            className="mt-2 text-[11px] font-semibold text-[var(--mineos-general-bright)] hover:underline"
          >
            Gestionar plantillas →
          </button>
        </div>
      )}

      <NominaPeriodosRegistradosPanel
        area={area}
        semanas={semanas}
        activePeriod={editorPeriod}
        refreshKey={periodosRefreshKey}
        userId={userId}
        onViewPeriod={(p) => onEditorPeriodChange(p, { fromConsolidated: true })}
        onWorkWeek={(p, ws) => {
          onEditorPeriodChange(p, { fromConsolidated: true, resetReconsolidation: false });
          onSessionChange({
            ...periodsSession,
            editorPeriodId: p.id,
            historicalPeriodId: p.id,
          });
          onGoToWeek(ws, getWeekEnd(ws));
          onOpenSemanal();
        }}
        onPeriodDeleted={onConsolidated}
      />
    </div>
  );
}
