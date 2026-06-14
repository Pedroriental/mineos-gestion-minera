'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Archive,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  PlayCircle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppMonthPicker } from '@/components/ui/AppMonthPicker';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import {
  eliminarPeriodoConsolidadoAction,
  listNominaPeriodosAction,
} from '@/lib/actions/nomina-actions';
import {
  computeManualPeriodProgress,
  dedupeNominaPeriodoSummaries,
  firstOpenWeekInPeriod,
  formatManualWeekLabel,
  manualPeriodFromPeriodoSummary,
  stripPeriodoLabelPrefix,
  type ManualNominaPeriod,
} from '@/lib/nomina/manual-period';
import { periodoEsCierreMes } from '@/lib/nomina/cierre-mes';
import { estatusRotacionShort } from '@/lib/rotacion-plantillas/types';
import type { NominaSemana } from '@/lib/types';
import { mineosKpiValue, mineosPanel } from '@/lib/mineos-visual';
import { cn } from '@/lib/utils';

type Props = {
  area: string;
  semanas: NominaSemana[];
  activePeriod: ManualNominaPeriod | null;
  refreshKey?: number;
  userId?: string;
  onViewPeriod: (period: ManualNominaPeriod) => void;
  onWorkWeek: (period: ManualNominaPeriod, weekStart: string) => void;
  onPeriodDeleted?: () => void;
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('es', { minimumFractionDigits: 2 })}`;
}

const PERIODOS_MES_STORAGE_PREFIX = 'mineos-nomina-periodos-mes:';

function currentMonthKey(): string {
  return format(new Date(), 'yyyy-MM');
}

function periodosMesStorageKey(area: string): string {
  return `${PERIODOS_MES_STORAGE_PREFIX}${area}`;
}

function readStoredMonthFilter(area: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = localStorage.getItem(periodosMesStorageKey(area));
    if (stored && /^\d{4}-\d{2}$/.test(stored)) return stored;
  } catch {
    // localStorage puede fallar en modo privado
  }
  return currentMonthKey();
}

export function NominaPeriodosRegistradosPanel({
  area,
  semanas,
  activePeriod,
  refreshKey = 0,
  userId,
  onViewPeriod,
  onWorkWeek,
  onPeriodDeleted,
}: Props) {
  const confirmDialog = useConfirm();
  const [periodos, setPeriodos] = useState<ReturnType<typeof dedupeNominaPeriodoSummaries>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listNominaPeriodosAction().then((res) => {
      setLoading(false);
      if (res.ok) {
        const areaSemanaIds = new Set(semanas.filter((s) => s.area === area).map((s) => s.id));
        const filtered = res.periodos.filter((p) => {
          if (periodoEsCierreMes(p)) return false;
          const metaArea = p.metadata?.area;
          if (typeof metaArea === 'string' && metaArea !== area) return false;
          if (p.semanaCount === 0) return true;
          const ids = (p.metadata?.semana_ids as string[] | undefined) ?? [];
          if (ids.length) return ids.some((id) => areaSemanaIds.has(id));
          return true;
        });
        setPeriodos(dedupeNominaPeriodoSummaries(filtered));
      } else setError(res.message ?? 'Error al cargar');
    });
  }, [area, semanas, refreshKey]);

  const enriched = useMemo(
    () =>
      periodos.map((periodo) => {
        const manual = manualPeriodFromPeriodoSummary(periodo);
        const progress = computeManualPeriodProgress(manual, semanas, area);
        const plantillaNombre =
          typeof periodo.metadata?.plantilla_nombre === 'string'
            ? periodo.metadata.plantilla_nombre
            : manual.plantillaNombre || '—';
        const firstOpen = firstOpenWeekInPeriod(manual, semanas, area);
        const displayLabel = stripPeriodoLabelPrefix(periodo.label);
        const monthKey = format(parseISO(periodo.rangeStart), 'yyyy-MM');
        return { periodo, manual, progress, plantillaNombre, firstOpen, displayLabel, monthKey };
      }),
    [periodos, semanas, area],
  );

  const monthOptions = useMemo(() => {
    const keys = [...new Set(enriched.map((row) => row.monthKey))];
    return keys.sort((a, b) => b.localeCompare(a));
  }, [enriched]);

  const [monthFilter, setMonthFilter] = useState('');
  const [monthReady, setMonthReady] = useState(false);

  useEffect(() => {
    setMonthFilter(readStoredMonthFilter(area));
    setMonthReady(true);
  }, [area]);

  useEffect(() => {
    if (!monthReady || !monthFilter) return;
    try {
      localStorage.setItem(periodosMesStorageKey(area), monthFilter);
    } catch {
      // ignore
    }
  }, [area, monthFilter, monthReady]);

  const filteredEnriched = useMemo(() => {
    if (!monthFilter) return [];
    return enriched.filter((row) => row.monthKey === monthFilter);
  }, [enriched, monthFilter]);

  const monthFilterLabel = monthFilter
    ? format(parseISO(`${monthFilter}-01`), 'MMMM yyyy', { locale: es })
    : null;

  async function handleDelete(periodoId: string, displayLabel: string) {
    if (
      !(await confirmDialog({
        title: 'Eliminar periodo',
        message: `¿Eliminar «${displayLabel}» del archivo?\n\nLas semanas cerradas y sus registros de nómina no se borran; solo se quita este registro consolidado.`,
        variant: 'danger',
      }))
    ) {
      return;
    }
    setDeletingId(periodoId);
    const res = await eliminarPeriodoConsolidadoAction({ periodoId, userId });
    setDeletingId(null);
    if (res.ok) {
      toast.success(res.message);
      setPeriodos((prev) => prev.filter((p) => p.id !== periodoId));
      if (expandedId === periodoId) setExpandedId(null);
      onPeriodDeleted?.();
    } else {
      toast.error(res.message);
    }
  }

  return (
    <section className={cn(mineosPanel('neutral'), 'w-full min-w-0')}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--card-border)] pb-3">
        <div className="flex min-w-0 items-start gap-2">
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mineos-general-bright)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Periodos registrados</h3>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              Ciclos consolidados. Expanda una fila para ver totales semanales y retomar semanas.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Mes
          </span>
          <AppMonthPicker
            id="periodos-registrados-mes"
            value={monthFilter}
            onChange={setMonthFilter}
            placeholder="Seleccionar mes…"
            className="w-[10rem] [&>button]:rounded-lg [&>button]:py-1.5 [&>button]:text-[11px]"
          />
        </div>
      </header>

      {loading || !monthReady ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando periodos…
        </div>
      ) : error ? (
        <p className="text-sm text-[var(--mineos-expense)]">{error}</p>
      ) : !monthFilter ? (
        <div className="rounded-xl border border-dashed border-[var(--card-border)] py-8 text-center">
          <Calendar className="mx-auto mb-2 h-7 w-7 text-[var(--text-muted)] opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">
            Seleccione un mes para ver los periodos registrados.
          </p>
        </div>
      ) : enriched.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--card-border)] py-8 text-center">
          <Calendar className="mx-auto mb-2 h-7 w-7 text-[var(--text-muted)] opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">Aún no hay periodos archivados.</p>
        </div>
      ) : filteredEnriched.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--card-border)] py-8 text-center">
          <Calendar className="mx-auto mb-2 h-7 w-7 text-[var(--text-muted)] opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">
            No hay periodos en{' '}
            <span className="font-semibold capitalize text-[var(--text-primary)]">
              {monthFilterLabel}
            </span>
            .
          </p>
          {monthOptions.length > 0 ? (
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Meses con registros:{' '}
              {monthOptions
                .slice(0, 4)
                .map((ym) => format(parseISO(`${ym}-01`), 'MMM yyyy', { locale: es }))
                .join(' · ')}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-auto rounded-xl border border-[var(--card-border)]">
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <thead className="sticky top-0 z-[1] bg-[var(--surface-elevated)] shadow-[0_1px_0_var(--card-border)]">
              <tr className="border-b border-[var(--card-border)] bg-[var(--surface-elevated)]/50 text-left">
                <th className="w-7 px-1 py-1.5" aria-label="Expandir" />
                <th className="min-w-[200px] px-2 py-1.5 font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  Ciclo
                </th>
                <th className="w-14 px-2 py-1.5 font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  Sem.
                </th>
                <th className="w-24 px-2 py-1.5 text-right font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  Total
                </th>
                <th className="w-20 px-2 py-1.5 font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  Estado
                </th>
                <th className="w-20 px-2 py-1.5 text-center font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  Acc.
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEnriched.map(({ periodo, manual, progress, plantillaNombre, firstOpen, displayLabel }) => {
                const isExpanded = expandedId === periodo.id;
                const isActive =
                  activePeriod?.rangeStart === periodo.rangeStart &&
                  activePeriod?.rangeEnd === periodo.rangeEnd;
                const complete = progress.allClosed;
                const totalDisplay = progress.totalUsd;
                const isDeleting = deletingId === periodo.id;

                return (
                  <Fragment key={periodo.id}>
                    <tr
                      className={cn(
                        'border-b border-[var(--card-border)] transition-colors',
                        isActive && 'bg-[var(--mineos-general-soft)]/40',
                        isExpanded && 'bg-[var(--surface-elevated)]/30',
                      )}
                    >
                      <td className="px-1 py-1.5 align-middle">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : periodo.id)}
                          className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--card-border)] hover:text-[var(--text-primary)]"
                          title={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <p className="truncate font-semibold text-[var(--text-primary)]" title={displayLabel}>
                          {displayLabel}
                        </p>
                        <p className="truncate text-[10px] tabular-nums text-[var(--text-muted)]">
                          {format(parseISO(periodo.rangeStart), 'dd MMM yyyy', { locale: es })} —{' '}
                          {format(parseISO(periodo.rangeEnd), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </td>
                      <td className="px-2 py-1.5 align-middle tabular-nums">
                        <span className={cn(mineosKpiValue('general'), 'text-[11px] font-bold')}>
                          {progress.closedCount}/{progress.totalWeeks}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle text-right">
                        <span
                          className={cn(
                            mineosKpiValue('benefit'),
                            'text-[11px] font-bold tabular-nums',
                          )}
                        >
                          {fmtUsd(totalDisplay)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-1.5 py-px text-[9px] font-bold uppercase',
                            complete
                              ? 'bg-[var(--mineos-benefit-soft)] text-[var(--mineos-benefit)]'
                              : 'bg-amber-500/10 text-amber-400',
                          )}
                        >
                          {complete ? 'OK' : 'Pend.'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex items-center justify-center gap-1">
                          {!complete && firstOpen && (
                            <button
                              type="button"
                              onClick={() => onWorkWeek(manual, firstOpen)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[var(--mineos-general-bright)] transition-colors hover:border-[var(--mineos-general-border)]/40 hover:bg-[var(--mineos-general-soft)]/50"
                              title="Ir a semana pendiente"
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onViewPeriod(manual)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--card-border)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
                            title="Ver / cargar periodo"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(periodo.id, displayLabel)}
                            disabled={isDeleting}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                            title="Eliminar registro"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-[var(--card-border)] bg-[var(--surface-elevated)]/15">
                        <td colSpan={6} className="px-3 py-2">
                          <div className="space-y-2">
                            {plantillaNombre !== '—' && (
                              <p className="text-[10px] text-[var(--text-muted)]">
                                <span className="font-bold uppercase">Plantilla:</span>{' '}
                                {plantillaNombre}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {progress.weeks.map((w, idx) => {
                                const closed = progress.closedWeeks.includes(w);
                                const amount = progress.weekTotalsUsd[w];
                                const estatus = progress.weekEstatus[idx];
                                const tipoLabel = estatus ? estatusRotacionShort(estatus) : null;
                                return (
                                  <span
                                    key={w}
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] tabular-nums',
                                      closed
                                        ? estatus === 'bono_transporte_paga'
                                          ? 'border-sky-500/40 text-sky-400'
                                          : 'border-[var(--mineos-benefit-border)]/50 text-[var(--mineos-benefit)]'
                                        : 'border-[var(--card-border)] text-[var(--text-muted)]',
                                    )}
                                    title={
                                      tipoLabel
                                        ? `${formatManualWeekLabel(w)} · ${tipoLabel}`
                                        : formatManualWeekLabel(w)
                                    }
                                  >
                                    <span className="font-bold opacity-70">
                                      S{idx + 1}
                                      {tipoLabel ? ` ${tipoLabel}` : ''}
                                    </span>
                                    {closed ? fmtUsd(amount ?? 0) : 'Pend.'}
                                  </span>
                                );
                              })}
                            </div>
                            <table className="w-full border-collapse text-[10px]">
                              <thead>
                                <tr className="border-b border-[var(--card-border)]/60 text-left text-[9px] uppercase text-[var(--text-muted)]">
                                  <th className="px-1.5 py-1">#</th>
                                  <th className="px-1.5 py-1">Intervalo</th>
                                  <th className="px-1.5 py-1 text-right">USD</th>
                                  <th className="px-1.5 py-1">Est.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {progress.weeks.map((w, idx) => {
                                  const closed = progress.closedWeeks.includes(w);
                                  const amount = progress.weekTotalsUsd[w] ?? 0;
                                  const estatus = progress.weekEstatus[idx];
                                  const tipoLabel = estatus ? estatusRotacionShort(estatus) : null;
                                  return (
                                    <tr
                                      key={w}
                                      className="border-b border-[var(--card-border)]/40 last:border-0"
                                    >
                                      <td className="px-1.5 py-1 tabular-nums text-[var(--text-muted)]">
                                        {idx + 1}
                                      </td>
                                      <td className="px-1.5 py-1">{formatManualWeekLabel(w)}</td>
                                      <td className="px-1.5 py-1 text-right tabular-nums">
                                        {closed ? fmtUsd(amount) : '—'}
                                      </td>
                                      <td className="px-1.5 py-1">
                                        {tipoLabel ? (
                                          <span
                                            className={cn(
                                              'mr-1 text-[9px] font-bold uppercase',
                                              estatus === 'bono_transporte_paga'
                                                ? 'text-sky-400'
                                                : 'text-[var(--text-muted)]',
                                            )}
                                          >
                                            {tipoLabel}
                                          </span>
                                        ) : null}
                                        <span
                                          className={cn(
                                            'text-[9px] font-bold uppercase',
                                            closed
                                              ? 'text-[var(--mineos-benefit)]'
                                              : 'text-amber-400',
                                          )}
                                        >
                                          {closed ? 'OK' : 'Pend.'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <p className="text-[9px] text-[var(--text-muted)]">
                              Consolidado{' '}
                              {format(parseISO(periodo.createdAt), "dd MMM yyyy · HH:mm", {
                                locale: es,
                              })}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
