'use client';

import { useState, useEffect } from 'react';
import { Loader2, Users, Lock, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import { getCiclosActivos, getDetalleCiclo } from '@/lib/actions/nomina-ciclos';
import { etiquetaColumnaCiclo, rolSemanaPorPosicion, totalSemanasPerfil } from '@/lib/nomina/perfil-ciclo-reglas';
import type {
  NominaCiclo,
  DetalleCicloCompleto,
  Personal,
  PerfilCompensacion,
} from '@/lib/types';
import type { InstanciaActivaSerialized } from '@/lib/rotacion-plantillas/instancia-serialize';

interface NominaCiclosTableProps {
  area: string;
  canEdit: boolean;
  instanciaActiva?: InstanciaActivaSerialized | null;
  onGoPlantillas?: () => void;
  /** Dentro de NominaCiclosView — sin banners duplicados */
  embedded?: boolean;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

const AVATAR_COLORS = [
  'bg-cyan-600', 'bg-amber-600', 'bg-emerald-600', 'bg-violet-600',
  'bg-pink-600', 'bg-blue-600', 'bg-yellow-600', 'bg-red-600',
  'bg-teal-600', 'bg-indigo-600', 'bg-orange-600', 'bg-lime-600',
];

function getAvatarColor(cargo: string): string {
  const c = (cargo || '').toUpperCase();
  if (c.includes('ADMIN')) return 'bg-rose-600 border border-rose-500/30';
  if (c.includes('MINA') || c.includes('MINER') || c.includes('PERFOR') || c.includes('PALA')) return 'bg-amber-600 border border-amber-500/30';
  if (c.includes('PLANT') || c.includes('MOLIN') || c.includes('OPERAD')) return 'bg-emerald-600 border border-emerald-500/30';
  if (c.includes('SEGURID') || c.includes('VIGILAN') || c.includes('SEREN')) return 'bg-blue-600 border border-blue-500/30';
  if (c.includes('MECANIC') || c.includes('ELECTRI') || c.includes('MANTEN')) return 'bg-violet-600 border border-violet-500/30';
  if (c.includes('CHOFER') || c.includes('TRANSPORT') || c.includes('VOLQUE')) return 'bg-pink-600 border border-pink-500/30';
  if (c.includes('COCIN') || c.includes('LIMPIEZ')) return 'bg-teal-600 border border-teal-500/30';
  
  let hash = 0;
  for (let i = 0; i < c.length; i++) {
    hash = c.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-cyan-600', 'bg-violet-600', 'bg-fuchsia-600', 'bg-indigo-600',
    'bg-rose-600', 'bg-sky-600', 'bg-purple-600', 'bg-slate-600'
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function getCargoTheme(cargo: string): { bg: string; text: string; border: string } {
  const c = cargo.toUpperCase();
  if (c.includes('VERTICAL 1PD') || c.includes('V1PD')) {
    return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25' };
  }
  if (c.includes('VERTICAL 1') || c.includes('V1')) {
    return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25' };
  }
  if (c.includes('VERTICAL 2') || c.includes('V2')) {
    return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/25' };
  }
  if (c.includes('VERTICAL 3') || c.includes('V3')) {
    return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25' };
  }
  if (c.includes('COCIN')) {
    return { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/25' };
  }
  if (c.includes('TÉCNICO') || c.includes('TECNICO')) {
    return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25' };
  }
  return { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/25' };
}

export default function NominaCiclosTable({
  area,
  canEdit,
  instanciaActiva = null,
  onGoPlantillas,
  embedded = false,
}: NominaCiclosTableProps) {
  const [ciclos, setCiclos] = useState<NominaCiclo[]>([]);
  const [selectedCiclo, setSelectedCiclo] = useState<NominaCiclo | null>(null);
  const [detalle, setDetalle] = useState<DetalleCicloCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCiclos();
  }, [area]);

  async function loadCiclos() {
    setLoading(true);
    setError(null);
    const result = await getCiclosActivos(area);
    if (result.ok && result.data) {
      setCiclos(result.data);
      if (result.data.length > 0) {
        setSelectedCiclo(result.data[0]);
      }
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (selectedCiclo) {
      loadDetalle(selectedCiclo.id);
    }
  }, [selectedCiclo]);

  async function loadDetalle(cicloId: string) {
    setLoadingDetalle(true);
    const result = await getDetalleCiclo(cicloId);
    if (result.ok && result.data) {
      setDetalle(result.data);
    } else {
      setError(result.message);
    }
    setLoadingDetalle(false);
  }

  if (loading) {
    return (
      <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl p-20 text-center flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="text-sm text-white/50 font-medium">Cargando ciclos de nómina...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-400 font-medium">{error}</p>
      </div>
    );
  }

  if (ciclos.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {!embedded && instanciaActiva && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-amber-100/85">
            <p className="font-bold text-amber-200">
              Rotación por plantilla activa: {instanciaActiva.plantillaNombre}
            </p>
            <p className="mt-1 text-[11px] text-white/45">
              Los trabajadores asignados a la plantilla operativa ya no usan el ciclo legacy de 21 días.
              Consulte la pestaña Plantillas Rotación para cuadrillas y posiciones actuales.
              {onGoPlantillas && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onGoPlantillas}
                    className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200"
                  >
                    Ir a plantillas
                  </button>
                </>
              )}
            </p>
          </div>
        )}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <Calendar className="mx-auto mb-3 h-12 w-12 text-white/20" />
          <p className="text-sm text-white/40">No hay ciclos legacy activos en esta área.</p>
          <p className="mt-2 text-xs text-white/30">
            Los ciclos 21 días aplican a operarios con perfil de compensación sin plantilla operativa.
          </p>
        </div>
      </div>
    );
  }

  const perfilCiclo = detalle?.perfil_compensacion ?? selectedCiclo?.perfil_compensacion ?? null;
  const esquemaCiclo = perfilCiclo?.esquema_rotacion_default ?? 'MINA_2X1';
  const totalSemanasCiclo = perfilCiclo ? totalSemanasPerfil(perfilCiclo) : 3;
  // Rol de cada posición desde las reglas centrales (misma fuente que el pago)
  const columnasCiclo = Array.from({ length: totalSemanasCiclo }, (_, posicion) => ({
    posicion,
    label: etiquetaColumnaCiclo(esquemaCiclo, posicion),
    rol: rolSemanaPorPosicion(esquemaCiclo, posicion, perfilCiclo ?? undefined),
  }));

  // Agrupar trabajadores por grupo_turno o vertical_asignada
  type TrabajadorCiclo = NonNullable<DetalleCicloCompleto['trabajadores']>[number];
  const groupedTrabajadores: Record<string, TrabajadorCiclo[]> = {};
  if (detalle?.trabajadores) {
    for (const trab of detalle.trabajadores) {
      const grupo = trab.personal.grupo_turno || trab.personal.vertical_asignada || trab.personal.cargo;
      if (!groupedTrabajadores[grupo]) {
        groupedTrabajadores[grupo] = [];
      }
      groupedTrabajadores[grupo].push(trab);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!embedded && instanciaActiva && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs">
          <p className="font-bold text-cyan-200">
            Sistema unificado: plantilla &quot;{instanciaActiva.plantillaNombre}&quot; en operación
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            Trabajadores con <code className="text-white/55">rotacion_plantilla_id</code> siguen la
            plantilla (pestaña Nómina semanal / Plantillas). Esta vista de ciclo 21 días muestra solo
            quienes aún dependen de perfiles legacy.
            {instanciaActiva.periodoOperativo
              ? ` Periodo operativo: ${instanciaActiva.periodoOperativo.label}.`
              : ''}
            {onGoPlantillas && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={onGoPlantillas}
                  className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
                >
                  Ver plantillas
                </button>
              </>
            )}
          </p>
        </div>
      )}
      {/* Selector de Ciclo */}
      {ciclos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {ciclos.map((ciclo) => (
            <button
              key={ciclo.id}
              onClick={() => setSelectedCiclo(ciclo)}
              className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${
                selectedCiclo?.id === ciclo.id
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'bg-zinc-950/40 border-zinc-800 text-white/60 hover:border-zinc-700'
              }`}
            >
              {ciclo.label}
            </button>
          ))}
        </div>
      )}

      {/* Info del Ciclo */}
      {selectedCiclo && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-400">{selectedCiclo.label}</p>
            <p className="text-[10px] text-white/50 mt-0.5">
              {fmtDate(selectedCiclo.fecha_inicio)} – {fmtDate(selectedCiclo.fecha_fin)} · {selectedCiclo.total_trabajadores} trabajadores
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black tabular-nums text-amber-500">{fmtMoney(selectedCiclo.total_ciclo_usd)}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Total Ciclo</p>
          </div>
        </div>
      )}

      {/* Tabla de Ciclos */}
      {loadingDetalle ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/50">Cargando detalle del ciclo...</p>
        </div>
      ) : (
        Object.entries(groupedTrabajadores).map(([grupo, trabajadores]) => {
          const theme = getCargoTheme(grupo);
          const grupoTotal = trabajadores.reduce((s, t) => s + t.total_ciclo, 0);

          return (
            <div key={grupo} className="shrink-0 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 shadow-sm">
              {/* Group Header */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 lg:gap-2 lg:px-5 lg:py-3.5">
                <div className="flex min-w-0 items-center gap-2 lg:gap-3">
                  <div className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider lg:px-3 lg:py-1 lg:text-[10px] ${theme.bg} ${theme.text} ${theme.border}`}>
                    {grupo}
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 lg:text-[10px]">
                    {trabajadores.length} trab.
                  </span>
                  {selectedCiclo?.estado === 'CERRADO' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[8px] font-bold uppercase tracking-wider">
                      <Lock className="w-2.5 h-2.5" /> Cerrado
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-500 lg:text-sm">
                  Subtotal {fmtMoney(grupoTotal)}
                </span>
              </div>

              {/* Table */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                      <th className="px-5 py-3">Trabajador</th>
                      {columnasCiclo.map((col) => (
                        <th key={col.posicion} className="px-5 py-3 text-right">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-5 py-3 text-center">Bonos/Status</th>
                      <th className="px-5 py-3 text-right text-amber-500">Total Ciclo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850/40">
                    {trabajadores.map((trab) => {
                      const p = trab.personal;
                      const avatarColor = getAvatarColor(p.cargo);
                      const initials = getInitials(p.nombre_completo);

                      const montosPorPosicion = columnasCiclo.map((col) =>
                        trab.registros.find((r) => r?.ciclo_semana?.posicion_en_ciclo === col.posicion),
                      );

                      const statusBadges: string[] = [];
                      if (trab.registros.some(r => r?.es_finiquito)) {
                        statusBadges.push('Retirado');
                      }
                      if (trab.registros.some(r => r?.novedad_turno === 'REPOSO')) {
                        statusBadges.push('Reposo');
                      }
                      // "Libre Pagado" si alguna posición con rol libre tiene monto > 0
                      // (regla central, no asumir que la posición 0 es la libre)
                      const tieneLibrePagada = montosPorPosicion.some(
                        (reg, idx) => reg && columnasCiclo[idx].rol === 'libre' && reg.monto_pagado > 0,
                      );
                      if (tieneLibrePagada) {
                        statusBadges.push('Libre Pagado');
                      }

                      // Calcular bonos totales
                      const bonosTotal = trab.registros.reduce((s, r) => s + (r?.bonificaciones || 0) + (r?.bono_transporte_pagado || 0), 0);

                      return (
                        <tr key={p.id} className="border-b border-zinc-850/20 hover:bg-zinc-800/20 transition-colors">
                          {/* Trabajador */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                                {initials}
                              </div>
                              <div>
                                <div className="font-semibold text-white/90 text-sm leading-snug">
                                  {p.nombre_completo}
                                </div>
                                <div className="text-[10px] text-white/40 mt-0.5">{p.cedula}</div>
                              </div>
                            </div>
                          </td>

                          {montosPorPosicion.map((reg, idx) => (
                            <td
                              key={columnasCiclo[idx].posicion}
                              className={`px-5 py-3 text-right font-mono tabular-nums text-xs ${
                                columnasCiclo[idx].rol === 'libre'
                                  ? 'text-cyan-400'
                                  : columnasCiclo[idx].rol === 'no_laborada'
                                    ? 'text-red-400/80'
                                    : 'text-white/80'
                              }`}
                            >
                              {reg ? fmtMoney(reg.monto_pagado) : '—'}
                            </td>
                          ))}

                          {/* Bonos/Status */}
                          <td className="px-5 py-3 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {statusBadges.map((badge) => (
                                <span
                                  key={badge}
                                  className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase"
                                >
                                  {badge}
                                </span>
                              ))}
                              {bonosTotal > 0 && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                                  +{fmtMoney(bonosTotal)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Total Ciclo */}
                          <td className="px-5 py-3 text-right text-sm font-black tabular-nums text-amber-500">
                            {fmtMoney(trab.total_ciclo)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Subtotal Footer */}
                    <tr className="bg-zinc-950/60 border-t border-zinc-700/50">
                      <td className="px-5 py-2.5 text-[10px] font-bold text-white/50 uppercase tracking-wider" colSpan={columnasCiclo.length + 2}>
                        Subtotal {grupo}
                      </td>
                      <td className="px-5 py-2.5 text-right text-sm font-black tabular-nums text-amber-500">
                        {fmtMoney(grupoTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-1.5 p-2 lg:hidden">
                {trabajadores.map((trab) => {
                  const p = trab.personal;
                  const avatarColor = getAvatarColor(p.cargo);
                  const initials = getInitials(p.nombre_completo);

                  const montosMobile = columnasCiclo.map((col) =>
                    trab.registros.find((r) => r?.ciclo_semana?.posicion_en_ciclo === col.posicion),
                  );

                  return (
                    <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white/90">{p.nombre_completo}</p>
                            <p className="text-[10px] text-white/40">{p.cedula}</p>
                          </div>
                        </div>
                        <p className="text-sm font-black tabular-nums text-amber-500">{fmtMoney(trab.total_ciclo)}</p>
                      </div>
                      <div className="grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${columnasCiclo.length}, minmax(0, 1fr))` }}>
                        {columnasCiclo.map((col, idx) => (
                          <div key={col.posicion}>
                            <p className="text-[9px] text-white/40 uppercase">{col.label}</p>
                            <p className="text-xs font-mono text-white/80">
                              {montosMobile[idx] ? fmtMoney(montosMobile[idx]!.monto_pagado) : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between rounded-xl border border-zinc-700/50 bg-zinc-950/60 px-3 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">Subtotal {grupo}</span>
                  <span className="text-sm font-black tabular-nums text-amber-500">{fmtMoney(grupoTotal)}</span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
