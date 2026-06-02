'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import NominaDivisionesToolbar from '@/components/nomina/NominaDivisionesToolbar';
import type { NominaDivisionParam } from '@/lib/reconciliation/nomina-divisiones';
import { cn } from '@/lib/utils';

type DivisionesProps = {
  divisiones: NominaDivisionParam[];
  sumPct: number;
  pctOk: boolean;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onSetCount: (count: number) => void;
  onUpdatePorcentaje: (id: string, porcentaje: number) => void;
  onSave?: () => void | Promise<{ ok: boolean; message?: string }>;
  saving?: boolean;
};

type Props = {
  includeProjection: boolean;
  onIncludeProjectionChange: (v: boolean) => void;
  showWorkingWeekAction: boolean;
  onGoToWorkingWeek: () => void;
  contentZoom: number;
  onZoomChange: (v: number) => void;
  onZoomStep: (delta: number) => void;
  zoomMin: number;
  zoomMax: number;
  zoomStep: number;
  divisiones: DivisionesProps;
};

export default function NominaPreviewOptionsMenu({
  includeProjection,
  onIncludeProjectionChange,
  showWorkingWeekAction,
  onGoToWorkingWeek,
  contentZoom,
  onZoomChange,
  onZoomStep,
  zoomMin,
  zoomMax,
  zoomStep,
  divisiones,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors',
          open
            ? 'border-slate-300 bg-slate-100 text-slate-900'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Ajustes</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Ajustes de vista previa"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[min(92vw,20rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Opciones
          </p>

          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={includeProjection}
                onChange={(e) => onIncludeProjectionChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              Incluir estimados por rotación
            </label>

            {showWorkingWeekAction ? (
              <button
                type="button"
                onClick={() => {
                  onGoToWorkingWeek();
                  setOpen(false);
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 hover:bg-sky-100"
              >
                <Clock className="h-3.5 w-3.5" />
                Ir a semana en curso
              </button>
            ) : null}

            <div>
              <p className="mb-2 text-[11px] font-medium text-slate-600">Reparto por partes</p>
              <NominaDivisionesToolbar {...divisiones} layout="stacked" />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium text-slate-600">Zoom del reporte</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onZoomStep(-zoomStep)}
                  disabled={contentZoom <= zoomMin}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                  aria-label="Reducir zoom"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="range"
                  min={zoomMin}
                  max={zoomMax}
                  step={zoomStep}
                  value={contentZoom}
                  onChange={(e) => onZoomChange(Number(e.target.value))}
                  className="nomina-vista-previa-zoom-slider min-w-0 flex-1"
                  aria-valuemin={zoomMin}
                  aria-valuemax={zoomMax}
                  aria-valuenow={contentZoom}
                />
                <span className="w-10 text-center text-[11px] font-semibold tabular-nums text-slate-700">
                  {contentZoom}%
                </span>
                <button
                  type="button"
                  onClick={() => onZoomStep(zoomStep)}
                  disabled={contentZoom >= zoomMax}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                  aria-label="Aumentar zoom"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
