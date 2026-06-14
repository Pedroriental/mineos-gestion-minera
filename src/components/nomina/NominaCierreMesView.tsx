'use client';

import { NominaMesCierrePanel } from '@/components/nomina/NominaMesCierrePanel';
import { NominaPeriodosRegistradosPanel } from '@/components/nomina/NominaPeriodosRegistradosPanel';
import type { ManualNominaPeriod } from '@/lib/nomina/manual-period';
import type { NominaSemana } from '@/lib/types';

type Props = {
  area: string;
  canEdit: boolean;
  semanas: NominaSemana[];
  activePeriod: ManualNominaPeriod | null;
  refreshKey?: number;
  userId?: string;
  onConsolidated?: () => void;
  onViewPeriod: (period: ManualNominaPeriod) => void;
  onWorkWeek: (period: ManualNominaPeriod, weekStart: string) => void;
};

export function NominaCierreMesView({
  area,
  canEdit,
  semanas,
  activePeriod,
  refreshKey = 0,
  userId,
  onConsolidated,
  onViewPeriod,
  onWorkWeek,
}: Props) {
  const areaKey = area === 'planta' || area === 'mina' ? area : 'mina';

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-2.5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:gap-4 lg:p-3 lg:pb-3">
      <header className="shrink-0 rounded-xl border border-[var(--mineos-general-border)]/50 bg-[var(--mineos-general-soft)]/15 px-3 py-2.5">
        <h2 className="text-balance text-sm font-bold text-[var(--text-primary)]">
          Cierre de nómina mensual
        </h2>
        <p className="mt-0.5 text-pretty text-[11px] text-[var(--text-muted)]">
          Revise los ciclos consolidados del área, arme el mes y confirme el cierre. Todo en esta
          pantalla, sin mezclarlo con el editor de rotación.
        </p>
      </header>

      <NominaPeriodosRegistradosPanel
        area={area}
        semanas={semanas}
        activePeriod={activePeriod}
        refreshKey={refreshKey}
        userId={userId}
        onViewPeriod={onViewPeriod}
        onWorkWeek={onWorkWeek}
        onPeriodDeleted={onConsolidated}
      />

      <NominaMesCierrePanel
        area={areaKey}
        canEdit={canEdit}
        userId={userId}
        refreshKey={refreshKey}
        onMesClosed={onConsolidated}
      />
    </div>
  );
}
