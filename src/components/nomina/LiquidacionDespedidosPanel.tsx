'use client';

import { useState, useMemo, useTransition, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Printer } from 'lucide-react';
import type { Personal } from '@/lib/types';
import { calcularLiquidacionPendiente, type LiquidacionResultado } from '@/lib/nomina-calculo';
import { procesarLiquidacionDespedidosAction } from '@/lib/actions/nomina-v3';
import { getWeekStart } from '@/lib/rotacion-personal';

type Props = {
  area: string;
  personal: Personal[];
  onRefresh?: () => void;
};

type LiquidacionItem = {
  personal: Personal;
  liquidacion: LiquidacionResultado;
  bonificaciones: number;
  montoEditado: number | null;
  cerrada: boolean;
};

export function LiquidacionDespedidosPanel({ area, personal, onRefresh }: Props) {
  const [items, setItems] = useState<Record<string, LiquidacionItem>>({});
  const [processing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const despedidos = useMemo(
    () => personal.filter(
      (p) => p.area === area && p.estado_laboral === 'DESPEDIDO',
    ),
    [personal, area],
  );

  const initItem = useCallback((p: Personal): LiquidacionItem => {
    const despidoFecha = p.despido_fecha ?? p.estado_fin_fecha ?? new Date().toISOString().split('T')[0];
    const semanaActual = getWeekStart(new Date().toISOString().split('T')[0]);
    const ultimaPagada = new Date(semanaActual);
    ultimaPagada.setDate(ultimaPagada.getDate() - 7);
    const liquidacion = calcularLiquidacionPendiente(p, ultimaPagada.toISOString().split('T')[0], despidoFecha);
    return {
      personal: p,
      liquidacion,
      bonificaciones: 0,
      montoEditado: null,
      cerrada: false,
    };
  }, []);

  const ensureItem = useCallback((p: Personal) => {
    setItems((prev) => {
      if (prev[p.id]) return prev;
      return { ...prev, [p.id]: initItem(p) };
    });
  }, [initItem]);

  useMemo(() => {
    for (const p of despedidos) {
      ensureItem(p);
    }
  }, [despedidos, ensureItem]);

  const itemsList = despedidos.map((p) => items[p.id]).filter(Boolean);

  const handleBonificacion = (personalId: string, valor: number) => {
    setItems((prev) => ({
      ...prev,
      [personalId]: {
        ...prev[personalId],
        bonificaciones: valor,
      },
    }));
  };

  const handleMontoEditado = (personalId: string, valor: number | null) => {
    setItems((prev) => ({
      ...prev,
      [personalId]: {
        ...prev[personalId],
        montoEditado: valor,
      },
    }));
  };

  const montoFinal = (item: LiquidacionItem): number => {
    if (item.montoEditado !== null) return item.montoEditado;
    return parseFloat((item.liquidacion.montoTotal + item.bonificaciones).toFixed(2));
  };

  const totalGeneral = itemsList.reduce((n, item) => n + montoFinal(item), 0);

  const handleCerrar = () => {
    setError(null);
    setSuccess(null);
    const pendientes = itemsList.filter((item) => !item.cerrada);
    if (pendientes.length === 0) return;

    startTransition(async () => {
      const payload = pendientes.map((item) => ({
        personalId: item.personal.id,
        montoLiquidacion: montoFinal(item),
        bonificaciones: item.bonificaciones,
        observacion: item.liquidacion.semanas
          .map((s) => `${s.descripcion}: $${s.monto}`)
          .join('; '),
        despidoFecha: item.personal.despido_fecha ?? new Date().toISOString().split('T')[0],
      }));

      const res = await procesarLiquidacionDespedidosAction({ area, liquidaciones: payload });
      if (res.ok) {
        setSuccess(`${pendientes.length} liquidacion(es) procesada(s) correctamente.`);
        setItems((prev) => {
          const next = { ...prev };
          for (const item of pendientes) {
            next[item.personal.id] = { ...next[item.personal.id], cerrada: true };
          }
          return next;
        });
        onRefresh?.();
      } else {
        setError(res.message);
      }
    });
  };

  if (despedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
        <p className="text-sm text-zinc-500">No hay trabajadores despedidos en {area}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Liquidaciones Pendientes</h3>
          <p className="text-[11px] text-zinc-500">
            {despedidos.length} trabajador(es) despedido(s) — {itemsList.filter((i) => !i.cerrada).length} pendiente(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-amber-400">
            Total: ${totalGeneral.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={handleCerrar}
            disabled={processing || itemsList.every((i) => i.cerrada)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Cerrar Liquidación
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="space-y-2">
        {itemsList.map((item) => (
          <LiquidacionCard
            key={item.personal.id}
            item={item}
            montoFinal={montoFinal(item)}
            onBonificacion={(v) => handleBonificacion(item.personal.id, v)}
            onMontoEditado={(v) => handleMontoEditado(item.personal.id, v)}
          />
        ))}
      </div>
    </div>
  );
}

function LiquidacionCard({
  item,
  montoFinal,
  onBonificacion,
  onMontoEditado,
}: {
  item: LiquidacionItem;
  montoFinal: number;
  onBonificacion: (v: number) => void;
  onMontoEditado: (v: number | null) => void;
}) {
  const { personal: p, liquidacion, cerrada } = item;
  const [editMode, setEditMode] = useState(false);

  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      cerrada
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : 'border-white/5 bg-zinc-900/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-200 truncate">{p.nombre_completo}</p>
            {cerrada && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                Cerrada
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500">
            C.I. {p.cedula} · {p.cargo} · Esquema: {p.esquema_rotacion.replace(/_/g, ' ')}
          </p>
          <p className="text-[10px] text-zinc-500">
            Despido: {p.despido_fecha ?? '—'} · Causa: {p.despido_causa ?? '—'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold tabular-nums text-amber-400">
            ${montoFinal.toFixed(2)}
          </p>
          <p className="text-[9px] text-zinc-500">
            {liquidacion.semanas.length} sem · {liquidacion.diasParciales} días
            {liquidacion.semanaLibreGanada ? ' + libre' : ''}
          </p>
        </div>
      </div>

      {liquidacion.semanas.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {liquidacion.semanas.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">{s.semanaInicio} · {s.descripcion}</span>
              <span className="tabular-nums text-zinc-400">${s.monto.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {!cerrada && (
        <div className="mt-2 flex items-center gap-2">
          <label className="text-[10px] text-zinc-500">Bono extra:</label>
          <input
            type="number"
            step="any"
            placeholder="0"
            value={item.bonificaciones || ''}
            onChange={(e) => onBonificacion(Number(e.target.value) || 0)}
            className="w-20 rounded-md border border-white/5 bg-zinc-900/60 px-2 py-0.5 text-[11px] text-white outline-none focus:border-zinc-500/40"
          />
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            {editMode ? 'Auto' : 'Editar monto'}
          </button>
          {editMode && (
            <input
              type="number"
              step="any"
              placeholder={montoFinal.toFixed(2)}
              value={item.montoEditado ?? ''}
              onChange={(e) => onMontoEditado(e.target.value ? Number(e.target.value) : null)}
              className="w-24 rounded-md border border-white/5 bg-zinc-900/60 px-2 py-0.5 text-[11px] text-white outline-none focus:border-zinc-500/40"
            />
          )}
        </div>
      )}
    </div>
  );
}
