'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addDays, format, parseISO, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Minus, Plus, Printer, RefreshCw, X } from 'lucide-react';
import NominaPreviewReport from '@/components/nomina/NominaPreviewReport';
import NominaDivisionesToolbar from '@/components/nomina/NominaDivisionesToolbar';
import { useNominaPreviewDivisiones } from '@/hooks/use-nomina-preview-divisiones';
import { getValesPendientesBulkAction } from '@/lib/actions/nomina-v3';
import {
  buildNominaPreviewReport,
  listWeekStartsInRange,
  type NominaRegistroCerrado,
} from '@/lib/nomina-preview';
import { getWeekStart } from '@/lib/rotacion-personal';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import type { Personal } from '@/lib/types';

const ZOOM_MIN = 60;
const ZOOM_MAX = 130;
const ZOOM_STEP = 5;

type Props = {
  personal: Personal[];
  registrosCerrados: NominaRegistroCerrado[];
  variant?: 'modal' | 'page';
  onClose?: () => void;
};

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function weekEndFromStart(weekStart: string) {
  return isoDate(addDays(parseISO(weekStart), 6));
}

function defaultRange() {
  const end = getWeekStart();
  const endDate = parseISO(end);
  const startDate = subWeeks(endDate, 2);
  return { start: isoDate(startDate), end };
}

function DateRangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
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
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/55">{label}</span>
      <button
        type="button"
        onClick={openPicker}
        className="relative flex h-8 min-w-[6.75rem] cursor-pointer items-center rounded-md border border-amber-200/70 bg-white/50 py-0 pl-2.5 pr-8 text-left transition-colors hover:border-amber-400/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500"
      >
        <span className="text-xs font-medium tabular-nums text-slate-900">{display}</span>
        <Calendar className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-500" aria-hidden />
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
  variant = 'modal',
  onClose,
}: Props) {
  const initial = defaultRange();
  const [rangeStart, setRangeStart] = useState(initial.start);
  const [rangeEnd, setRangeEnd] = useState(initial.end);
  const [valesMap, setValesMap] = useState<Record<string, number>>({});
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());
  const [contentZoom, setContentZoom] = useState(100);
  const [isPending, startTransition] = useTransition();

  const roster = useMemo(
    () =>
      personal.filter(
        (p) =>
          ['mina', 'planta', 'administracion'].includes(p.area) &&
          (p.estatus === 'ACTIVO' || !p.estatus) &&
          isPersonalVisibleInNomina(p, p.area),
      ),
    [personal],
  );

  const registrosEnRango = useMemo(() => {
    const weeks = new Set(listWeekStartsInRange(rangeStart, rangeEnd));
    return registrosCerrados.filter((r) => weeks.has(r.semana_inicio));
  }, [registrosCerrados, rangeStart, rangeEnd]);

  const report = useMemo(
    () =>
      buildNominaPreviewReport({
        personal: roster,
        rangeStart,
        rangeEnd,
        registrosCerrados: registrosEnRango,
        valesPorPersonal: valesMap,
      }),
    [roster, rangeStart, rangeEnd, registrosEnRango, valesMap, lastRefresh],
  );

  const divisionesPreview = useNominaPreviewDivisiones();

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

  return (
    <div className="nomina-vista-previa-content flex min-h-0 flex-col">
      <header className="nomina-vista-previa-content__toolbar sticky top-0 z-20 shrink-0 bg-transparent px-3 py-2.5 sm:px-4">
        <div className="nomina-vista-previa-content__toolbar-row mx-auto flex w-full min-w-0 max-w-full flex-nowrap items-center justify-center gap-2 overflow-x-auto sm:gap-3">
          <h2 className="shrink-0 whitespace-nowrap text-sm font-bold text-amber-900 sm:text-base">
            Vista Previa
          </h2>

          <DateRangeField label="Desde" value={rangeStart} onChange={setRangeStart} />
          <DateRangeField label="Hasta" value={rangeEnd} onChange={setRangeEnd} />

          <NominaDivisionesToolbar
            divisiones={divisionesPreview.divisiones}
            sumPct={divisionesPreview.sumPct}
            pctOk={divisionesPreview.pctOk}
            canAdd={divisionesPreview.canAdd}
            canRemove={divisionesPreview.canRemove}
            onAdd={divisionesPreview.addColumna}
            onRemove={divisionesPreview.removeColumna}
            onSetCount={divisionesPreview.setColumnCount}
            onUpdatePorcentaje={divisionesPreview.updatePorcentaje}
          />

          <div
            className="flex shrink-0 items-center gap-1"
            role="group"
            aria-label="Zoom del reporte"
          >
            <button
              type="button"
              onClick={() => adjustZoom(-ZOOM_STEP)}
              disabled={contentZoom <= ZOOM_MIN}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-amber-800/80 hover:bg-amber-500/10 disabled:opacity-35"
              aria-label="Reducir zoom"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <label className="sr-only" htmlFor="nomina-preview-zoom">
              Zoom porcentual
            </label>
            <input
              id="nomina-preview-zoom"
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={contentZoom}
              onChange={(e) => setContentZoom(Number(e.target.value))}
              className="nomina-vista-previa-zoom-slider h-7 w-12 cursor-pointer sm:w-14"
              aria-valuemin={ZOOM_MIN}
              aria-valuemax={ZOOM_MAX}
              aria-valuenow={contentZoom}
            />
            <span className="min-w-[2.5rem] text-center text-[10px] font-bold tabular-nums text-amber-900">
              {contentZoom}%
            </span>
            <button
              type="button"
              onClick={() => adjustZoom(ZOOM_STEP)}
              disabled={contentZoom >= ZOOM_MAX}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-amber-800/80 hover:bg-amber-500/10 disabled:opacity-35"
              aria-label="Aumentar zoom"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={refreshVales}
            disabled={isPending}
            title="Recalcular"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-amber-200/80 bg-white/40 px-2 text-[11px] font-semibold text-slate-700 hover:border-amber-400/70 hover:bg-amber-50/50 sm:px-2.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-700 ${isPending ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Recalcular</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            title="Imprimir"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-amber-400/70 bg-amber-50/90 px-2 text-[11px] font-bold text-amber-900 hover:bg-amber-100 sm:px-2.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Imprimir</span>
          </button>
          {variant === 'modal' && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-amber-500/10 hover:text-amber-900"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="nomina-vista-previa-content__body min-h-0 flex-1 overflow-auto bg-[#eef2f6]">
        <div
          className="nomina-vista-previa-content__zoom-root p-3 sm:p-4"
          style={{
            zoom: contentZoom / 100,
          }}
        >
          <NominaPreviewReport report={report} divisiones={divisionesPreview.divisiones} />
        </div>
      </div>
    </div>
  );
}
