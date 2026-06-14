'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Archive,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Lock,
  ReceiptText,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import {
  cerrarNominaMesAction,
  eliminarCierreMesAction,
  listNominaMesesPanelAction,
  type NominaMesPanelData,
} from '@/lib/actions/nomina-actions';
import {
  rangoDesdeCiclos,
  semanaCountDesdeCiclos,
  sugerirEtiquetaMes,
  totalUsdDesdeCiclos,
} from '@/lib/nomina/cierre-mes';
import { stripPeriodoLabelPrefix } from '@/lib/nomina/manual-period';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import {
  mineosBtnSubtleClass,
  mineosKpiGlow,
  mineosKpiValue,
  mineosPanel,
  MINEOS_BTN_NOMINA_PRIMARY,
  MINEOS_TABLE_ACTION_DELETE,
} from '@/lib/mineos-visual';
import { cn } from '@/lib/utils';

type Props = {
  area: 'mina' | 'planta';
  canEdit?: boolean;
  userId?: string;
  refreshKey?: number;
  onMesClosed?: () => void;
};

const AREA_LABEL: Record<'mina' | 'planta', string> = {
  mina: 'Mina Belén',
  planta: 'Molino La Fé',
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('es', { minimumFractionDigits: 2 })}`;
}

function fmtRango(inicio: string, fin: string): string {
  return `${format(parseISO(inicio), 'dd MMM yyyy', { locale: es })} — ${format(parseISO(fin), 'dd MMM yyyy', { locale: es })}`;
}

function cicloLabel(p: NominaPeriodoSummary): string {
  return stripPeriodoLabelPrefix(p.label);
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'general' | 'benefit' | 'neutral';
}) {
  return (
    <div className="gerencial-kpi-card relative min-w-0 flex-1 overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--surface-elevated)]/40 px-2.5 py-2">
      <div className={mineosKpiGlow(tone)} aria-hidden />
      <p className="relative text-[8px] font-bold uppercase text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          mineosKpiValue(tone),
          'relative mt-0.5 truncate text-sm font-bold tabular-nums',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function NominaMesCierrePanel({
  area,
  canEdit = true,
  userId,
  refreshKey = 0,
  onMesClosed,
}: Props) {
  const confirmDialog = useConfirm();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NominaMesPanelData>({ meses: [], ciclosDisponibles: [] });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState('');
  const [expandedMesId, setExpandedMesId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listNominaMesesPanelAction(area).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setData(res.data);
        setSelectedIds(new Set());
        setLabel('');
      } else {
        toast.error(res.message ?? 'Error al cargar meses');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [area, refreshKey]);

  const selectedCiclos = useMemo(
    () => data.ciclosDisponibles.filter((c) => selectedIds.has(c.id)),
    [data.ciclosDisponibles, selectedIds],
  );

  const previewTotal = useMemo(() => totalUsdDesdeCiclos(selectedCiclos), [selectedCiclos]);
  const previewSemanas = useMemo(() => semanaCountDesdeCiclos(selectedCiclos), [selectedCiclos]);
  const previewRango = useMemo(() => rangoDesdeCiclos(selectedCiclos), [selectedCiclos]);
  const selectedTimeline = useMemo(
    () => [...selectedCiclos].sort((a, b) => a.rangeStart.localeCompare(b.rangeStart)),
    [selectedCiclos],
  );

  const previewLabel = useMemo(() => {
    if (label.trim()) return label.trim();
    if (!selectedCiclos.length) return '';
    return sugerirEtiquetaMes(selectedCiclos);
  }, [label, selectedCiclos]);

  const totalMesesHistorico = useMemo(
    () => parseFloat(data.meses.reduce((s, m) => s + m.totalUsd, 0).toFixed(2)),
    [data.meses],
  );

  const allSelected =
    data.ciclosDisponibles.length > 0 &&
    selectedIds.size === data.ciclosDisponibles.length;

  function toggleCiclo(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(data.ciclosDisponibles.map((c) => c.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function applySuggestedLabel() {
    if (selectedCiclos.length) setLabel(sugerirEtiquetaMes(selectedCiclos));
  }

  function handleCerrarMes() {
    if (!selectedCiclos.length) {
      toast.error('Seleccione al menos un ciclo consolidado.');
      return;
    }
    const finalLabel = previewLabel;
    if (!finalLabel) {
      toast.error('Indique un nombre para el mes.');
      return;
    }
    startTransition(async () => {
      const res = await cerrarNominaMesAction({
        label: finalLabel,
        area,
        periodoIds: [...selectedIds],
        userId,
      });
      if (res.ok) {
        toast.success(res.message);
        onMesClosed?.();
        const reload = await listNominaMesesPanelAction(area);
        if (reload.ok) {
          setData(reload.data);
          setSelectedIds(new Set());
          setLabel('');
        }
      } else {
        toast.error(res.message);
      }
    });
  }

  async function handleDeleteMes(mesId: string, displayLabel: string) {
    if (
      !(await confirmDialog({
        title: 'Eliminar cierre de mes',
        message: `¿Eliminar «${displayLabel}»?\n\nLos ciclos consolidados no se borran; solo se quita el agrupado mensual.`,
        variant: 'danger',
      }))
    ) {
      return;
    }
    setDeletingId(mesId);
    const res = await eliminarCierreMesAction({ mesPeriodoId: mesId, userId });
    setDeletingId(null);
    if (res.ok) {
      toast.success(res.message);
      onMesClosed?.();
      const reload = await listNominaMesesPanelAction(area);
      if (reload.ok) setData(reload.data);
    } else {
      toast.error(res.message);
    }
  }

  return (
    <section className={cn(mineosPanel('general'), 'w-full min-w-0 !p-0')}>
      <header className="border-b border-[var(--card-border)] bg-[var(--surface-elevated)]/20 px-3 py-3 lg:px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] text-[var(--mineos-general-bright)]">
              <CalendarCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-balance text-sm font-bold text-[var(--text-primary)]">
                  Cierre de nómina mensual
                </h3>
                <span className="rounded-full border border-[var(--mineos-general-border)]/50 bg-[var(--mineos-general-soft)]/40 px-2 py-px text-[9px] font-bold uppercase text-[var(--mineos-general-bright)]">
                  {AREA_LABEL[area]}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-pretty text-[11px] leading-snug text-[var(--text-muted)]">
                Construya el mes desde ciclos ya consolidados. La selección respeta el área actual,
                calcula el total y deja el cierre archivado para consulta posterior.
              </p>
            </div>
          </div>

          <div className="flex min-w-[12rem] gap-2">
            <StatChip label="Meses cerrados" value={String(data.meses.length)} tone="general" />
            <StatChip
              label="Total archivado"
              value={fmtUsd(totalMesesHistorico)}
              tone="benefit"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 px-4 py-10 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando cierres de mes…
        </div>
      ) : (
        <div className="space-y-4 p-3 lg:p-4">
          {canEdit ? (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.85fr)]">
              <div className="rounded-xl border border-[var(--mineos-general-border)]/50 bg-[var(--mineos-general-soft)]/20 p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[var(--mineos-general-bright)]">
                      Mes en preparación
                    </p>
                    <h4 className="mt-1 truncate text-lg font-bold text-[var(--text-primary)]">
                      {previewLabel || 'Seleccione ciclos para construir el mes'}
                    </h4>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {previewRango
                        ? fmtRango(previewRango.rangeStart, previewRango.rangeEnd)
                        : 'El rango se calcula automáticamente con los ciclos incluidos.'}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--card-border)] bg-[var(--card-bg)]/60 px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                    {selectedCiclos.length} de {data.ciclosDisponibles.length} ciclos
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]/55 px-3 py-2">
                    <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase text-[var(--text-muted)]">
                      <CircleDollarSign className="size-3" />
                      Total a registrar
                    </div>
                    <p
                      className={cn(
                        mineosKpiValue('benefit'),
                        'text-xl font-bold tabular-nums leading-tight',
                      )}
                    >
                      {fmtUsd(previewTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]/55 px-3 py-2">
                    <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase text-[var(--text-muted)]">
                      <ReceiptText className="size-3" />
                      Ciclos incluidos
                    </div>
                    <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">
                      {selectedCiclos.length}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]/55 px-3 py-2">
                    <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase text-[var(--text-muted)]">
                      <CalendarDays className="size-3" />
                      Semanas
                    </div>
                    <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">
                      {previewSemanas}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]/45 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[9px] font-bold uppercase text-[var(--text-muted)]">
                      Composición del mes
                    </p>
                    {selectedCiclos.length > 0 ? (
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-[10px] font-semibold text-[var(--mineos-general-bright)] hover:underline"
                      >
                        Limpiar selección
                      </button>
                    ) : null}
                  </div>

                  {selectedTimeline.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--card-border)] px-3 py-5 text-center">
                      <CalendarRange className="mx-auto mb-2 size-6 text-[var(--text-muted)] opacity-60" />
                      <p className="text-pretty text-xs text-[var(--text-muted)]">
                        Elija uno o varios ciclos del panel derecho para visualizar aquí el mes que
                        se va a cerrar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedTimeline.map((c, idx) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-elevated)]/40 px-2.5 py-2"
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--mineos-general-soft)] text-[10px] font-bold text-[var(--mineos-general-bright)]">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">
                              {cicloLabel(c)}
                            </p>
                            <p className="text-[9px] text-[var(--text-muted)]">
                              {fmtRango(c.rangeStart, c.rangeEnd)}
                            </p>
                          </div>
                          <p
                            className={cn(
                              mineosKpiValue('benefit'),
                              'shrink-0 text-[11px] font-bold tabular-nums',
                            )}
                          >
                            {fmtUsd(c.totalUsd)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                      Nombre del cierre
                    </span>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder={previewLabel || 'Nómina Mayo 2026'}
                      className="input-field w-full text-sm"
                    />
                    {selectedCiclos.length > 0 && !label.trim() ? (
                      <button
                        type="button"
                        onClick={applySuggestedLabel}
                        className="mt-1 text-[10px] font-semibold text-[var(--mineos-general-bright)] hover:underline"
                      >
                        Usar sugerencia: {sugerirEtiquetaMes(selectedCiclos)}
                      </button>
                    ) : null}
                  </label>

                  <button
                    type="button"
                    disabled={pending || selectedCiclos.length === 0}
                    onClick={handleCerrarMes}
                    className={cn(
                      MINEOS_BTN_NOMINA_PRIMARY,
                      'flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs disabled:opacity-40',
                    )}
                  >
                    {pending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Lock className="size-3.5" />
                    )}
                    Cerrar mes
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-elevated)]/20 p-3">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--text-primary)]">
                      Ciclos listos para cierre
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Solo aparecen ciclos consolidados y aún no archivados en un mes.
                    </p>
                  </div>
                  {data.ciclosDisponibles.length > 1 ? (
                    <button
                      type="button"
                      onClick={selectAll}
                      disabled={allSelected}
                      className={cn(mineosBtnSubtleClass('general'), 'text-[10px] disabled:opacity-40')}
                    >
                      Seleccionar todos
                    </button>
                  ) : null}
                </div>

                {data.ciclosDisponibles.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--card-border)] px-3 py-8 text-center">
                    <Archive className="mx-auto mb-2 size-7 text-[var(--text-muted)] opacity-60" />
                    <p className="text-pretty text-xs text-[var(--text-muted)]">
                      No hay ciclos disponibles. Consolide periodos en la sección superior para poder
                      cerrar el mes.
                    </p>
                  </div>
                ) : (
                  <div className="grid max-h-[22rem] gap-1.5 overflow-y-auto pr-1">
                    {data.ciclosDisponibles.map((c) => {
                      const selected = selectedIds.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCiclo(c.id)}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                            selected
                              ? 'border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)]/35'
                              : 'border-[var(--card-border)] bg-[var(--card-bg)]/45 hover:border-[var(--mineos-general-border)]/40',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                              selected
                                ? 'border-[var(--mineos-general)] bg-[var(--mineos-general)] text-black'
                                : 'border-[var(--card-border)] bg-[var(--surface-elevated)]',
                            )}
                          >
                            {selected ? <Check className="size-2.5 stroke-[3]" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-semibold text-[var(--text-primary)]">
                              {cicloLabel(c)}
                            </span>
                            <span className="mt-0.5 block text-[9px] text-[var(--text-muted)]">
                              {fmtRango(c.rangeStart, c.rangeEnd)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span
                              className={cn(
                                mineosKpiValue('benefit'),
                                'block text-[10px] font-bold tabular-nums',
                              )}
                            >
                              {fmtUsd(c.totalUsd)}
                            </span>
                            <span className="text-[9px] text-[var(--text-muted)]">
                              {c.semanaCount} sem.
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Archive className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
              <h4 className="text-[10px] font-bold uppercase text-[var(--text-primary)]">
                Meses cerrados
              </h4>
            </div>

            {data.meses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--card-border)] py-6 text-center">
                <p className="text-xs text-[var(--text-muted)]">
                  Aún no hay meses cerrados en {AREA_LABEL[area]}.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {data.meses.map((mes) => {
                  const isExpanded = expandedMesId === mes.id;
                  const isDeleting = deletingId === mes.id;
                  return (
                    <article
                      key={mes.id}
                      className={cn(
                        'rounded-xl border bg-[var(--surface-elevated)]/20 p-3 transition-colors',
                        isExpanded
                          ? 'border-[var(--mineos-general-border)]'
                          : 'border-[var(--card-border)] hover:border-[var(--mineos-general-border)]/50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedMesId(isExpanded ? null : mes.id)}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        >
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--card-bg)] text-[var(--text-muted)]">
                            {isExpanded ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-[var(--text-primary)]">
                              {mes.label}
                            </span>
                            <span className="mt-0.5 block text-[10px] tabular-nums text-[var(--text-muted)]">
                              {fmtRango(mes.rangeStart, mes.rangeEnd)}
                            </span>
                          </span>
                        </button>

                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              mineosKpiValue('benefit'),
                              'text-sm font-bold tabular-nums',
                            )}
                          >
                            {fmtUsd(mes.totalUsd)}
                          </p>
                          <p className="text-[9px] text-[var(--text-muted)]">
                            {mes.cicloCount} ciclo{mes.cicloCount === 1 ? '' : 's'} ·{' '}
                            {mes.semanaCount} sem.
                          </p>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="mt-3 border-t border-[var(--card-border)] pt-2">
                          <p className="mb-1.5 text-[9px] font-bold uppercase text-[var(--text-muted)]">
                            Ciclos incluidos
                          </p>
                          <ul className="space-y-1">
                            {mes.ciclos.map((c) => (
                              <li
                                key={c.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--card-border)]/70 bg-[var(--card-bg)]/40 px-2 py-1.5"
                              >
                                <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
                                  {cicloLabel(c)}
                                </span>
                                <span
                                  className={cn(
                                    mineosKpiValue('benefit'),
                                    'text-[10px] font-bold tabular-nums',
                                  )}
                                >
                                  {fmtUsd(c.totalUsd)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-[9px] text-[var(--text-muted)]">
                              Registrado{' '}
                              {format(parseISO(mes.createdAt), "dd MMM yyyy · HH:mm", {
                                locale: es,
                              })}
                            </p>
                            {canEdit ? (
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => handleDeleteMes(mes.id, mes.label)}
                                className={cn(MINEOS_TABLE_ACTION_DELETE, 'h-7 w-7')}
                                aria-label={`Eliminar ${mes.label}`}
                                title="Eliminar cierre de mes"
                              >
                                {isDeleting ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
