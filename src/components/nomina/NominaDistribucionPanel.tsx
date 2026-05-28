'use client';

import { Plus, Save, Trash2, Scale } from 'lucide-react';
import type { DistribucionLinea, DistribucionParte } from '@/lib/nomina-distribucion';

function fmtMoney(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = {
  totalNomina: number;
  partes: DistribucionParte[];
  lineas: DistribucionLinea[];
  sumPct: number;
  validationOk: boolean;
  validationMessage?: string;
  onUpdateParte: (id: string, patch: Partial<DistribucionParte>) => void;
  onAddParte: () => void;
  onRemoveParte: (id: string) => void;
  onRebalance: () => void;
  onSaveDefault?: () => void;
  variant?: 'dark' | 'light';
  compact?: boolean;
  readOnly?: boolean;
};

const COLORS = ['cyan', 'amber', 'emerald', 'violet', 'rose', 'sky'] as const;

export default function NominaDistribucionPanel({
  totalNomina,
  partes,
  lineas,
  sumPct,
  validationOk,
  validationMessage,
  onUpdateParte,
  onAddParte,
  onRemoveParte,
  onRebalance,
  onSaveDefault,
  variant = 'dark',
  compact = false,
  readOnly = false,
}: Props) {
  const isLight = variant === 'light';
  const border = isLight ? 'border-slate-400' : 'border-zinc-800';
  const muted = isLight ? 'text-slate-600' : 'text-white/40';
  const text = isLight ? 'text-slate-900' : 'text-white/95';
  const inputCls = isLight
    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
    : 'bg-zinc-950/40 border-zinc-800 text-white focus:border-amber-500/50';

  return (
    <div className={`space-y-3 ${compact ? '' : 'rounded-xl border p-4 ' + (isLight ? 'border-slate-500 bg-slate-50' : 'border-zinc-800 bg-zinc-950/40')}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>
            Total a distribuir
          </p>
          <p className={`text-2xl font-black tabular-nums ${isLight ? 'text-amber-800' : 'text-amber-500'}`}>
            {fmtMoney(totalNomina)}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-[10px] font-bold uppercase ${muted}`}>Suma %</p>
          <p
            className={`text-lg font-black tabular-nums ${
              validationOk ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : 'text-red-400'
            }`}
          >
            {sumPct.toFixed(2)}%
          </p>
        </div>
      </div>

      {!validationOk && validationMessage ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
          {validationMessage}
        </p>
      ) : null}

      <div className="space-y-2">
        {lineas.map((l, i) => {
          const color = COLORS[i % COLORS.length];
          return (
            <div
              key={l.id}
              className={`rounded-lg border ${border} p-2.5 ${isLight ? 'bg-white' : 'bg-zinc-900/50'}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {!readOnly ? (
                  <input
                    type="text"
                    value={l.nombre}
                    onChange={(e) => onUpdateParte(l.id, { nombre: e.target.value })}
                    className={`min-w-[8rem] flex-1 rounded-md border px-2 py-1 text-xs font-semibold outline-none ${inputCls}`}
                    placeholder="Beneficiario"
                  />
                ) : (
                  <p className={`flex-1 text-xs font-semibold ${text}`}>{l.nombre}</p>
                )}
                <div className="flex items-center gap-1">
                  {!readOnly ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={l.porcentaje}
                      onChange={(e) =>
                        onUpdateParte(l.id, { porcentaje: Number(e.target.value) || 0 })
                      }
                      className={`w-16 rounded-md border px-2 py-1 text-right text-xs font-bold tabular-nums outline-none ${inputCls}`}
                      title="Porcentaje"
                    />
                  ) : (
                    <span className={`text-xs font-bold tabular-nums ${text}`}>{l.porcentaje}%</span>
                  )}
                  <span className={`text-[10px] ${muted}`}>%</span>
                </div>
                <p
                  className={`text-sm font-bold tabular-nums ${
                    color === 'cyan'
                      ? 'text-cyan-400'
                      : color === 'emerald'
                        ? 'text-emerald-400'
                        : color === 'amber'
                          ? 'text-amber-400'
                          : 'text-violet-400'
                  }`}
                >
                  {fmtMoney(l.bruto)}
                </p>
                {!readOnly && partes.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onRemoveParte(l.id)}
                    className="rounded p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Quitar beneficiario"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-1">
                <span className={`text-[10px] ${muted}`}>Pagos directos:</span>
                {readOnly ? (
                  <span className={`text-xs tabular-nums ${text}`}>{fmtMoney(l.pagoDirecto)}</span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={l.pagoDirecto || ''}
                    onChange={(e) =>
                      onUpdateParte(l.id, { pagoDirecto: Number(e.target.value) || 0 })
                    }
                    className={`w-24 rounded-md border px-2 py-0.5 text-right text-xs tabular-nums outline-none ${inputCls}`}
                  />
                )}
                <span className={`ml-auto text-[10px] font-bold ${muted}`}>
                  Neto:{' '}
                  <span className={isLight ? 'text-emerald-800' : 'text-emerald-400'}>
                    {fmtMoney(l.neto)}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddParte}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase ${border} ${muted} hover:border-amber-500/40`}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </button>
          <button
            type="button"
            onClick={onRebalance}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase ${border} ${muted} hover:border-amber-500/40`}
          >
            <Scale className="h-3.5 w-3.5" />
            Repartir igual
          </button>
          {onSaveDefault ? (
            <button
              type="button"
              onClick={onSaveDefault}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase text-amber-400"
              title="Guarda estos porcentajes y nombres para futuras semanas y la vista previa"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar plantilla
            </button>
          ) : null}
        </div>
      ) : null}

      <p className={`text-[10px] leading-snug ${muted}`}>
        La plantilla guardada se reutiliza en cierre, vista previa Excel e impresión. Al cerrar la
        semana, estos porcentajes quedan registrados en el cierre.
      </p>
    </div>
  );
}
