'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { Calendar, Printer, RefreshCw, X, Archive } from 'lucide-react';
import NominaPreviewReport from '@/components/nomina/NominaPreviewReport';
import NominaPreviewOptionsMenu from '@/components/nomina/NominaPreviewOptionsMenu';
import { AppSelect } from '@/components/ui/AppSelect';
import { useNominaDivisionesConfig } from '@/hooks/use-nomina-divisiones-config';
import { getValesPendientesBulkAction } from '@/lib/actions/nomina-v3';
import {
  buildNominaPreviewReport,
  isNominaPreviewEmpty,
  listWeekStartsInRange,
  normalizePreviewRange,
  type NominaPreviewImportSection,
  type NominaRegistroCerrado,
} from '@/lib/nomina-preview';
import {
  formatTemporalContextHint,
  resolveNominaTemporalContext,
  type NominaSemanaRef,
} from '@/lib/nomina/temporal-context';
import { getWeekEnd } from '@/lib/nomina/week-utils';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import type { Personal } from '@/lib/types';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';

const ZOOM_MIN = 60;
const ZOOM_MAX = 130;
const ZOOM_STEP = 5;

export type NominaPreviewRange = { start: string; end: string };

type Props = {
  personal: Personal[];
  registrosCerrados: NominaRegistroCerrado[];
  semanasCerradas?: NominaSemanaRef[];
  totalRegistrosHistoricos?: number;
  initialRange?: NominaPreviewRange | null;
  archivedPeriods?: NominaPeriodoSummary[];
  variant?: 'modal' | 'page' | 'embed';
  embedTitle?: string;
  onClose?: () => void;
  periodoId?: string;
  /** Callback para recargar datos del servidor filtrando por el periodo seleccionado */
  onPeriodSelect?: (period: NominaPeriodoSummary) => void;
  /** Callback para volver a la vista sin filtro (semana activa) */
  onClearPeriod?: () => void;
};

