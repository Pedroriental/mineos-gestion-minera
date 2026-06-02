'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import NominaVistaPreviaContent from '@/components/nomina/NominaVistaPreviaContent';
import { loadNominaVistaPreviaDataAction } from '@/lib/actions/nomina-preview-data';
import { listNominaPeriodosAction } from '@/lib/actions/nomina-actions';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import type { Personal } from '@/lib/types';

type Props = {
  rangeStart: string;
  rangeEnd: string;
  label?: string;
  refreshKey?: number;
  periodoId?: string;
};

export function NominaPeriodPreviewPane({ rangeStart, rangeEnd, label, refreshKey = 0, periodoId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [registrosCerrados, setRegistrosCerrados] = useState<NominaRegistroCerrado[]>([]);
  const [semanasCerradas, setSemanasCerradas] = useState<{ semana_inicio: string }[]>([]);
  const [totalRegistrosHistoricos, setTotalRegistrosHistoricos] = useState(0);
  const [archivedPeriods, setArchivedPeriods] = useState<NominaPeriodoSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      loadNominaVistaPreviaDataAction({ rangeStart, rangeEnd, periodoId }),
      listNominaPeriodosAction(),
    ]).then(([previewRes, periodosRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (!previewRes.ok) {
        setError(previewRes.message || 'No se pudo cargar la vista previa');
        return;
      }
      setPersonal(previewRes.personal);
      setRegistrosCerrados(previewRes.registrosCerrados);
      setSemanasCerradas(previewRes.semanasCerradas);
      setTotalRegistrosHistoricos(previewRes.totalRegistrosHistoricos);
      if (periodosRes.ok) {
        setArchivedPeriods(periodosRes.periodos.filter((p) => p.totalUsd > 0 || p.semanaCount > 0));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, refreshKey, periodoId]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
        <p className="text-xs">Cargando planilla…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6 text-center text-xs text-red-600">
        {error}
      </div>
    );
  }

  return (
    <NominaVistaPreviaContent
      personal={personal}
      registrosCerrados={registrosCerrados}
      semanasCerradas={semanasCerradas}
      totalRegistrosHistoricos={totalRegistrosHistoricos}
      initialRange={{ start: rangeStart, end: rangeEnd }}
      archivedPeriods={archivedPeriods}
      variant="embed"
      embedTitle={label}
      periodoId={periodoId}
    />
  );
}
