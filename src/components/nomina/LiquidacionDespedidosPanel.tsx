'use client';

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Personal } from '@/lib/types';
import { calcularLiquidacionPendiente, type LiquidacionResultado } from '@/lib/nomina-calculo';
import { totalSemanasEsquema } from '@/lib/nomina/perfil-ciclo-reglas';
import { procesarLiquidacionDespedidosAction } from '@/lib/actions/nomina-v3';

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

function calcularUltimaPagada(p: Personal, despidoFecha: string): string {
  const totalCiclo = totalSemanasEsquema(p.esquema_rotacion);
  const cicloSemanas = Math.max(1, totalCiclo);
  const despido = new Date(`${despidoFecha}T00:00:00`);
  despido.setDate(despido.getDate() - cicloSemanas * 7);
  const y = despido.getFullYear();
  const m = String(despido.getMonth() + 1).padStart(2, '0');
  const d = String(despido.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function LiquidacionDespedidosPanel({ area, personal, onRefresh }: Props) {
  const [overrides, setOverrides] = useState<Record<string, { bonificaciones: number; montoEditado: number | null; cerrada: boolean }>>({});
  const [processing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const despedidos = useMemo(
    () => personal.filter(
      (p) => p.area === area && p.estado_laboral === 'DESPEDIDO',
    ),
    [personal, area],
  );

  const itemsList: LiquidacionItem[] = useMemo(() => {
    return despedidos.map((p) => {
      const despidoFecha = p.despido_fecha ?? p.estado_fin_fecha ?? new Date().toISOString().split('T')[0];
      const ultimaPagada = calcularUltimaPagada(p, despidoFecha);
      const liquidacion = calcularLiquidacionPendiente(p, ultimaPagada, despidoFecha);
      const ov = overrides[p.id];
      return {
        personal: p,
        liquidacion,
        bonificaciones: ov?.bonificaciones ?? 0,
        montoEditado: ov?.montoEditado ?? null,
        cerrada: ov?.cerrada ?? false,
      };
    });
  }, [despedidos, overrides]);

  useEffect(() => {
    setError(null);
  }, [itemsList.length]);

  const handleBonificacion = useCallback((personalId: string, valor: number) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? { bonificaciones: 0, montoEditado: null, cerrada: false };
      next[personalId] = { ...existing, bonificaciones: valor };
      return next;
    });
  }, []);

  const handleMontoEditado = useCallback((personalId: string, valor: number | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? { bonificaciones: 0, montoEditado: null, cerrada: false };
      next[personalId] = { ...existing, montoEditado: valor };
      return next;
    });
  }, []);

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
          .map((s) => `${s.descripcion}: $${s.monto.toFixed(2)}`)
          .join('; '),
        despidoFecha: item.personal.despido_fecha ?? new Date().toISOString().split('T')[0],
      }));

      const res = await procesarLiquidacionDespedidosAction({ area, liquidaciones: payload });
      if (res.ok) {
        setSuccess(`${pendientes.length} liquidacion(es) procesada(s) correctamente.`);
        setOverrides((prev) => {
          const next = { ...prev };
          for (const item of pendientes) {
            const existing = next[item.personal.id] ?? { bonificaciones: 0, montoEditado: null, cerrada: false };
            next[item.personal.id] = { ...existing, cerrada: true };
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
  const { personal: p, liquidacion, bonificaciones, cerrada } = item;
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

      {liquidacion.semanas.length === 0 && (
        <div className="mt-2 text-[10px] text-amber-400/80">
          Sin cálculo automático (sin fecha de inicio de rotación o despido). Ingresa el monto manualmente.
        </div>
      )}

      {!cerrada && (
        <div className="mt-2 flex items-center gap-2">
          <label className="text-[10px] text-zinc-500">Bono extra:</label>
          <input
            type="number"
            step="any"
            placeholder="0"
            value={bonificaciones || ''}
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
