'use client';

import { Minus, Plus } from 'lucide-react';
import type { PreviewDivision } from '@/lib/nomina-preview-divisiones';

type Props = {
  divisiones: PreviewDivision[];
  sumPct: number;
  pctOk: boolean;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onSetCount: (count: number) => void;
  onUpdatePorcentaje: (id: string, porcentaje: number) => void;
};

const MAX_DIVISIONES = 8;

export default function NominaDivisionesToolbar({
  divisiones,
  sumPct,
  pctOk,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
  onSetCount,
  onUpdatePorcentaje,
}: Props) {
  return (
    <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-1 rounded-md border border-amber-200/70 bg-white/55 px-2 py-1">
      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-800/55">Divisiones</span>
      <button
        type="button"
        disabled={!canRemove}
        onClick={onRemove}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-amber-200/80 text-amber-900 disabled:opacity-35"
        aria-label="Quitar columna"
        title="Quitar columna"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        min={0}
        max={MAX_DIVISIONES}
        step={1}
        value={divisiones.length}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return;
          onSetCount(Number(raw));
        }}
        className="h-6 w-9 rounded border border-amber-200/80 bg-white px-0.5 text-center text-[10px] font-bold tabular-nums text-slate-900 outline-none focus:border-amber-400"
        aria-label="Cantidad de divisiones"
        title="Cantidad de columnas (0–8). Ej.: escribe 2 para pasar de 0 a dos partes al 50%"
      />
      <button
        type="button"
        disabled={!canAdd}
        onClick={onAdd}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-amber-200/80 text-amber-900 disabled:opacity-35"
        aria-label="Agregar columna"
        title="Agregar columna"
      >
        <Plus className="h-3 w-3" />
      </button>

      {divisiones.map((d, i) => (
        <label
          key={d.id}
          className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-800"
        >
          <span className="text-amber-900/70">{i + 1}</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={d.porcentaje}
            onChange={(e) => onUpdatePorcentaje(d.id, Number(e.target.value) || 0)}
            className="w-11 rounded border border-amber-200/80 bg-white px-1 py-0.5 text-right text-[10px] font-bold tabular-nums text-slate-900 outline-none focus:border-amber-400"
            aria-label={`Porcentaje parte ${i + 1}`}
          />
          <span className="text-[9px] text-slate-500">%</span>
        </label>
      ))}

      {divisiones.length > 0 ? (
        <span
          className={`text-[9px] font-bold tabular-nums ${pctOk ? 'text-emerald-700' : 'text-red-600'}`}
          title="Suma de porcentajes (se autocompleta al editar un campo)"
        >
          Σ {sumPct.toFixed(1)}%
        </span>
      ) : (
        <span className="text-[9px] text-slate-500" title="Sin columnas de reparto">
          Sin reparto
        </span>
      )}
    </div>
  );
}
