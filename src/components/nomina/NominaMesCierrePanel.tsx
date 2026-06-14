'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BadgeCheck,
  CalendarCheck,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Layers,
  Loader2,
  Lock,
  Sparkles,
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
  mineosIconRing,
  mineosKpiGlow,
  mineosKpiValue,
  mineosLabelAccent,
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

function SummaryKpi({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: 'general' | 'benefit' | 'neutral';
  sub?: string;
}) {
  return (
    <div
      className={cn(
        'gerencial-kpi-card relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--surface-elevated)]/50 px-3 py-2.5',
        mineosKpiGlow(tone),
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className={cn(mineosKpiValue(tone), 'mt-0.5 text-lg font-bold tabular-nums leading-tight')}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{sub}</p> : null}
    </div>
  );
}

function CicloSelectCard({
  ciclo,
  selected,
  onToggle,
}: {
  ciclo: NominaPeriodoSummary;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'group relative w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
        selected
          ? 'border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)]/35 shadow-[0_0_0_1px_var(--mineos-general-border)]'
          : 'border-[var(--card-border)] bg-[var(--card-bg)]/40 hover:border-[var(--mineos-general-border)]/40 hover:bg-[var(--surface-elevated)]/60',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
            selected
              ? 'border-[var(--mineos-general)] bg-[var(--mineos-general)] text-black'
              : 'border-[var(--card-border)] bg-[var(--surface-elevated)]/80 text-transparent group-hover:border-[var(--mineos-general-border)]',
          )}
          aria-hidden
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
            {cicloLabel(ciclo)}
          </span>
          <span className="mt-1 block text-[10px] leading-snug text-[var(--text-muted)]">
            {fmtRango(ciclo.rangeStart, ciclo.rangeEnd)}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                mineosKpiValue('benefit'),
                'rounded-md bg-[var(--mineos-benefit-soft)]/50 px-1.5 py-px text-[10px] font-bold tabular-nums',
              )}
            >
              {fmtUsd(ciclo.totalUsd)}
            </span>
            <span className="rounded-md border border-[var(--card-border)] px-1.5 py-px text-[9px] font-semibold text-[var(--text-muted)]">
              {ciclo.semanaCount} sem.
            </span>
          </span>
        </span>
      </div>
    </button>
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
    setLoading(true);
    listNominaMesesPanelAction(area).then((res) => {
      setLoading(false);
      if (res.ok) {
        setData(res.data);
        setSelectedIds(new Set());
        setLabel('');
      } else {
        toast.error(res.message ?? 'Error al cargar meses');
      }
    });
  }, [area, refreshKey]);

  const selectedCiclos = useMemo(
    () => data.ciclosDisponibles.filter((c) => selectedIds.has(c.id)),
    [data.ciclosDisponibles, selectedIds],
  );

  const previewTotal = useMemo(() => totalUsdDesdeCiclos(selectedCiclos), [selectedCiclos]);
  const previewSemanas = useMemo(() => semanaCountDesdeCiclos(selectedCiclos), [selectedCiclos]);
  const previewRango = useMemo(() => rangoDesdeCiclos(selectedCiclos), [selectedCiclos]);

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
    <section className={cn(mineosPanel('general'), 'w-full min-w-0 overflow-hidden !p-0')}>
      {/* Hero header */}
      <div className="relative border-b border-[var(--card-border)] px-3 py-3 lg:px-4 lg:py-4">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-90"
          style={{ background: 'var(--mineos-gradient-bar-general)' }}
          aria-hidden
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={mineosIconRing('general')}>
              <CalendarCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary)] lg:text-base">
                  Cierre de mes
                </h3>
                <span className="inline-flex items-center rounded-full border border-[var(--mineos-general-border)]/50 bg-[var(--mineos-general-soft)]/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--mineos-general-bright)]">
                  {AREA_LABEL[area]}
                </span>
              </div>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[var(--text-muted)]">
                Agrupe los ciclos que usted elija — una semana, dos o las que necesite. El mes queda
                archivado por área en la base de datos.
              </p>
            </div>
          </div>
          {!loading && data.meses.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mineos-benefit-border)]/40 bg-[var(--mineos-benefit-soft)]/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--mineos-benefit)]">
              <BadgeCheck className="h-3.5 w-3.5" />
              {data.meses.length} mes{data.meses.length === 1 ? '' : 'es'} cerrado
              {data.meses.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        {!loading ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SummaryKpi
              label="Meses cerrados"
              value={String(data.meses.length)}
              tone="general"
            />
            <SummaryKpi
              label="Total archivado"
              value={fmtUsd(totalMesesHistorico)}
              tone="benefit"
              sub="Suma de meses cerrados"
            />
            <SummaryKpi
              label="Ciclos disponibles"
              value={String(data.ciclosDisponibles.length)}
              tone="neutral"
              sub="Listos para agrupar"
            />
          </div>
        ) : null}
      </div>

      <div className="p-3 lg:p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--mineos-general-bright)]" />
            Cargando cierres de mes…
          </div>
        ) : (
          <div className="space-y-6">
            {canEdit ? (
              <div className="grid gap-4 xl:grid-cols-[1fr_minmax(260px,320px)] xl:items-start">
                {/* Selector de ciclos */}
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-elevated)]/20 p-3 lg:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
                      <p className={cn(mineosLabelAccent('general'), 'text-[10px] font-bold uppercase')}>
                        Ciclos a incluir
                      </p>
                    </div>
                    {data.ciclosDisponibles.length > 1 ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={selectAll}
                          disabled={allSelected}
                          className={cn(
                            mineosBtnSubtleClass('general'),
                            'text-[10px] disabled:opacity-40',
                          )}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={clearSelection}
                          disabled={selectedIds.size === 0}
                          className={cn(
                            mineosBtnSubtleClass('neutral'),
                            'text-[10px] disabled:opacity-40',
                          )}
                        >
                          Limpiar
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {data.ciclosDisponibles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--card-border)] px-4 py-8 text-center">
                      <CalendarRange className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)] opacity-40" />
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        No hay ciclos disponibles
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        Consolide periodos en «Periodos registrados» y vuelva aquí para cerrar el
                        mes.
                      </p>
                    </div>
                  ) : (
                    <div className="grid max-h-[min(320px,50vh)] gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
                      {data.ciclosDisponibles.map((c) => (
                        <CicloSelectCard
                          key={c.id}
                          ciclo={c}
                          selected={selectedIds.has(c.id)}
                          onToggle={() => toggleCiclo(c.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Panel resumen + acción */}
                <div
                  className={cn(
                    'relative overflow-hidden rounded-xl border border-[var(--mineos-general-border)]/40 p-4',
                    'bg-[var(--mineos-general-soft)]/15',
                    mineosKpiGlow('general'),
                  )}
                >
                  <div
                    className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl"
                    style={{ background: 'var(--mineos-general)' }}
                    aria-hidden
                  />
                  <div className="relative">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mineos-general-bright)]">
                        Resumen del cierre
                      </p>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                        Nombre del mes
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
                          className="mt-1.5 text-[10px] font-medium text-[var(--mineos-general-bright)] underline decoration-dotted underline-offset-2 hover:opacity-90"
                        >
                          Usar sugerencia: {sugerirEtiquetaMes(selectedCiclos)}
                        </button>
                      ) : null}
                    </label>

                    <div className="mt-4 rounded-lg border border-[var(--card-border)]/80 bg-[var(--card-bg)]/50 px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Total a registrar
                      </p>
                      <p
                        className={cn(
                          mineosKpiValue('benefit'),
                          'mt-0.5 text-2xl font-bold tabular-nums tracking-tight',
                        )}
                      >
                        {fmtUsd(previewTotal)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-elevated)]/80 px-1.5 py-0.5">
                          <Layers className="h-3 w-3" />
                          {selectedCiclos.length} ciclo{selectedCiclos.length === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-elevated)]/80 px-1.5 py-0.5">
                          <CalendarRange className="h-3 w-3" />
                          {previewSemanas} sem.
                        </span>
                      </div>
                      {previewRango ? (
                        <p className="mt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                          {fmtRango(previewRango.rangeStart, previewRango.rangeEnd)}
                        </p>
                      ) : (
                        <p className="mt-2 text-[10px] italic text-[var(--text-muted)]">
                          Seleccione ciclos para ver el rango calendario.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={pending || selectedCiclos.length === 0}
                      onClick={handleCerrarMes}
                      className={cn(
                        MINEOS_BTN_NOMINA_PRIMARY,
                        'mt-4 flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-40',
                      )}
                    >
                      {pending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Cerrando mes…
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Cerrar mes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Historial de meses */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-[var(--mineos-benefit)]" />
                <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
                  Meses cerrados
                </h4>
              </div>

              {data.meses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--surface-elevated)]/10 px-4 py-10 text-center">
                  <div className={cn(mineosIconRing('neutral'), 'mx-auto mb-3 h-12 w-12 rounded-xl')}>
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Sin cierres de mes en {AREA_LABEL[area]}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[11px] text-[var(--text-muted)]">
                    Cuando cierre su primer mes, aparecerá aquí con el detalle de cada ciclo
                    incluido.
                  </p>
                </div>
              ) : (
                <div className="relative space-y-2 pl-1">
                  <div
                    className="absolute bottom-2 left-[11px] top-2 w-px bg-gradient-to-b from-[var(--mineos-benefit-border)] via-[var(--card-border)] to-transparent"
                    aria-hidden
                  />
                  {data.meses.map((mes) => {
                    const isExpanded = expandedMesId === mes.id;
                    const isDeleting = deletingId === mes.id;
                    return (
                      <article
                        key={mes.id}
                        className={cn(
                          'relative ml-5 overflow-hidden rounded-xl border transition-colors',
                          isExpanded
                            ? 'border-[var(--mineos-benefit-border)]/50 bg-[var(--mineos-benefit-soft)]/10'
                            : 'border-[var(--card-border)] bg-[var(--surface-elevated)]/30 hover:border-[var(--mineos-benefit-border)]/30',
                        )}
                      >
                        <div
                          className="absolute -left-5 top-4 h-2.5 w-2.5 rounded-full border-2 border-[var(--mineos-benefit)] bg-[var(--card-bg)]"
                          aria-hidden
                        />
                        <div className="flex items-stretch gap-1 p-2.5 sm:p-3">
                          <button
                            type="button"
                            onClick={() => setExpandedMesId(isExpanded ? null : mes.id)}
                            className="flex min-w-0 flex-1 items-start gap-2 text-left"
                          >
                            <span className="mt-0.5 shrink-0 text-[var(--text-muted)]">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                  {mes.label}
                                </span>
                                <span className="inline-flex rounded-full bg-[var(--mineos-benefit-soft)] px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-[var(--mineos-benefit)]">
                                  Cerrado
                                </span>
                              </span>
                              <span className="mt-0.5 block text-[10px] tabular-nums text-[var(--text-muted)]">
                                {fmtRango(mes.rangeStart, mes.rangeEnd)}
                              </span>
                              <span className="mt-1.5 flex flex-wrap gap-1.5">
                                <span className="rounded border border-[var(--card-border)] px-1.5 py-px text-[9px] font-semibold text-[var(--text-muted)]">
                                  {mes.cicloCount} ciclo{mes.cicloCount === 1 ? '' : 's'}
                                </span>
                                <span className="rounded border border-[var(--card-border)] px-1.5 py-px text-[9px] font-semibold text-[var(--text-muted)]">
                                  {mes.semanaCount} sem.
                                </span>
                              </span>
                            </span>
                          </button>
                          <div className="flex shrink-0 flex-col items-end justify-between gap-2 pl-2">
                            <span
                              className={cn(
                                mineosKpiValue('benefit'),
                                'text-base font-bold tabular-nums sm:text-lg',
                              )}
                            >
                              {fmtUsd(mes.totalUsd)}
                            </span>
                            {canEdit ? (
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => handleDeleteMes(mes.id, mes.label)}
                                className={cn(MINEOS_TABLE_ACTION_DELETE, 'h-8 w-8')}
                                title="Eliminar cierre de mes"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="border-t border-[var(--card-border)]/60 px-3 pb-3 pt-2 sm:px-4">
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                              Ciclos incluidos
                            </p>
                            <ul className="space-y-1.5">
                              {mes.ciclos.map((c) => (
                                <li
                                  key={c.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--card-border)]/70 bg-[var(--card-bg)]/40 px-2.5 py-2"
                                >
                                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                                    {cicloLabel(c)}
                                  </span>
                                  <span className="flex items-center gap-2 text-[10px] tabular-nums">
                                    <span className="text-[var(--text-muted)]">
                                      {format(parseISO(c.rangeStart), 'dd/MM/yy', { locale: es })} —{' '}
                                      {format(parseISO(c.rangeEnd), 'dd/MM/yy', { locale: es })}
                                    </span>
                                    <span className={cn(mineosKpiValue('benefit'), 'font-bold')}>
                                      {fmtUsd(c.totalUsd)}
                                    </span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2.5 text-[9px] text-[var(--text-muted)]">
                              Registrado{' '}
                              {format(parseISO(mes.createdAt), "dd MMM yyyy · HH:mm", { locale: es })}
                            </p>
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
      </div>
    </section>
  );
}
