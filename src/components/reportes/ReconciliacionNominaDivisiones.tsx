'use client';

import { Minus, Plus } from 'lucide-react';
import {
  applyNominaDivisionPorcentaje,
  createNominaDivision,
  DEFAULT_NOMINA_DIVISIONES,
  rebalanceNominaDivisionesIgual,
  splitNominaByDivisiones,
  sumNominaDivisionesPct,
  type NominaDivisionParam,
} from '@/lib/reconciliation/nomina-divisiones';
import { cn } from '@/lib/utils';

const MAX_PARTES = 8;

const inputClass =
  'w-full rounded-lg border border-white/5 bg-zinc-900/40 px-2 py-1 text-sm text-white outline-none focus:border-zinc-500/40 focus:ring-1 focus:ring-zinc-500/15';

export function ReconciliacionNominaDivisiones({
  divisiones,
  onChange,
  nominaReferenciaUsd,
}: {
  divisiones: NominaDivisionParam[];
  onChange: (next: NominaDivisionParam[]) => void;
  /** Total de nómina del periodo para vista previa del reparto. */
  nominaReferenciaUsd: number;
}) {
  const sumPct = sumNominaDivisionesPct(divisiones);
  const pctOk = divisiones.length === 0 || Math.abs(sumPct - 100) <= 0.05;
  const splits =
    divisiones.length > 0 && nominaReferenciaUsd > 0
      ? splitNominaByDivisiones(nominaReferenciaUsd, divisiones)
      : [];

  const setCount = (count: number) => {
    const n = Math.min(MAX_PARTES, Math.max(0, Math.floor(count)));
    if (n === 0) {
      onChange([]);
      return;
    }
    if (n === divisiones.length) return;
    if (n > divisiones.length) {
      const added = Array.from({ length: n - divisiones.length }, () => createNominaDivision(0));
      onChange(rebalanceNominaDivisionesIgual([...divisiones, ...added]));
      return;
    }
    onChange(rebalanceNominaDivisionesIgual(divisiones.slice(0, n)));
  };

  const updateNombre = (id: string, nombre: string) => {
    onChange(divisiones.map((d) => (d.id === id ? { ...d, nombre } : d)));
  };

  return (
    <div className="space-y-3 sm:max-w-2xl">
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        Opcional: define cómo seccionar el total de nómina del periodo (misma lógica que la vista
        previa). Cada parte puede tener nombre y porcentaje personalizados.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Partes
        </span>
        <button
          type="button"
          disabled={divisiones.length === 0}
          onClick={() => setCount(divisiones.length - 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 disabled:opacity-35"
          aria-label="Quitar parte"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          min={0}
          max={MAX_PARTES}
          value={divisiones.length}
          onChange={(e) => setCount(Number(e.target.value) || 0)}
          className="h-7 w-10 rounded-lg border border-white/5 bg-zinc-900/40 text-center text-xs font-semibold tabular-nums text-white"
          aria-label="Cantidad de partes"
        />
        <button
          type="button"
          disabled={divisiones.length >= MAX_PARTES}
          onClick={() => setCount(divisiones.length + 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 disabled:opacity-35"
          aria-label="Agregar parte"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {divisiones.length === 0 && (
          <button
            type="button"
            onClick={() => onChange([...DEFAULT_NOMINA_DIVISIONES])}
            className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200 underline-offset-2 hover:underline"
          >
            Usar plantilla 33 / 33 / 34 %
          </button>
        )}
        {divisiones.length > 0 && (
          <span
            className={cn(
              'text-[10px] font-semibold tabular-nums',
              pctOk ? 'text-zinc-400' : 'text-red-400',
            )}
          >
            Σ {sumPct.toFixed(1)}%
          </span>
        )}
      </div>

      {divisiones.length > 0 && (
        <div className="space-y-2">
          {divisiones.map((d, i) => (
            <div key={d.id} className="grid grid-cols-[1fr_5rem] gap-2 items-center">
              <input
                type="text"
                value={d.nombre}
                onChange={(e) => updateNombre(d.id, e.target.value)}
                placeholder={`Parte ${i + 1}`}
                className={cn(inputClass, 'font-medium')}
                aria-label={`Nombre parte ${i + 1}`}
              />
              <label className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={d.porcentaje}
                  onChange={(e) =>
                    onChange(applyNominaDivisionPorcentaje(divisiones, d.id, Number(e.target.value)))
                  }
                  className={cn(inputClass, 'text-right tabular-nums')}
                />
                <span className="text-[10px] text-zinc-500 shrink-0">%</span>
              </label>
            </div>
          ))}
        </div>
      )}

      {splits.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-zinc-900/25 px-3 py-2.5 space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
            Vista previa del reparto
          </p>
          <p className="text-[10px] text-zinc-500">
            Sobre{' '}
            <span className="text-zinc-300 tabular-nums font-medium">
              ${nominaReferenciaUsd.toLocaleString('es')}
            </span>{' '}
            (referencia: semanas cerradas del periodo)
          </p>
          <ul className="space-y-1">
            {splits.map((s) => (
              <li
                key={s.id}
                className="flex justify-between gap-2 text-[11px] text-zinc-300 tabular-nums"
              >
                <span className="truncate">{s.nombre}</span>
                <span className="font-medium shrink-0">${s.montoUsd.toLocaleString('es')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
