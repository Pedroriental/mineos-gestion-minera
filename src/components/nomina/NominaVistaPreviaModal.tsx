'use client';

import { Component, useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';
import NominaVistaPreviaContent, {
  type NominaPreviewRange,
} from '@/components/nomina/NominaVistaPreviaContent';
import {
  fetchNominaVistaPreviaClient,
  type VistaPreviaClientResponse,
} from '@/lib/nomina/vista-previa-client';
import { nominaPeriodoMatchesArea, dedupePreviewRegistros } from '@/lib/nomina-preview';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import type { Personal } from '@/lib/types';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { ManualPeriodPlantillaContext } from '@/lib/nomina/nomina-preview-plantilla';

class ModalErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[NominaVistaPreviaModal] Caught render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center bg-slate-50 text-slate-700">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h3 className="text-base font-bold text-slate-900">Error al renderizar vista previa</h3>
          <p className="text-xs text-slate-500 max-w-md">
            {this.state.error?.message || 'Ocurrió un problema inesperado al cargar la vista previa.'}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={this.props.onClose}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  initialRange?: NominaPreviewRange | null;
  refreshKey?: number;
  activeWeek?: { semana_inicio: string; semana_fin?: string };
  activeRegistros?: NominaRegistroCerrado[];
  /** Limita la planilla al área de nómina actual (mina, planta, etc.) */
  filterArea?: string;
  areaLabel?: string;
  /** Plantilla del ciclo manual en curso (si aún no está en periodos archivados). */
  activePlantilla?: RotacionPlantillaRecord | null;
  availablePlantillas?: RotacionPlantillaRecord[];
  activeManualPeriod?: ManualPeriodPlantillaContext;
  novedadesManuales?: import('@/lib/nomina-preview').NominaPreviewNovedad[];
};

function filterRegistrosByArea(
  registros: NominaRegistroCerrado[],
  filterArea?: string,
): NominaRegistroCerrado[] {
  if (!filterArea) return registros;
  return registros.filter((r) => r.area === filterArea);
}

/** Datos en vivo de la semana actual solo si esa semana aún no está cerrada en el servidor, o para añadir trabajadores nuevos agregados en la UI. */
function mergeActiveRegistros(
  registros: NominaRegistroCerrado[],
  activeWeek: { semana_inicio: string; semana_fin?: string } | undefined,
  activeRegistros: NominaRegistroCerrado[] | undefined,
  filterArea?: string,
): NominaRegistroCerrado[] {
  const deduped = dedupePreviewRegistros(registros);
  const activeForArea = filterRegistrosByArea(activeRegistros ?? [], filterArea);
  if (!activeWeek || activeForArea.length === 0) return deduped;

  const existingKeys = new Set(
    deduped
      .filter(
        (r) =>
          r.semana_inicio === activeWeek.semana_inicio &&
          (!filterArea || r.area === filterArea),
      )
      .map((r) => `${r.personal_id}|${r.semana_inicio}`),
  );

  const missingFromActive = activeForArea.filter(
    (r) =>
      r.semana_inicio === activeWeek.semana_inicio &&
      !existingKeys.has(`${r.personal_id}|${r.semana_inicio}`),
  );

  const weekClosedOnServer = deduped.some(
    (r) =>
      r.semana_inicio === activeWeek.semana_inicio &&
      (!filterArea || r.area === filterArea),
  );

  if (weekClosedOnServer) {
    if (missingFromActive.length > 0) {
      return dedupePreviewRegistros([...deduped, ...missingFromActive]);
    }
    return deduped;
  }

  const withoutActiveWeek = deduped.filter(
    (r) =>
      !(
        r.semana_inicio === activeWeek.semana_inicio &&
        (!filterArea || r.area === filterArea)
      ),
  );
  return dedupePreviewRegistros([...activeForArea, ...withoutActiveWeek]);
}

