'use client';

import { AppSelect } from '@/components/ui/AppSelect';
import {
  getEditorPeriod,
  periodsContainingWeek,
  periodsEnCurso,
  type ManualPeriodsSession,
} from '@/lib/nomina/manual-period-session';
import { formatManualWeekLabel } from '@/lib/nomina/manual-period';
import { mineosPanel } from '@/lib/mineos-visual';
import { cn } from '@/lib/utils';
import { Layers, Trash2 } from 'lucide-react';

type Props = {
  session: ManualPeriodsSession;
  workingWeekStart: string;
  canEdit?: boolean;
  onEditorPeriodChange: (periodId: string | null) => void;
  onWorkingWeekPeriodChange: (periodId: string | null) => void;
  onStartNewPeriod: () => void;
  onDeleteEditorPeriod?: () => void;
};

export function ManualPeriodsSessionBar({
  session,
  workingWeekStart,
  canEdit = true,
  onEditorPeriodChange,
  onWorkingWeekPeriodChange,
  onStartNewPeriod,
  onDeleteEditorPeriod,
}: Props) {
  const sessionPeriods = Array.isArray(session?.periods) ? session.periods : [];
  const draftPeriods = periodsEnCurso(session);
  const allAvailablePeriods = sessionPeriods.length ? sessionPeriods : draftPeriods;
  if (!allAvailablePeriods.length) return null;

  const editor = getEditorPeriod(session) || getEditorPeriod({ ...session, periods: allAvailablePeriods });
  const workingCandidates = periodsContainingWeek(session, workingWeekStart, false);

  const editorOptions = [
    ...allAvailablePeriods.map((p) => ({
      value: p.id,
      label: p.label.trim() || `${p.rangeStart} — ${p.rangeEnd}`,
    })),
    { value: '__new__', label: '+ Nuevo ciclo…' },
  ];

  const workingOptions = [
    { value: '', label: 'Sin vincular (modo operativo)' },
    ...workingCandidates.map((p) => ({
      value: p.id,
      label: p.label.trim() || `${p.rangeStart} — ${p.rangeEnd}`,
    })),
  ];

  return (
    <section className={cn(mineosPanel('neutral'), 'w-full min-w-0 !p-2.5 lg:!p-3')}>
      <div className="mb-2 flex items-center gap-2">
        <Layers className="h-4 w-4 shrink-0 text-[var(--mineos-general-bright)]" />
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Ciclos armados ({allAvailablePeriods.length})
        </p>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Editar ciclo
          </label>
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <AppSelect
                value={session.editorPeriodId ?? ''}
                onChange={(v) => {
                  if (v === '__new__') onStartNewPeriod();
                  else onEditorPeriodChange(v || null);
                }}
                options={editorOptions}
                placeholder="Seleccione ciclo…"
              />
            </div>
            {canEdit && editor && onDeleteEditorPeriod && (
              <button
                type="button"
                onClick={onDeleteEditorPeriod}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-400"
                title="Descartar ciclo en desarrollo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {editor && (
            <p className="mt-1 text-[9px] tabular-nums text-[var(--text-muted)]">
              {editor.rangeStart} — {editor.rangeEnd}
              {editor.plantillaNombre ? ` · ${editor.plantillaNombre}` : ''}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Semana de curso ({formatManualWeekLabel(workingWeekStart)})
          </label>
          <AppSelect
            value={session.workingWeekPeriodId ?? ''}
            onChange={(v) => onWorkingWeekPeriodChange(v || null)}
            options={workingOptions}
            placeholder="Vincular a ciclo…"
          />
          <p className="mt-1 text-[9px] leading-snug text-[var(--text-muted)]">
            {session.workingWeekPeriodId
              ? 'La plantilla del ciclo aplica en Vista Semanal sin vaciar trabajadores.'
              : workingCandidates.length
                ? 'Elija un ciclo cuyo rango incluya esta semana.'
                : 'Ningún ciclo armado incluye la semana de curso.'}
          </p>
        </div>
      </div>
    </section>
  );
}
