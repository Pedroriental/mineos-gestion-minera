'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Building2, Plus, Trash2, Users } from 'lucide-react';
import { listEmpresasInversorasAction } from '@/lib/actions/empresas-inversoras';
import type { CompensacionEmpresa } from '@/lib/compensacion-gastos';

type EmpresaAsignada = {
  empresa_id: string;
  monto_pagado: number;
  porcentaje: number;
};

type Props = {
  montoTotal: number;
  empresasAsignadas: EmpresaAsignada[];
  onChange: (empresas: EmpresaAsignada[]) => void;
  /** Si true, muestra un warning cuando la suma no coincide con el total. Default: true. */
  showWarning?: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function GastoEmpresaSelector({
  montoTotal,
  empresasAsignadas,
  onChange,
  showWarning = true,
}: Props) {
  const [empresas, setEmpresas] = useState<CompensacionEmpresa[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar empresas inversoras al montar
  useEffect(() => {
    let cancelled = false;
    listEmpresasInversorasAction().then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) {
        setEmpresas(res.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-inicializar con La Fé 100% si no hay asignaciones.
  // Usamos un ref para evitar re-disparar en cada cambio de empresasAsignadas.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || loading || empresas.length === 0) return;
    if (empresasAsignadas.length === 0) {
      const laFe = empresas.find((e) => e.nombre_corto === 'la_fe') ?? empresas[0];
      onChange([
        {
          empresa_id: laFe.id,
          monto_pagado: montoTotal,
          porcentaje: 100,
        },
      ]);
    }
    initializedRef.current = true;
  }, [loading, empresas, empresasAsignadas.length, montoTotal, onChange]);

  const agregarEmpresa = useCallback(
    (empresaId: string) => {
      if (empresasAsignadas.some((e) => e.empresa_id === empresaId)) return;
      // Distribuir el monto restante proporcionalmente
      const montoRestante = Math.max(
        0,
        montoTotal - empresasAsignadas.reduce((s, e) => s + e.monto_pagado, 0),
      );
      const nuevoMonto =
        empresasAsignadas.length === 0 ? montoTotal : Math.max(0, montoRestante);
      onChange([
        ...empresasAsignadas,
        {
          empresa_id: empresaId,
          monto_pagado: nuevoMonto,
          porcentaje:
            empresasAsignadas.length === 0
              ? 100
              : montoTotal > 0
                ? round2((nuevoMonto / montoTotal) * 100)
                : 0,
        },
      ]);
    },
    [empresasAsignadas, montoTotal, onChange],
  );

  const eliminarEmpresa = useCallback(
    (empresaId: string) => {
      onChange(empresasAsignadas.filter((e) => e.empresa_id !== empresaId));
    },
    [empresasAsignadas, onChange],
  );

  const actualizarMonto = useCallback(
    (empresaId: string, montoPagado: number) => {
      onChange(
        empresasAsignadas.map((e) => ({
          ...e,
          monto_pagado: Math.max(0, montoPagado),
          porcentaje: montoTotal > 0 ? round2((Math.max(0, montoPagado) / montoTotal) * 100) : 0,
        })),
      );
    },
    [empresasAsignadas, montoTotal, onChange],
  );

  const actualizarPorcentaje = useCallback(
    (empresaId: string, porcentaje: number) => {
      const p = Math.max(0, Math.min(100, porcentaje));
      onChange(
        empresasAsignadas.map((e) => ({
          ...e,
          porcentaje: round2(p),
          monto_pagado: round2((p / 100) * montoTotal),
        })),
      );
    },
    [empresasAsignadas, montoTotal, onChange],
  );

  const sumaAsignada = empresasAsignadas.reduce((s, e) => s + e.monto_pagado, 0);
  const diferencia = round2(montoTotal - sumaAsignada);
  const tieneWarning = showWarning && Math.abs(diferencia) > 0.01;

  const empresasDisponibles = empresas.filter(
    (e) => !empresasAsignadas.some((a) => a.empresa_id === e.id),
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-white/5 bg-zinc-900/30 p-3 text-[11px] text-zinc-500">
        Cargando empresas inversoras...
      </div>
    );
  }

  if (empresas.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-300">
        No hay empresas inversoras activas. Configúralas primero en la tabla{' '}
        <code className="rounded bg-amber-500/10 px-1">empresas_inversoras</code>.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        <Users className="h-3 w-3" />
        Empresas que pagaron
      </div>

      {/* Lista de empresas asignadas */}
      {empresasAsignadas.length > 0 && (
        <div className="space-y-1.5">
          {empresasAsignadas.map((asig) => {
            const emp = empresas.find((e) => e.id === asig.empresa_id);
            if (!emp) return null;
            return (
              <div
                key={asig.empresa_id}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/30 p-2"
              >
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: emp.color }}
                />
                <span className="min-w-0 flex-1 text-[11px] font-medium text-zinc-200">
                  {emp.nombre}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-zinc-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={asig.monto_pagado}
                      onChange={(e) =>
                        actualizarMonto(asig.empresa_id, Number(e.target.value) || 0)
                      }
                      className="w-20 rounded border border-white/10 bg-zinc-950 px-1.5 py-0.5 text-right text-[10px] tabular-nums text-zinc-200 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={asig.porcentaje}
                      onChange={(e) =>
                        actualizarPorcentaje(asig.empresa_id, Number(e.target.value) || 0)
                      }
                      className="w-14 rounded border border-white/10 bg-zinc-950 px-1.5 py-0.5 text-right text-[10px] tabular-nums text-zinc-200 outline-none focus:border-amber-500/50"
                    />
                    <span className="text-[9px] text-zinc-500">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarEmpresa(asig.empresa_id)}
                    className="rounded p-0.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                    aria-label={`Quitar ${emp.nombre}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selector para agregar más empresas */}
      {empresasDisponibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Building2 className="h-3 w-3 text-zinc-500" />
          <span className="text-[10px] text-zinc-500">Agregar:</span>
          {empresasDisponibles.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => agregarEmpresa(emp.id)}
              className="flex items-center gap-1 rounded border border-white/10 bg-zinc-900/40 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: emp.color }}
              />
              {emp.nombre}
              <Plus className="h-2.5 w-2.5" />
            </button>
          ))}
        </div>
      )}

      {/* Warning si la suma no coincide */}
      {tieneWarning && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-300">
          <span className="font-bold">⚠</span>
          <span>
            La suma asignada es{' '}
            <span className="font-bold tabular-nums">${sumaAsignada.toFixed(2)}</span>, pero
            el total del gasto es{' '}
            <span className="font-bold tabular-nums">${montoTotal.toFixed(2)}</span>.
            {diferencia > 0 ? (
              <> Faltan{' '}
              <span className="font-bold tabular-nums">${diferencia.toFixed(2)}</span> por asignar.</>
            ) : (
              <> Sobran{' '}
              <span className="font-bold tabular-nums">${Math.abs(diferencia).toFixed(2)}</span>.</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