function isoDate(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function defaultRangeFromContext(semanas: NominaSemanaRef[]) {
  const ctx = resolveNominaTemporalContext(semanas);
  const start = ctx.workingWeekStart;
  return { start, end: getWeekEnd(start) };
}

function DateRangeField({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = value ? format(parseISO(value), 'dd/MM/yyyy') : '—';

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* fallback */
      }
    }
    el.focus();
    el.click();
  }

  return (
    <div className={compact ? 'flex items-center' : 'flex shrink-0 items-center gap-1.5'}>
      {!compact ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      ) : null}
      <button
        type="button"
        onClick={openPicker}
        className={
          compact
            ? 'relative flex h-9 cursor-pointer items-center px-2.5 text-left transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500'
            : 'relative flex h-9 min-w-[7rem] cursor-pointer items-center rounded-lg border border-white/10 bg-zinc-900 py-0 pl-2.5 pr-8 text-left transition-colors hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500'
        }
      >
        <span className="text-xs font-medium tabular-nums text-zinc-200">{display}</span>
        {!compact ? (
          <Calendar className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-zinc-400" aria-hidden />
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}

export default function NominaVistaPreviaContent({
  personal,
  registrosCerrados,
  semanasCerradas = [],
  totalRegistrosHistoricos = 0,
  initialRange = null,
  archivedPeriods = [],
  variant = 'modal',
  embedTitle,
  onClose,
  periodoId,
  onPeriodSelect,
  onClearPeriod,
}: Props) {
  const temporalCtx = useMemo(
    () => resolveNominaTemporalContext(semanasCerradas),
    [semanasCerradas],
  );
  const defaultRange = useMemo(() => defaultRangeFromContext(semanasCerradas), [semanasCerradas]);
  const [rangeStart, setRangeStart] = useState(initialRange?.start ?? defaultRange.start);
  const [rangeEnd, setRangeEnd] = useState(initialRange?.end ?? defaultRange.end);
  const [valesMap, setValesMap] = useState<Record<string, number>>({});
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());
  const [contentZoom, setContentZoom] = useState(100);
  const [includeProjection, setIncludeProjection] = useState(false);
  const [isPending, startTransition] = useTransition();

  const divisionesConfig = useNominaDivisionesConfig();

  // Ref para evitar llamar onPeriodSelect/onClearPeriod cuando el cambio
  // ya viene del propio padre (no del usuario cambiando las fechas).
  const lastAutoSelectedPeriodoRef = useRef<string | null>(null);

  const roster = useMemo(() => {
    const base = personal.filter(
      (p) =>
        ['mina', 'planta', 'administracion'].includes(p.area) &&
        ((p.estatus === 'ACTIVO' || !p.estatus) && isPersonalVisibleInNomina(p, p.area)),
    );
    const ids = new Set(base.map((p) => p.id));
    for (const r of registrosCerrados) {
      if (ids.has(r.personal_id)) continue;
      const p = personal.find((x) => x.id === r.personal_id);
      if (p) {
        base.push(p);
        ids.add(p.id);
      }
    }
    return base;
  }, [personal, registrosCerrados]);

  useEffect(() => {
    if (initialRange?.start && initialRange?.end) {
      setRangeStart(initialRange.start);
      setRangeEnd(initialRange.end);
    }
  }, [initialRange?.start, initialRange?.end]);

  const registrosEnRango = useMemo(() => {
    const weeks = new Set(listWeekStartsInRange(rangeStart, rangeEnd));
    return registrosCerrados.filter((r) => weeks.has(r.semana_inicio));
  }, [registrosCerrados, rangeStart, rangeEnd]);

  // Para UI: usa periodoId como shortcut (etiquetas, estilos, orden de secciones)
  const matchingArchivedPeriod = useMemo(() => {
    if (periodoId) {
      const exact = archivedPeriods.find((p) => p.id === periodoId);
      if (exact) return exact;
    }
    const { start, end } = normalizePreviewRange(rangeStart, rangeEnd);
    const exact = archivedPeriods.find((p) => p.rangeStart === start && p.rangeEnd === end);
    if (exact) return exact;
    return archivedPeriods.find(
      (p) => p.origen === 'import_historico' && p.rangeStart <= start && p.rangeEnd >= end,
    );
  }, [archivedPeriods, rangeStart, rangeEnd, periodoId]);

  // Para auto-detección: SOLO mira las fechas, nunca el periodoId activo.
  // Esto permite detectar el cambio A → B cuando el usuario cambia fechas manualmente
  // aunque periodoId siga siendo "A" (el shortcut de matchingArchivedPeriod bloquearía eso).
  const autoDetectedPeriod = useMemo(() => {
    const { start, end } = normalizePreviewRange(rangeStart, rangeEnd);
    const exact = archivedPeriods.find((p) => p.rangeStart === start && p.rangeEnd === end);
    if (exact) return exact;
    return archivedPeriods.find(
      (p) => p.origen === 'import_historico' && p.rangeStart <= start && p.rangeEnd >= end,
    );
  }, [archivedPeriods, rangeStart, rangeEnd]); // ← sin periodoId

  /**
   * Auto-detección inteligente: cuando el usuario cambia las fechas manualmente
   * y el rango coincide con un periodo archivado, recargamos los datos del servidor.
   * Usa autoDetectedPeriod (solo fechas) para no bloquearse con el periodoId activo.
   */
  useEffect(() => {
    const matchId = autoDetectedPeriod?.id ?? null;
    // Si ya notificamos este mismo periodo/estado, no volver a hacerlo
    if (matchId === lastAutoSelectedPeriodoRef.current) return;
    lastAutoSelectedPeriodoRef.current = matchId;

    if (autoDetectedPeriod && autoDetectedPeriod.id !== periodoId) {
      // Rango coincide con un periodo diferente al activo → recargar
      onPeriodSelect?.(autoDetectedPeriod);
    }
    // Si autoDetectedPeriod es null, mantenemos los datos actuales filtrados por fechas.
    // El usuario puede ir a "Semana en curso" explícitamente desde el dropdown.
  }, [autoDetectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps


  const importSectionOrder = useMemo((): NominaPreviewImportSection[] | undefined => {
    const totals = matchingArchivedPeriod?.metadata?.sectionTotals as
      | Array<{ id: string; title: string }>
      | undefined;
    if (!totals?.length) return undefined;
    return totals.map((s) => ({ id: s.id, title: s.title }));
  }, [matchingArchivedPeriod]);

  const isConsolidatedImport = matchingArchivedPeriod?.origen === 'import_historico';

  const personalSnapshots = useMemo(() => {
    const map: Record<string, NonNullable<NominaRegistroCerrado['personal_snapshot']>> = {};
    for (const r of registrosEnRango) {
      if (r.personal_snapshot && !map[r.personal_id]) {
        map[r.personal_id] = r.personal_snapshot;
      }
    }
    return map;
  }, [registrosEnRango]);

  const rosterForPreview = useMemo(() => {
    if (Object.keys(personalSnapshots).length === 0) return roster;
    return roster.map((p) => {
      const snap = personalSnapshots[p.id];
      if (!snap) return p;
      return {
        ...p,
        cargo: snap.cargo || p.cargo,
        area: (snap.area as Personal['area']) || p.area,
        area_detalle: snap.area_detalle || p.area_detalle,
      };
    });
  }, [roster, personalSnapshots]);

  const report = useMemo(
    () =>
      buildNominaPreviewReport({
        personal: rosterForPreview,
        rangeStart,
        rangeEnd,
        registrosCerrados: registrosEnRango,
        valesPorPersonal: valesMap,
        allowProjection: includeProjection && !isConsolidatedImport,
        importSectionOrder,
        personalSnapshots,
      }),
    [
      rosterForPreview,
      rangeStart,
      rangeEnd,
      registrosEnRango,
      valesMap,
      lastRefresh,
      includeProjection,
      isConsolidatedImport,
      importSectionOrder,
      personalSnapshots,
    ],
  );

  const previewEmpty = isNominaPreviewEmpty({ report, includeProjection });


  const isEmbed = variant === 'embed';
  const showFullToolbar = !isEmbed;

  function goToWorkingWeek() {
    setRangeStart(temporalCtx.workingWeekStart);
    setRangeEnd(temporalCtx.workingWeekEnd);
  }

  function handleRangeStartChange(v: string) {
    if (!v) return; // campo vacío mientras el usuario escribe
    const parsed = parseISO(v);
    if (isNaN(parsed.getTime())) return; // fecha parcial o inválida
    setRangeStart(v);
    const end = isoDate(addDays(parsed, 6));
    if (rangeEnd < v || rangeEnd > end) {
      setRangeEnd(end);
    }
  }

  function refreshVales() {
    startTransition(async () => {
      const ids = roster.map((p) => p.id);
      if (!ids.length) return;
      const res = await getValesPendientesBulkAction(ids);
      const map: Record<string, number> = {};
      if (res.ok && res.data) {
        for (const v of res.data) {
          map[v.personal_id] = (map[v.personal_id] || 0) + Number(v.monto);
        }
      }
      setValesMap(map);
      setLastRefresh(new Date());
    });
  }

  useEffect(() => {
    if (!roster.length) return;
    refreshVales();
  }, [roster.length]);

  function adjustZoom(delta: number) {
    setContentZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)));
  }

  function handlePrintPreview() {
    document.body.classList.add('nomina-preview-print-mode');
    const cleanup = () => {
      document.body.classList.remove('nomina-preview-print-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  const contextHint = formatTemporalContextHint(temporalCtx);
  const viewingWorkingWeek =
    rangeStart === temporalCtx.workingWeekStart && rangeEnd === temporalCtx.workingWeekEnd;

  function applyPeriodRange(period: NominaPeriodoSummary) {
    setRangeStart(period.rangeStart);
    setRangeEnd(period.rangeEnd);
    // Notificar al modal para recargar datos filtrados por periodoId
    onPeriodSelect?.(period);
  }

  function clearPeriodFilter() {
    // Volver a semana activa
    setRangeStart(defaultRange.start);
    setRangeEnd(defaultRange.end);
    onClearPeriod?.();
  }

  return (
    <div className="nomina-vista-previa-content flex min-h-0 flex-col">
      <header className="nomina-vista-previa-content__toolbar sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              {!isEmbed ? (
                <h2 className="text-base font-semibold text-slate-900">Vista Previa</h2>
              ) : embedTitle ? (
                <p className="text-sm font-semibold text-slate-800">{embedTitle}</p>
              ) : null}
              <p className="text-[11px] leading-snug text-slate-500">{contextHint}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <DateRangeField label="Desde" value={rangeStart} onChange={handleRangeStartChange} compact />
                <span className="hidden px-1 text-[10px] text-slate-300 sm:inline" aria-hidden>
                  —
                </span>
                <DateRangeField label="Hasta" value={rangeEnd} onChange={setRangeEnd} compact />
              </div>

              {archivedPeriods.length > 0 ? (
                <div className="flex min-w-0 max-w-[240px] flex-1 items-center gap-1.5 sm:flex-none">
                  <Archive className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  <AppSelect
                    theme="light"
                    value={periodoId ?? ''}
                    onChange={(val) => {
                      if (!val) {
                        clearPeriodFilter();
                        return;
                      }
                      const p = archivedPeriods.find((x) => x.id === val);
                      if (p) applyPeriodRange(p);
                    }}
                    options={[
                      {
                        value: '',
                        label: periodoId
                          ? 'Semana en curso'
                          : rangeStart && rangeEnd
                            ? `${format(parseISO(rangeStart), 'dd/MM')} — ${format(parseISO(rangeEnd), 'dd/MM/yyyy')}`
                            : 'Semana en curso',
                      },
                      ...archivedPeriods.map((p) => ({
                        value: p.id,
                        label: `${p.label} (${p.totalUsd.toLocaleString('es', { minimumFractionDigits: 0 })})`,
                      })),
                    ]}
                    className="min-w-[170px] flex-1 text-xs"
                  />
                </div>
              ) : null}

              {includeProjection ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  Con estimados
                </span>
              ) : null}
              {isConsolidatedImport ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-900">
                  Planilla Excel (Mina + Molinos)
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {showFullToolbar ? (
              <>
                <NominaPreviewOptionsMenu
                  includeProjection={includeProjection}
                  onIncludeProjectionChange={setIncludeProjection}
                  showWorkingWeekAction={!viewingWorkingWeek}
                  onGoToWorkingWeek={goToWorkingWeek}
                  contentZoom={contentZoom}
                  onZoomChange={setContentZoom}
                  onZoomStep={adjustZoom}
                  zoomMin={ZOOM_MIN}
                  zoomMax={ZOOM_MAX}
                  zoomStep={ZOOM_STEP}
                  divisiones={{
                    divisiones: divisionesConfig.divisiones,
                    sumPct: divisionesConfig.sumPct,
                    pctOk: divisionesConfig.pctOk,
                    canAdd: divisionesConfig.canAdd,
                    canRemove: divisionesConfig.canRemove,
                    onAdd: divisionesConfig.addParte,
                    onRemove: () => divisionesConfig.removeParte(),
                    onSetCount: divisionesConfig.setColumnCount,
                    onUpdatePorcentaje: divisionesConfig.updatePorcentaje,
                    onSave: divisionesConfig.saveAsDefault,
                    saving: divisionesConfig.saving,
                  }}
                />
                <button
                  type="button"
                  onClick={refreshVales}
                  disabled={isPending || previewEmpty}
                  title="Recalcular"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handlePrintPreview}
                  disabled={previewEmpty}
                  title="Imprimir"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-500 px-3 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
              </>
            ) : null}

            {variant === 'modal' && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>


      </header>

      <div className="nomina-vista-previa-content__body min-h-0 flex-1 overflow-auto bg-[#eef2f6]">
        {previewEmpty ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Sin planilla para mostrar</p>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">
              No hay nóminas cerradas ni importadas en este rango. Use{' '}
              <strong>Importar</strong> para cargar planillas (detecta histórico o semana actual) o cierre la
              semana en Mina/Molinos. Para estimados por rotación, use{' '}
              <strong>Ajustes</strong>.
            </p>
            {archivedPeriods.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {archivedPeriods.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPeriodRange(p)}
                    className="rounded-full border border-amber-300/70 bg-white px-3 py-1 text-[10px] font-semibold text-amber-900 hover:bg-amber-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className="nomina-vista-previa-content__zoom-root p-3 sm:p-4"
            style={{ zoom: isEmbed ? 1 : contentZoom / 100 }}
          >
            <NominaPreviewReport report={report} divisiones={divisionesConfig.divisiones} />
          </div>
        )}
      </div>
    </div>
  );
}
