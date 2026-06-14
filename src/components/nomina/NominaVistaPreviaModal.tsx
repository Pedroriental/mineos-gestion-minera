'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';
import NominaVistaPreviaContent, {
  type NominaPreviewRange,
} from '@/components/nomina/NominaVistaPreviaContent';
import { loadNominaVistaPreviaDataAction } from '@/lib/actions/nomina-preview-data';
import { listNominaPeriodosAction } from '@/lib/actions/nomina-actions';
import { nominaPeriodoMatchesArea } from '@/lib/nomina-preview';
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

        let mergedRegistros = [...previewRes.registrosCerrados];
        let mergedSemanas = [...previewRes.semanasCerradas];

        const activeForArea = filterRegistrosByArea(activeRegistros ?? [], filterArea);
        if (activeWeek && activeForArea.length > 0) {
          const isAlreadyClosed = previewRes.semanasCerradas.some(
            (s) => s.semana_inicio === activeWeek.semana_inicio,
          );
          if (!isAlreadyClosed) {
            mergedSemanas = [activeWeek, ...mergedSemanas];
            mergedRegistros = [...activeForArea, ...mergedRegistros];
          }
        }

        const personalForArea = filterArea
          ? previewRes.personal.filter((p) => p.area === filterArea)
          : previewRes.personal;

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
      setRegistrosCerrados(res.registrosCerrados);
      setSemanasCerradas(res.semanasCerradas);
      setSelectedPeriodoId(period.id);
    });
  }

  function handleClearPeriod() {
    startPeriodSwitch(async () => {
      const res = await loadNominaVistaPreviaDataAction(loadOptions);
      if (!res.ok) return;

      let mergedRegistros = [...res.registrosCerrados];
      let mergedSemanas = [...res.semanasCerradas];

      const activeForArea = filterRegistrosByArea(activeRegistros ?? [], filterArea);
      if (activeWeek && activeForArea.length > 0) {
        const isAlreadyClosed = res.semanasCerradas.some(
          (s) => s.semana_inicio === activeWeek.semana_inicio,
        );
        if (!isAlreadyClosed) {
          mergedSemanas = [activeWeek, ...mergedSemanas];
          mergedRegistros = [...activeForArea, ...mergedRegistros];
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
