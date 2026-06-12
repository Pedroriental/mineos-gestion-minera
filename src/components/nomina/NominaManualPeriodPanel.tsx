'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  CalendarRange,
  ClipboardCheck,
  Eye,
  Loader2,
  Trash2,
  X,
  ArrowRight,
  LayoutGrid,
} from 'lucide-react';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { AppCheckbox } from '@/components/ui/AppCheckbox';
import { AppSelect } from '@/components/ui/AppSelect';
import { consolidarNominaPeriodoAction } from '@/lib/actions/nomina-actions';
import {
  buildDefaultWeekColumnAssignment,
  computeManualPeriodProgress,
  defaultManualPeriod,
  firstOpenWeekInPeriod,
  formatManualWeekLabel,
  createManualPeriodId,
  manualPeriodConsolidateLabel,
  manualPeriodWeekStarts,
  resetManualPeriodSession,
  type ManualNominaPeriod,
  weekInManualPeriod,
} from '@/lib/nomina/manual-period';
import {
  buildDefaultWeekColumnCuadrillas,
  cuadrillaNombresForColumns,
  referenceRotationSemanas,
  remapWeekColumnCuadrillasForPlantilla,
  weekColumnCuadrillasEqual,
} from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import {
  estatusRotacionPreviewClass,
  estatusRotacionShort,
} from '@/lib/rotacion-plantillas/types';
import { getWeekEnd } from '@/lib/nomina/week-utils';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { AppSelectOption } from '@/components/ui/AppSelect';
import {
  mineosBtnSubtleClass,
  mineosKpiValue,
  mineosPanel,
  MINEOS_BTN_NOMINA_PRIMARY,
} from '@/lib/mineos-visual';
import type { NominaSemana } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  semanas: NominaSemana[];
  area: string;
  weekStart: string;
  period: ManualNominaPeriod | null;
  plantillas: RotacionPlantillaRecord[];
  onPeriodChange: (
    period: ManualNominaPeriod | null,
    meta?: { fromConsolidated?: boolean; resetReconsolidation?: boolean },
  ) => void;
  onGoToWeek: (inicio: string, fin: string) => void;
  onOpenSemanal?: () => void;
  onOpenWeek?: (weekStart: string) => void;
  userId?: string;
  onConsolidated?: () => void;
  /** Periodo ya consolidado en archivo y sin cambios tras revertir. */
  consolidatedLocked?: boolean;
  onExitEditor?: () => void;
  onDeleteDraft?: () => void;
  canEdit?: boolean;
};

