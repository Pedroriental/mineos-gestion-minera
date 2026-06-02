'use client';

import { Minus, Plus, Save } from 'lucide-react';
import type { NominaDivisionParam } from '@/lib/reconciliation/nomina-divisiones';
import { formatNominaDivisionLabel } from '@/lib/reconciliation/nomina-divisiones';

type Props = {
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
  layout?: 'inline' | 'stacked';
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
  onSave,
  saving,
  layout = 'inline',
}: Props) {
  const stacked = layout === 'stacked';

  return (
    <div
      className={
        stacked
          ? 'space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3'
          : 'flex min-w-0 shrink-0 flex-wrap items-center gap-1 rounded-md border border-amber-200/70 bg-white/55 px-2 py-1'
      }
    >
      <div className={stacked ? 'flex flex-wrap items-center gap-2' : 'contents'}>
        {!stacked ? (
          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-800/55">Reparto</span>
        ) : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canRemove}
            onClick={onRemove}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 disabled:opacity-35"
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
            className="h-7 w-10 rounded-md border border-slate-200 bg-white px-0.5 text-center text-[11px] font-bold tabular-nums text-slate-900 outline-none focus:border-amber-400"
            aria-label="Cantidad de divisiones"
            title="Cantidad de columnas (0–8)"
          />
          <button
            type="button"
            disabled={!canAdd}
            onClick={onAdd}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 disabled:opacity-35"
            aria-label="Agregar columna"
            title="Agregar columna"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {stacked && divisiones.length > 0 ? (
          <div className="grid gap-2">
            {divisiones.map((d) => (
              <label
                key={d.id}
                className="flex items-center justify-between gap-2 text-xs text-slate-700"
                title={formatNominaDivisionLabel(d.porcentaje)}
              >
                <span>{formatNominaDivisionLabel(d.porcentaje)}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={d.porcentaje}
                    onChange={(e) => onUpdatePorcentaje(d.id, Number(e.target.value) || 0)}
                    className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-900 outline-none focus:border-amber-400"
                    aria-label={`Porcentaje ${formatNominaDivisionLabel(d.porcentaje)}`}
                  />
                  <span className="text-slate-400">%</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          divisiones.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-800"
              title={formatNominaDivisionLabel(d.porcentaje)}
            >
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={d.porcentaje}
                onChange={(e) => onUpdatePorcentaje(d.id, Number(e.target.value) || 0)}
                className="w-11 rounded border border-amber-200/80 bg-white px-1 py-0.5 text-right text-[10px] font-bold tabular-nums text-slate-900 outline-none focus:border-amber-400"
                aria-label={`Porcentaje ${formatNominaDivisionLabel(d.porcentaje)}`}
              />
              <span className="text-[9px] text-slate-500">%</span>
            </label>
          ))
        )}
      </div>

      <div className={stacked ? 'flex items-center justify-between gap-2 pt-1' : 'contents'}>
        {divisiones.length > 0 ? (
          <span
            className={`text-[11px] font-semibold tabular-nums ${pctOk ? 'text-emerald-700' : 'text-red-600'}`}
            title="Suma de porcentajes"
          >
            Σ {sumPct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-[11px] text-slate-500" title="Sin reparto configurado">
            Sin reparto
          </span>
        )}

        {onSave ? (
          <button
            type="button"
            disabled={saving || (divisiones.length > 0 && !pctOk)}
            onClick={() => void onSave()}
            title="Guardar reparto en Biblioteca de Variables"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-800 disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            {saving ? '…' : 'Guardar'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
