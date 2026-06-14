'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';
import NominaVistaPreviaContent, {
  type NominaPreviewRange,
} from '@/components/nomina/NominaVistaPreviaContent';
import { loadNominaVistaPreviaDataAction } from '@/lib/actions/nomina-preview-data';
import { listNominaPeriodosAction } from '@/lib/actions/nomina-actions';
import { nominaPeriodoMatchesArea, dedupePreviewRegistros } from '@/lib/nomina-preview';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import type { Personal } from '@/lib/types';

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
};

function filterRegistrosByArea(
  registros: NominaRegistroCerrado[],
  filterArea?: string,
): NominaRegistroCerrado[] {
  if (!filterArea) return registros;
  return registros.filter((r) => r.area === filterArea);
}

/** Datos en vivo de la semana actual solo si esa semana aún no está cerrada en el servidor. */
function mergeActiveRegistros(
  registros: NominaRegistroCerrado[],
  activeWeek: { semana_inicio: string; semana_fin?: string } | undefined,
  activeRegistros: NominaRegistroCerrado[] | undefined,
  filterArea?: string,
): NominaRegistroCerrado[] {
  const deduped = dedupePreviewRegistros(registros);
  const activeForArea = filterRegistrosByArea(activeRegistros ?? [], filterArea);
  if (!activeWeek || activeForArea.length === 0) return deduped;

  const weekClosedOnServer = deduped.some(
    (r) =>
      r.semana_inicio === activeWeek.semana_inicio &&
      (!filterArea || r.area === filterArea),
  );
  if (weekClosedOnServer) return deduped;

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
      area_detalle: snap.area_detalle,
      salario_base: snap.salario_base,
      salario_libre: snap.salario_libre,
      bono_transporte: snap.bono_transporte,
      esquema_rotacion: snap.esquema_rotacion,
      rotacion_inicio_fecha: snap.rotacion_inicio_fecha,
      fecha_ingreso: null,
      estatus: 'ACTIVO',
    } as Personal);
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
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [registrosCerrados, setRegistrosCerrados] = useState<NominaRegistroCerrado[]>([]);
  const [semanasCerradas, setSemanasCerradas] = useState<{ semana_inicio: string; semana_fin?: string }[]>([]);
  const [totalRegistrosHistoricos, setTotalRegistrosHistoricos] = useState(0);
  const [archivedPeriods, setArchivedPeriods] = useState<NominaPeriodoSummary[]>([]);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string | null>(null);
  const [isPeriodSwitching, startPeriodSwitch] = useTransition();

  const loadOptions = { filterArea };

  // Carga inicial: semanas activas (sin filtro) + lista de periodos archivados
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedPeriodoId(null);

    Promise.all([
      loadNominaVistaPreviaDataAction(loadOptions),
      listNominaPeriodosAction(),
    ]).then(([previewRes, periodosRes]) => {
        if (cancelled) return;
        setLoading(false);
        if (!previewRes.ok) {
          setError(previewRes.message || 'No se pudo cargar la vista previa');
          return;
        }

        let mergedRegistros = mergeActiveRegistros(
          previewRes.registrosCerrados,
          activeWeek,
          activeRegistros,
          filterArea,
        );
        let mergedSemanas = [...previewRes.semanasCerradas];

        const activeForArea = filterRegistrosByArea(activeRegistros ?? [], filterArea);
        if (activeWeek && activeForArea.length > 0) {
          const weekListed = mergedSemanas.some(
            (s) => s.semana_inicio === activeWeek.semana_inicio,
          );
          if (!weekListed) {
            mergedSemanas = [activeWeek, ...mergedSemanas];
          }
        }

        let personalForArea = filterArea
          ? previewRes.personal.filter((p) => p.area === filterArea)
          : previewRes.personal;
        personalForArea = enrichPersonalFromRegistros(personalForArea, mergedRegistros);

        setPersonal(personalForArea);
        setRegistrosCerrados(mergedRegistros);
        setSemanasCerradas(mergedSemanas);
        setTotalRegistrosHistoricos(previewRes.totalRegistrosHistoricos);
        if (periodosRes.ok) {
          const periodos = periodosRes.periodos.filter((p) => p.totalUsd > 0 || p.semanaCount > 0);
          setArchivedPeriods(
            filterArea
              ? periodos.filter((p) => nominaPeriodoMatchesArea(p, filterArea))
              : periodos,
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [open, refreshKey, activeWeek, activeRegistros, filterArea]);

  function handlePeriodSelect(period: NominaPeriodoSummary) {
    startPeriodSwitch(async () => {
      const res = await loadNominaVistaPreviaDataAction({
        periodoId: period.id,
        filterArea,
      });
      if (!res.ok) return;
      setRegistrosCerrados(dedupePreviewRegistros(res.registrosCerrados));
      setSemanasCerradas(res.semanasCerradas);
      setSelectedPeriodoId(period.id);
    });
  }

  function handleClearPeriod() {
    startPeriodSwitch(async () => {
      const res = await loadNominaVistaPreviaDataAction(loadOptions);
      if (!res.ok) return;

      let mergedRegistros = mergeActiveRegistros(
        res.registrosCerrados,
        activeWeek,
        activeRegistros,
        filterArea,
      );
      let mergedSemanas = [...res.semanasCerradas];

      const activeForArea = filterRegistrosByArea(activeRegistros ?? [], filterArea);
      if (activeWeek && activeForArea.length > 0) {
        const weekListed = mergedSemanas.some(
          (s) => s.semana_inicio === activeWeek.semana_inicio,
        );
        if (!weekListed) {
          mergedSemanas = [activeWeek, ...mergedSemanas];
        }
      }

      setRegistrosCerrados(mergedRegistros);
      setSemanasCerradas(mergedSemanas);
      setSelectedPeriodoId(null);
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
          />
        </div>
      )}
    </PageFormModal>
  );
}