export function NominaManualPeriodPanel({
  semanas,
  area,
  weekStart,
  period,
  plantillas,
  onPeriodChange,
  onGoToWeek,
  onOpenSemanal,
  onOpenWeek,
  userId,
  onConsolidated,
  consolidatedLocked = false,
  onExitEditor,
  onDeleteDraft,
  canEdit = true,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ManualNominaPeriod>(() =>
    defaultManualPeriod(undefined, plantillas[0]),
  );

  useEffect(() => {
    if (!period) {
      setDraft((d) => ({ ...d, label: '' }));
    }
  }, [period]);

  const progress = useMemo(
    () => (period ? computeManualPeriodProgress(period, semanas, area) : null),
    [period, semanas, area],
  );

  const activeWeekInPeriod = period ? weekInManualPeriod(weekStart, period) : false;
  const pctClosed =
    progress && progress.totalWeeks > 0
      ? Math.round((progress.closedCount / progress.totalWeeks) * 100)
      : 0;

  const plantillaOptions = useMemo(
    () =>
      plantillas.map((p) => ({
        value: p.id,
        label: p.nombre,
      })),
    [plantillas],
  );

  const plantillaActiva = period ? plantillas.find((p) => p.id === period.plantillaId) : null;
  const rotationColumns = plantillaActiva ? referenceRotationSemanas(plantillaActiva) : [];
  const calendarWeeks = progress?.weeks ?? [];

  const columnCount = rotationColumns.length || calendarWeeks.length;

  const weekColumnAssignment = useMemo(() => {
    if (!period) return [];
    if (period.weekColumnAssignment?.length) return period.weekColumnAssignment;
    return buildDefaultWeekColumnAssignment(calendarWeeks, columnCount);
  }, [period, calendarWeeks, columnCount]);

  const weekColumnCuadrillas = useMemo(() => {
    if (!period || !plantillaActiva) return [];
    return remapWeekColumnCuadrillasForPlantilla(
      period.weekColumnCuadrillas,
      plantillaActiva,
      columnCount,
      period.weekColumnCuadrillaNombres,
    );
  }, [period, plantillaActiva, columnCount]);

  useEffect(() => {
    if (!period || !plantillaActiva) return;
    const needsWeeks = !period.weekColumnAssignment?.length;
    const remapped = remapWeekColumnCuadrillasForPlantilla(
      period.weekColumnCuadrillas,
      plantillaActiva,
      columnCount,
      period.weekColumnCuadrillaNombres,
    );
    const needsCuadrillas = !period.weekColumnCuadrillas?.length;
    const staleCuadrillas =
      !!period.weekColumnCuadrillas?.length &&
      !weekColumnCuadrillasEqual(period.weekColumnCuadrillas, remapped, plantillaActiva);
    if (!needsWeeks && !needsCuadrillas && !staleCuadrillas) return;

    const nextCuadrillas = needsCuadrillas || staleCuadrillas ? remapped : period.weekColumnCuadrillas;
    onPeriodChange({
      ...period,
      weekColumnAssignment: needsWeeks
        ? buildDefaultWeekColumnAssignment(calendarWeeks, columnCount)
        : period.weekColumnAssignment,
      weekColumnCuadrillas: nextCuadrillas,
      weekColumnCuadrillaNombres:
        needsCuadrillas || staleCuadrillas
          ? cuadrillaNombresForColumns(remapped, plantillaActiva)
          : period.weekColumnCuadrillaNombres,
    });
  }, [period, plantillaActiva, calendarWeeks, columnCount, onPeriodChange]);

  const calendarWeekOptions = useMemo((): AppSelectOption[] => {
    return [
      { value: '', label: '— Sin asignar —' },
      ...calendarWeeks.map((w) => ({ value: w, label: formatManualWeekLabel(w) })),
    ];
  }, [calendarWeeks]);

  function setColumnWeek(colIdx: number, weekStartIso: string) {
    if (!period) return;
    const next = [...weekColumnAssignment];
    while (next.length <= colIdx) next.push('');
    for (let i = 0; i < next.length; i++) {
      if (i !== colIdx && weekStartIso && next[i] === weekStartIso) next[i] = '';
    }
    next[colIdx] = weekStartIso;
    onPeriodChange({ ...period, weekColumnAssignment: next });
  }

  function toggleColumnCuadrilla(colIdx: number, cuadrillaId: string) {
    if (!period || !plantillaActiva) return;
    const next = weekColumnCuadrillas.map((col, i) => [...(col ?? [])]);
    while (next.length <= colIdx) next.push([]);
    const col = next[colIdx];
    const idx = col.indexOf(cuadrillaId);
    if (idx >= 0) {
      if (col.length <= 1) {
        toast.error('Debe quedar al menos una cuadrilla en el intervalo.');
        return;
      }
      col.splice(idx, 1);
    } else {
      col.push(cuadrillaId);
    }
    next[colIdx] = col.sort(
      (a, b) =>
        (plantillaActiva.cuadrillas.find((c) => c.id === a)?.orden ?? 0) -
        (plantillaActiva.cuadrillas.find((c) => c.id === b)?.orden ?? 0),
    );
    onPeriodChange({
      ...period,
      weekColumnCuadrillas: next,
      weekColumnCuadrillaNombres: cuadrillaNombresForColumns(next, plantillaActiva),
    });
  }

  function activatePeriod(p?: ManualNominaPeriod) {
    const base = p ?? draft;
    if (!base.plantillaId) {
      toast.error('Seleccione una plantilla de rotación.');
      return;
    }
    if (!base.label.trim()) {
      toast.error('Indique el nombre del periodo.');
      return;
    }
    const pl = plantillas.find((x) => x.id === base.plantillaId);
    const calendarWeeks = manualPeriodWeekStarts(base.rangeStart, base.rangeEnd);
    const columnCount = pl ? referenceRotationSemanas(pl).length : calendarWeeks.length;
    const next: ManualNominaPeriod = {
      ...base,
      id: base.id || createManualPeriodId(),
      label: base.label.trim(),
      plantillaNombre: pl?.nombre ?? base.plantillaNombre,
      weekColumnAssignment: buildDefaultWeekColumnAssignment(
        calendarWeeks,
        columnCount || calendarWeeks.length,
      ),
      weekColumnCuadrillas: pl
        ? buildDefaultWeekColumnCuadrillas(pl, columnCount || calendarWeeks.length)
        : undefined,
      weekColumnCuadrillaNombres: pl
        ? cuadrillaNombresForColumns(
            buildDefaultWeekColumnCuadrillas(pl, columnCount || calendarWeeks.length),
            pl,
          )
        : undefined,
    };
    onPeriodChange(next, { fromConsolidated: false });
    setDraft(next);
    const first = firstOpenWeekInPeriod(next, semanas, area);
    if (first) {
      onGoToWeek(first, getWeekEnd(first));
      toast.success(`Periodo «${next.label}» · plantilla «${next.plantillaNombre}»`);
    } else {
      toast.info(`«${next.label}»: todas las semanas ya están cerradas.`);
    }
  }

  function openWeekInSemanal(w: string) {
    onOpenWeek?.(w);
    onGoToWeek(w, getWeekEnd(w));
    onOpenSemanal?.();
  }

  function handleConsolidate() {
    if (!period || !progress?.allClosed) return;
    const pl =
      plantillaActiva ?? plantillas.find((p) => p.id === period.plantillaId) ?? null;
    startTransition(async () => {
      const res = await consolidarNominaPeriodoAction({
        label: manualPeriodConsolidateLabel(period),
        rangeStart: period.rangeStart,
        rangeEnd: period.rangeEnd,
        userId,
        area,
        metadata: {
          plantilla_id: period.plantillaId,
          plantilla_nombre: period.plantillaNombre,
          week_column_assignment: period.weekColumnAssignment,
          week_column_cuadrillas: weekColumnCuadrillas,
          week_column_cuadrilla_nombres: pl
            ? cuadrillaNombresForColumns(weekColumnCuadrillas, pl)
            : [],
        },
      });
      if (res.ok) {
        toast.success(res.message);
        resetManualPeriodSession(area);
        onPeriodChange(null);
        onConsolidated?.();
      } else toast.error(res.message);
    });
  }

  if (!period) {
    return (
      <section className={cn(mineosPanel('general'), 'w-full min-w-0 space-y-3 !p-2.5 lg:!p-3')}>
        <header className="flex items-start gap-2">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-[var(--mineos-general-bright)]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Armar periodo manualmente
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Defina el rango, elija la plantilla de rotación y cargue cada semana en Vista Semanal
              por cuadrillas.
            </p>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Plantilla de rotación
              </label>
              {plantillas.length ? (
                <AppSelect
                  value={draft.plantillaId}
                  onChange={(v) => {
                    const pl = plantillas.find((p) => p.id === v);
                    setDraft((d) => ({
                      ...d,
                      plantillaId: v,
                      plantillaNombre: pl?.nombre ?? '',
                    }));
                  }}
                  options={plantillaOptions}
                  placeholder="Seleccione plantilla…"
                />
              ) : (
                <p className="text-xs text-[var(--mineos-expense)]">
                  No hay plantillas. Créelas en Plantillas Rotación.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Nombre del periodo
              </label>
              <input
                type="text"
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="Ej: 5ta semana de mayo"
                className="input-field w-full text-sm"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Desde
              </label>
              <AppDatePicker
                value={draft.rangeStart}
                onChange={(v) => setDraft((d) => ({ ...d, rangeStart: v }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Hasta
              </label>
              <AppDatePicker
                value={draft.rangeEnd}
                onChange={(v) => setDraft((d) => ({ ...d, rangeEnd: v }))}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => activatePeriod()}
                disabled={!plantillas.length}
                className={cn(
                  MINEOS_BTN_NOMINA_PRIMARY,
                  'inline-flex h-10 w-full items-center justify-center gap-2 text-xs disabled:opacity-40',
                )}
              >
                <CalendarRange className="h-4 w-4" />
                Iniciar periodo
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn(mineosPanel('general'), 'w-full min-w-0 !p-2 lg:!p-2.5')}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-bold leading-tight text-[var(--text-primary)]">
              {period.label}
            </h3>
            {plantillaActiva && (
              <span className="inline-flex max-w-full items-center gap-0.5 rounded border border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] px-1.5 py-px text-[9px] font-semibold text-[var(--mineos-general-bright)]">
                <LayoutGrid className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{plantillaActiva.nombre}</span>
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
            {period.rangeStart} — {period.rangeEnd}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canEdit && onDeleteDraft && (
            <button
              type="button"
              onClick={onDeleteDraft}
              className={cn(
                mineosBtnSubtleClass('neutral'),
                'h-6 px-1.5 text-[10px] text-[var(--text-muted)] hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-400',
              )}
              title="Descartar ciclo en desarrollo"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => (onExitEditor ? onExitEditor() : onPeriodChange(null))}
            className={cn(mineosBtnSubtleClass('neutral'), 'h-6 shrink-0 px-1.5 text-[10px]')}
          >
            <X className="h-3 w-3" />
            Salir
          </button>
        </div>
      </header>

      {progress && (
        <div className="mt-2 space-y-1.5 border-t border-[var(--card-border)] pt-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex min-w-[8rem] flex-1 items-center gap-2">
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Progreso
              </span>
              <div className="h-1 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-[var(--card-border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--mineos-general-deep)] to-[var(--mineos-general-bright)] transition-all duration-500"
                  style={{ width: `${pctClosed}%` }}
                />
              </div>
              <span className={cn(mineosKpiValue('benefit'), 'shrink-0 text-xs font-bold tabular-nums')}>
                {pctClosed}%
              </span>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Total Nómina (USD)
              </p>
              <p className={cn(mineosKpiValue('general'), 'text-xs font-bold tabular-nums leading-tight')}>
                ${progress.totalUsd.toLocaleString('es', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {rotationColumns.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-[var(--card-border)] bg-[var(--surface-elevated)]/30">
              <table className="w-full min-w-[280px] border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-sky-950/20">
                    {rotationColumns.map((sem, colIdx) => {
                      const assignedWeek = weekColumnAssignment[colIdx] ?? '';
                      const weekTotalUsd =
                        assignedWeek && progress.weekTotalsUsd[assignedWeek] != null
                          ? progress.weekTotalsUsd[assignedWeek]
                          : null;
                      const weekClosed =
                        assignedWeek && progress.closedWeeks.includes(assignedWeek);
                      return (
                      <th
                        key={sem.id}
                        className="min-w-[96px] border-r border-[var(--card-border)] px-2 py-1.5 align-middle last:border-r-0"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex w-full items-center justify-center gap-1.5">
                            <span className="text-center font-bold leading-snug text-[var(--text-primary)]">
                              {sem.nombre}
                            </span>
                            {assignedWeek ? (
                              <button
                                type="button"
                                onClick={() => openWeekInSemanal(assignedWeek)}
                                title={
                                  weekClosed
                                    ? `Ver semana · ${formatManualWeekLabel(assignedWeek)}`
                                    : `Cargar semana · ${formatManualWeekLabel(assignedWeek)}`
                                }
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--card-border)]/70 hover:text-[var(--mineos-general-bright)]"
                              >
                                <Eye className="h-3 w-3" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                          <span
                            className={cn(
                              'inline-flex rounded px-1.5 py-px text-[8px] font-semibold',
                              estatusRotacionPreviewClass(sem.estatusDefault),
                            )}
                          >
                            {estatusRotacionShort(sem.estatusDefault)}
                          </span>
                          {assignedWeek ? (
                            weekClosed && weekTotalUsd != null ? (
                              <p
                                className={cn(
                                  mineosKpiValue('general'),
                                  'text-[9px] font-bold tabular-nums leading-tight',
                                )}
                              >
                                ${weekTotalUsd.toLocaleString('es', { minimumFractionDigits: 2 })}
                              </p>
                            ) : (
                              <p className="text-[8px] font-medium tabular-nums text-[var(--text-muted)]">
                                Pendiente
                              </p>
                            )
                          ) : null}
                        </div>
                      </th>
                    );})}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {rotationColumns.map((sem, colIdx) => {
                      const assigned = weekColumnAssignment[colIdx] ?? '';
                      const active = assigned === weekStart;
                      return (
                        <td
                          key={sem.id}
                          className={cn(
                            'border-r border-[var(--card-border)] px-2 py-2 align-top last:border-r-0',
                            active && 'bg-[var(--mineos-general-soft)]/40',
                          )}
                        >
                          <AppSelect
                            value={assigned}
                            onChange={(v) => setColumnWeek(colIdx, v)}
                            options={calendarWeekOptions}
                            placeholder="Intervalo…"
                            className="mb-1"
                          />
                          {!assigned && (
                            <p className="text-[8px] italic text-[var(--text-muted)]">
                              Elija intervalo
                            </p>
                          )}
                          {plantillaActiva && plantillaActiva.cuadrillas.length > 0 && (
                            <div className="mt-1.5 border-t border-[var(--card-border)]/60 pt-1.5">
                              <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                Cuadrillas
                              </p>
                              <div className="max-h-24 space-y-0.5 overflow-y-auto">
                                {plantillaActiva.cuadrillas.map((c) => {
                                  const checked = (weekColumnCuadrillas[colIdx] ?? []).includes(c.id);
                                  return (
                                    <AppCheckbox
                                      key={c.id}
                                      size="sm"
                                      checked={checked}
                                      disabled={!canEdit || consolidatedLocked}
                                      onChange={() => toggleColumnCuadrilla(colIdx, c.id)}
                                      className="w-full text-[8px] leading-tight"
                                    >
                                      <span className="truncate">{c.nombre}</span>
                                    </AppCheckbox>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
              <p className="border-t border-[var(--card-border)] px-2 py-1 text-[8px] leading-snug text-[var(--text-muted)]">
                Asigne intervalo y cuadrillas por columna del ciclo. Los estatus (libre pagada, etc.)
                se aplican solos en Vista Semanal según la plantilla.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                const next = firstOpenWeekInPeriod(period, semanas, area);
                if (next) openWeekInSemanal(next);
                else toast.info('Todas las semanas están cerradas.');
              }}
              className={cn(
                MINEOS_BTN_NOMINA_PRIMARY,
                'inline-flex h-7 items-center gap-1 px-2.5 text-[10px]',
              )}
            >
              Vista Semanal
              <ArrowRight className="h-3 w-3" />
            </button>
            {progress.allClosed &&
              (consolidatedLocked ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-7 cursor-default items-center rounded-md border border-[var(--card-border)] bg-[var(--surface-elevated)]/60 px-2.5 text-[10px] font-semibold text-[var(--text-muted)]/80"
                >
                  Consolidado
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConsolidate}
                  disabled={pending}
                  className={cn(mineosBtnSubtleClass('benefit'), 'h-7 px-2 text-[10px]')}
                >
                  {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Consolidar
                </button>
              ))}
            {!activeWeekInPeriod && (
              <span className="text-[9px] text-[var(--mineos-general-bright)]">
                Semana actual fuera del periodo
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
