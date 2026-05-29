'use client';

import { useState } from 'react';
import {
  DollarSign,
  Edit2,
  History,
  Loader2,
  Plus,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import type { PreNominaRowState } from '@/components/nomina/nomina-mobile';
import type { HistorialPagoRow, NominaVale } from '@/lib/types';

function Sparkline({
  data,
  width = 200,
  height = 40,
  color = '#f59e0b',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  row: PreNominaRowState;
  vales: NominaVale[];
  historial: HistorialPagoRow[];
  loading: boolean;
  canEdit: boolean;
  locked: boolean;
  isPending: boolean;
  newValeMonto: string;
  newValeMotivo: string;
  onNewValeMontoChange: (v: string) => void;
  onNewValeMotivoChange: (v: string) => void;
  onAddVale: () => void;
  onDeleteVale: (valeId: string) => void;
  onEditPerfil: () => void;
  onFichaPago: () => void;
  fmtMoney: (n: number) => string;
  fmtDate: (d: string | null | undefined) => string;
  initials: string;
  avatarColor: string;
};

export default function NominaTrabajadorModal({
  open,
  onClose,
  row,
  vales,
  historial,
  loading,
  canEdit,
  locked,
  isPending,
  newValeMonto,
  newValeMotivo,
  onNewValeMontoChange,
  onNewValeMotivoChange,
  onAddVale,
  onDeleteVale,
  onEditPerfil,
  onFichaPago,
  fmtMoney,
  fmtDate,
  initials,
  avatarColor,
}: Props) {
  const [tab, setTab] = useState<'vales' | 'historial'>('vales');
  const p = row.personal;
  const totalVales = vales.reduce((s, v) => s + Number(v.monto), 0);

  return (
    <PageFormModal open={open} onClose={onClose} panelClassName="sm:max-w-lg">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white sm:right-6 sm:top-6"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-3 pr-10">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ${avatarColor}`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-white/95">{p.nombre_completo}</h3>
          <p className="mt-0.5 truncate text-xs text-white/40">
            C.I. {p.cedula} · {p.cargo}
          </p>
        </div>
      </div>

      <div className="mt-5 flex border-b border-zinc-800">
        {(['vales', 'historial'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 pb-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
              tab === t
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-white/40 hover:text-white/60'
            }`}
          >
            {t === 'vales' ? 'Vales' : 'Historial'}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[min(52dvh,480px)] space-y-4 overflow-y-auto pr-1">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Perfil</h4>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-white/40">Salario labor</span>
              <p className="font-semibold tabular-nums text-white/90">
                {fmtMoney(Number(p.salario_base))}
              </p>
            </div>
            <div>
              <span className="text-white/40">Salario libre</span>
              <p className="font-semibold tabular-nums text-white/90">
                {fmtMoney(Number(p.salario_libre) || 100)}
              </p>
            </div>
            <div>
              <span className="text-white/40">Bono transporte</span>
              <p className="font-semibold tabular-nums text-white/90">
                {fmtMoney(Number(p.bono_transporte))}
              </p>
            </div>
            <div>
              <span className="text-white/40">Ingreso</span>
              <p className="font-semibold text-white/90">{fmtDate(p.fecha_ingreso)}</p>
            </div>
          </div>
        </div>

        {tab === 'vales' ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <DollarSign className="h-3.5 w-3.5 text-red-400" />
                Vales / adelantos
              </h4>
              <span className="text-xs font-bold tabular-nums text-red-400">
                Total: {fmtMoney(totalVales)}
              </span>
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              </div>
            ) : vales.length > 0 ? (
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {vales.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/50 bg-zinc-950/50 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white/80">
                        {v.motivo || 'Adelanto'}
                      </p>
                      <p className="text-[10px] text-white/30">{fmtDate(v.fecha)}</p>
                    </div>
                    <p className="shrink-0 text-xs font-bold tabular-nums text-red-400">
                      {fmtMoney(Number(v.monto))}
                    </p>
                    {canEdit && !locked ? (
                      <button
                        type="button"
                        onClick={() => onDeleteVale(v.id)}
                        disabled={isPending}
                        className="shrink-0 rounded p-1 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-white/30">No hay vales pendientes</p>
            )}
            {canEdit && !locked ? (
              <div className="mt-3 space-y-2.5 border-t border-zinc-800 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Registrar vale
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="$ Monto"
                    value={newValeMonto}
                    onChange={(e) => onNewValeMontoChange(e.target.value)}
                    className="w-24 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-xs text-white outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
                  />
                  <input
                    type="text"
                    placeholder="Motivo"
                    value={newValeMotivo}
                    onChange={(e) => onNewValeMotivoChange(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-xs text-white outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={onAddVale}
                  disabled={isPending || !newValeMonto}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 text-xs font-bold text-black transition-colors hover:bg-amber-500 disabled:opacity-40"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Registrar vale
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <History className="h-3.5 w-3.5 text-amber-400" />
              Historial de pagos
            </h4>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              </div>
            ) : historial.length > 0 ? (
              <div className="mt-3 space-y-2">
                {historial.length >= 2 ? (
                  <div className="flex justify-center border-b border-zinc-800 pb-2">
                    <Sparkline
                      data={[...historial].reverse().map((h) => Number(h.monto_pagado))}
                    />
                  </div>
                ) : null}
                {historial.map((h) => (
                  <div
                    key={h.semana_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/50 bg-zinc-950/50 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white/80">
                        {fmtDate(h.semana_inicio)} — {fmtDate(h.semana_fin)}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                            h.es_semana_libre
                              ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400'
                              : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {h.es_semana_libre ? 'Libre' : 'Labor'}
                        </span>
                        {Number(h.bono_transporte_pagado) > 0 ? (
                          <span className="text-[8px] text-white/30">
                            +Trans. {fmtMoney(Number(h.bono_transporte_pagado))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-amber-500">
                      {fmtMoney(Number(h.monto_pagado))}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-white/30">
                No hay pagos registrados aún
              </p>
            )}
          </div>
        )}
      </div>

      <PageFormModalFooter className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onEditPerfil} className="btn-secondary h-10 text-xs">
          <Edit2 className="mr-2 inline h-3.5 w-3.5" />
          Editar perfil
        </button>
        <button type="button" onClick={onFichaPago} className="btn-secondary h-10 text-xs">
          <Receipt className="mr-2 inline h-3.5 w-3.5" />
          Ficha de pago
        </button>
      </PageFormModalFooter>
    </PageFormModal>
  );
}