function enrichPersonalFromRegistros(
  personal: Personal[],
  registros: NominaRegistroCerrado[],
): Personal[] {
  const byId = new Map(personal.map((p) => [p.id, p]));
  for (const r of registros) {
    if (byId.has(r.personal_id)) continue;
    const snap = r.personal_snapshot;
    if (!snap) continue;
    byId.set(r.personal_id, {
      id: r.personal_id,
      cedula: snap.cedula,
      nombre_completo: snap.nombre_completo,
      cargo: snap.cargo,
      area: (r.area as Personal['area']) || (snap.area as Personal['area']),
      area_detalle: snap.area_detalle || '',
      salario_base: snap.salario_base,
      salario_libre: snap.salario_libre,
      bono_transporte: snap.bono_transporte,
      esquema_rotacion: (snap.esquema_rotacion as Personal['esquema_rotacion']) || 'FIJO_SEMANAL',
      rotacion_inicio_fecha: snap.rotacion_inicio_fecha || undefined,
      fecha_ingreso: '',
      estatus: 'ACTIVO',
      activo: true,
      created_at: '',
      updated_at: '',
    });
  }
  return [...byId.values()];
}

export function NominaVistaPreviaModal({
  open,
  onClose,
  initialRange = null,
  refreshKey = 0,
  activeWeek,
  activeRegistros,
  filterArea,
  areaLabel,
  activePlantilla,
  availablePlantillas,
  activeManualPeriod,
  novedadesManuales,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [registrosCerrados, setRegistrosCerrados] = useState<NominaRegistroCerrado[]>([]);
  const [semanasCerradas, setSemanasCerradas] = useState<{ semana_inicio: string; semana_fin?: string }[]>([]);
  const [totalRegistrosHistoricos, setTotalRegistrosHistoricos] = useState(0);
  const [valesMap, setValesMap] = useState<Record<string, number>>({});
  const [archivedPeriods, setArchivedPeriods] = useState<NominaPeriodoSummary[]>([]);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string | null>(null);
  const [isPeriodSwitching, startPeriodSwitch] = useTransition();

  const activeWeekRef = useRef(activeWeek);
  const activeRegistrosRef = useRef(activeRegistros);
  activeWeekRef.current = activeWeek;
  activeRegistrosRef.current = activeRegistros;

  const applyPreviewPayload = useCallback(
    (
      previewRes: VistaPreviaClientResponse,
      periodoId: string | null,
    ) => {
      if (!previewRes.ok) return false;

      if (previewRes.valesMap) {
        setValesMap(previewRes.valesMap);
      }

      const mergedRegistros = mergeActiveRegistros(
        previewRes.registrosCerrados,
        activeWeekRef.current,
        activeRegistrosRef.current,
        filterArea,
      );
      let mergedSemanas = [...previewRes.semanasCerradas];

      const activeForArea = filterRegistrosByArea(activeRegistrosRef.current ?? [], filterArea);
      const week = activeWeekRef.current;
      if (week && activeForArea.length > 0 && !periodoId) {
        const weekListed = mergedSemanas.some((s) => s.semana_inicio === week.semana_inicio);
        if (!weekListed) {
          mergedSemanas = [week, ...mergedSemanas];
        }
      }

      let personalForArea = filterArea
        ? previewRes.personal.filter(
            (p) =>
              p.area === filterArea ||
              mergedRegistros.some((r) => r.personal_id === p.id && r.area === filterArea),
          )
        : previewRes.personal;
      personalForArea = enrichPersonalFromRegistros(personalForArea, mergedRegistros);

      setPersonal(personalForArea);
      setRegistrosCerrados(mergedRegistros);
      setSemanasCerradas(mergedSemanas);
      setTotalRegistrosHistoricos(previewRes.totalRegistrosHistoricos);
      setSelectedPeriodoId(periodoId);
      return true;
    },
    [filterArea],
  );

  function resolvePeriodForRange(
    periodos: NominaPeriodoSummary[],
    range: NominaPreviewRange | null | undefined,
  ): NominaPeriodoSummary | null {
    if (!range?.start || !range?.end) return null;
    const scoped = filterArea
      ? periodos.filter((p) => nominaPeriodoMatchesArea(p, filterArea))
      : periodos;
    const exact = scoped.find((p) => p.rangeStart === range.start && p.rangeEnd === range.end);
    if (exact) return exact;
    return scoped.find((p) => p.rangeStart <= range.start && p.rangeEnd >= range.end) ?? null;
  }

  // Carga inicial al abrir o cuando refreshKey cambia (sin depender de activeRegistros).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const periodoToKeep = selectedPeriodoId;

    (async () => {
      try {
        const previewRes = await fetchNominaVistaPreviaClient({
          filterArea,
          periodoId: periodoToKeep ?? undefined,
          rangeStart: initialRange?.start,
          rangeEnd: initialRange?.end,
        });
        if (cancelled) return;

        if (!previewRes.ok) {
          setError(previewRes.message || 'No se pudo cargar la vista previa');
          return;
        }

        const periodos = previewRes.periodos.filter((p) => p.totalUsd > 0 || p.semanaCount > 0);
        const archived = filterArea
          ? periodos.filter((p) => nominaPeriodoMatchesArea(p, filterArea))
          : periodos;
        setArchivedPeriods(archived);

        const matchedPeriod =
          (periodoToKeep ? archived.find((p) => p.id === periodoToKeep) : null) ??
          (previewRes.activePeriodoId ? archived.find((p) => p.id === previewRes.activePeriodoId) : null) ??
          resolvePeriodForRange(archived, initialRange);

        applyPreviewPayload(previewRes, matchedPeriod?.id ?? previewRes.activePeriodoId ?? null);
      } catch (err: any) {
        console.error('[NominaVistaPreviaModal] Error cargando vista previa:', err);
        if (cancelled) return;
        setError(err?.message || 'Error de conexión al cargar la vista previa.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedPeriodoId se lee solo para preservar ciclo en refresh
  }, [open, refreshKey, filterArea, initialRange?.start, initialRange?.end, applyPreviewPayload]);

  // Al cerrar el modal, limpiar periodo seleccionado para la próxima apertura.
  useEffect(() => {
    if (!open) {
      setSelectedPeriodoId(null);
    }
  }, [open]);

  // Mezclar datos en vivo de la semana actual sin recargar del servidor.
  useEffect(() => {
    if (!open) return;
    setRegistrosCerrados((prev) =>
      mergeActiveRegistros(prev, activeWeekRef.current, activeRegistrosRef.current, filterArea),
    );
  }, [open, filterArea, activeRegistros, activeWeek]);

  function handlePeriodSelect(period: NominaPeriodoSummary) {
    startPeriodSwitch(async () => {
      try {
        const res = await fetchNominaVistaPreviaClient({
          periodoId: period.id,
          filterArea,
        });
        if (!res.ok) {
          setError(res.message || 'No se pudo cargar el periodo.');
          return;
        }
        applyPreviewPayload(res, period.id);
      } catch (err: any) {
        console.error('[NominaVistaPreviaModal] Error cambiando periodo:', err);
        setError(err?.message || 'Error de conexión al cambiar periodo.');
      }
    });
  }

  function handleClearPeriod() {
    startPeriodSwitch(async () => {
      try {
        const res = await fetchNominaVistaPreviaClient({
          filterArea,
          rangeStart: initialRange?.start,
          rangeEnd: initialRange?.end,
        });
        if (!res.ok) {
          setError(res.message || 'No se pudo restablecer el periodo.');
          return;
        }
        applyPreviewPayload(res, null);
      } catch (err: any) {
        console.error('[NominaVistaPreviaModal] Error limpiando periodo:', err);
        setError(err?.message || 'Error de conexión al restablecer.');
      }
    });
  }

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="page-form-modal-panel--excel-preview page-form-modal-panel--excel-preview-md flex w-full max-h-[min(88dvh,900px)] flex-col overflow-hidden p-0 sm:max-w-[min(96vw,1280px)] sm:rounded-2xl"
    >
      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          <p className="text-sm">Generando vista previa…</p>
        </div>
      ) : error ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isPeriodSwitching && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          )}
          <ModalErrorBoundary onClose={onClose}>
            <NominaVistaPreviaContent
              personal={personal}
              registrosCerrados={registrosCerrados}
              semanasCerradas={semanasCerradas}
              totalRegistrosHistoricos={totalRegistrosHistoricos}
              initialRange={initialRange}
              archivedPeriods={archivedPeriods}
              periodoId={selectedPeriodoId ?? undefined}
              variant="modal"
              onClose={onClose}
              onPeriodSelect={handlePeriodSelect}
              onClearPeriod={handleClearPeriod}
              filterArea={filterArea}
              areaLabel={areaLabel}
              fallbackPlantilla={activePlantilla}
              availablePlantillas={availablePlantillas}
              fallbackManualPeriod={activeManualPeriod}
              initialValesMap={valesMap}
              novedadesManuales={novedadesManuales}
            />
          </ModalErrorBoundary>
        </div>
      )}
    </PageFormModal>
  );
}
