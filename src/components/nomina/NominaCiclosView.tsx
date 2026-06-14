'use client';

import { ManualPeriodsSessionBar } from '@/components/nomina/ManualPeriodsSessionBar';
import { NominaManualPeriodPanel } from '@/components/nomina/NominaManualPeriodPanel';
import { NominaProximosPagos } from '@/components/nomina/NominaProximosPagos';
import { RotacionInstanciaBanner } from '@/components/nomina/RotacionInstanciaPanel';
import type { InstanciaActivaSerialized } from '@/lib/rotacion-plantillas/instancia-serialize';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import { mineosPanel } from '@/lib/mineos-visual';
import {
  getEditorPeriod,
  type ManualPeriodsSession,
} from '@/lib/nomina/manual-period-session';
import type { ManualNominaPeriod } from '@/lib/nomina/manual-period';
import type { NominaSemana, Personal } from '@/lib/types';
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
  onGoCierreMes?: () => void;
  instanciaActiva?: InstanciaActivaSerialized | null;
  userId?: string;
  onConsolidated?: () => void;
  consolidatedLockedPeriodIds?: Set<string>;
  personal?: Personal[];
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
  onGoCierreMes,
  instanciaActiva = null,
  userId,
  onConsolidated,
  consolidatedLockedPeriodIds = new Set(),
  personal = [],
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

      {onGoCierreMes ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--mineos-general-border)]/40 bg-[var(--mineos-general-soft)]/10 px-3 py-2">
          <p className="text-pretty text-[11px] text-[var(--text-muted)]">
            ¿Listo para archivar el mes? Los ciclos consolidados se cierran en su propia vista.
          </p>
          <button
            type="button"
            onClick={onGoCierreMes}
            className="shrink-0 text-[11px] font-bold text-[var(--mineos-general-bright)] hover:underline"
          >
            Ir a Cierre de mes →
          </button>
        </div>
      ) : null}

      {personal.length > 0 && (
        <NominaProximosPagos
          personal={personal}
          area={area}
          workingWeekStart={workingWeekStart}
        />
      )}

      <NominaManualPeriodPanel
        semanas={semanas}
        area={area}
        weekStart={weekStart}
        period={editorPeriod}
        plantillas={plantillas}
        onPeriodChange={onEditorPeriodChange}
        onGoToWeek={onGoToWeek}
        onOpenSemanal={onOpenSemanal}
        onOpenWeek={() => {
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
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-[var(--text-muted)]">
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
    </div>
  );
}
