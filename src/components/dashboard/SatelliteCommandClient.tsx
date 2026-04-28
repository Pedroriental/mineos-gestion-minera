'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, AlertTriangle, ArrowRight, Cog,
  Server, Activity, BatteryCharging, ShieldAlert,
  CircleDot, Percent, Pickaxe, Layers, Navigation, Flame,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────
export interface LocationData {
  id: string;
  name: string;
  type: 'molino' | 'mina';
  coordinates: { x: number; y: number };
  status: 'Activo' | 'Mantenimiento' | 'Inactivo';
  kpis: { produccion: number; tenor: number; merma: number };
  materiales?: string[];
  origenes?: string[];
}

export interface GlobalData {
  totalGrams: number;
  eqTotal: number;
  todayExpenses: number;
  notifications: any[];
  balancePlancha1: number;
}

// ─── Sparkline determinista (sin Math.random en renders) ──────
function generateSparkline(base: number, seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: 24 }).map((_, i) => ({
    t: i,
    v: Math.max(0, base + (((Math.abs(h) * (i + 7)) % 41) - 20)),
  }));
}

// ══════════════════════════════════════════════════════════════
// MAPA DE MARCADORES — memoizado con React.memo para que el
// hover del modal NO dispare re-renders del fondo del mapa.
// ══════════════════════════════════════════════════════════════
interface MarkerProps {
  loc: LocationData;
  isHovered: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
}

const Marker = memo(function Marker({ loc, isHovered, onEnter, onLeave }: MarkerProps) {
  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group cursor-crosshair"
      style={{ top: `${loc.coordinates.y}%`, left: `${loc.coordinates.x}%` }}
      onMouseEnter={() => onEnter(loc.id)}
      onMouseLeave={onLeave}
    >
      {/* Label flotante */}
      <div
        className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap
          px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10
          shadow-xl transition-all duration-150 pointer-events-none
          ${isHovered
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'}`}
      >
        <span className="text-white text-[11px] font-bold tracking-tight">{loc.name}</span>
      </div>

      {/* Halo de ping */}
      {loc.status === 'Activo' && (
        <div className="absolute inset-0 w-4 h-4 bg-amber-500 rounded-full animate-ping opacity-50" />
      )}

      {/* Punto principal */}
      <div
        className={`w-4 h-4 rounded-full border-2 border-zinc-950 shadow-lg transition-transform duration-150
          ${isHovered ? 'scale-[1.9]' : 'scale-100 group-hover:scale-[1.4]'}
          ${loc.status === 'Activo'
            ? 'bg-amber-500 shadow-[0_0_18px_rgba(218,165,32,0.95)]'
            : loc.status === 'Mantenimiento'
            ? 'bg-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.85)] animate-pulse'
            : 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.85)]'}`}
      />
    </div>
  );
});

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────
export default function SatelliteCommandClient({
  locations,
  globalData,
}: {
  locations: LocationData[];
  globalData: GlobalData;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Callbacks estables para no re-crear Marker en cada render
  const handleEnter = useCallback((id: string) => setHoveredId(id), []);
  const handleLeave = useCallback(() => setHoveredId(null), []);

  const hoveredLocation = useMemo(
    () => locations.find((l) => l.id === hoveredId),
    [locations, hoveredId]
  );

  const chartData = useMemo(() => {
    if (!hoveredLocation) return [];
    return generateSparkline(hoveredLocation.kpis.produccion, hoveredLocation.id);
  }, [hoveredLocation?.id]);

  const filteredLocations = useMemo(
    () => locations.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [locations, searchQuery]
  );

  return (
    <div className="relative h-[calc(100vh-80px)] w-full overflow-hidden font-sans select-none">

      {/* ── 1. FONDO SATELITAL RADAR (Dark C-Level) ──────────────── */}
      {/* Imagen aérea nocturna de terreno/ciudad con grayscale y bajo brillo */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat grayscale contrast-125 brightness-50"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1542281286-9e0a16bb7366?q=80&w=2000&auto=format&fit=crop')",
        }}
      />
      {/* Overlay zinc oscuro tipo radar nocturno */}
      <div className="absolute inset-0 bg-zinc-950/70 mix-blend-multiply pointer-events-none" />
      {/* Viñeta amber sutilísima en el centro para refuerzo de marcadores */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_46%,rgba(218,165,32,0.04),transparent)] pointer-events-none" />

      {/* ── 2. TOP FLOATING BAR ──────────────────────────────────── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4">
        <div className="bg-black/50 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-full flex items-center px-5 py-3 gap-3">
          <Search className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscador Mineos: Molinos, Combinaciones, Mantenimiento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-white placeholder-zinc-500 w-full text-sm font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white text-xs flex-shrink-0">✕</button>
          )}
        </div>
      </div>

      {/* ── 3. MARCADORES TOPOGRÁFICOS (componentes memoizados) ───── */}
      {filteredLocations.map((loc) => (
        <Marker
          key={loc.id}
          loc={loc}
          isHovered={hoveredId === loc.id}
          onEnter={handleEnter}
          onLeave={handleLeave}
        />
      ))}

      {/* ── 4. HOVER MODAL iOS GLASS ─────────────────────────────── */}
      <AnimatePresence mode="wait">
        {hoveredLocation && (
          <motion.div
            key={hoveredLocation.id}
            initial={{ opacity: 0, scale: 0.93, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-30 w-[22rem] pointer-events-none"
            style={{
              top: `${Math.min(hoveredLocation.coordinates.y, 56)}%`,
              ...(hoveredLocation.coordinates.x > 62
                ? { right: `${Math.max(100 - hoveredLocation.coordinates.x + 3, 4)}%` }
                : { left: `${hoveredLocation.coordinates.x}%`, marginLeft: '1.6rem' }),
              marginTop: '-4.5rem',
            }}
          >
            <div className="bg-black/50 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden p-6 flex flex-col gap-4">

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-base leading-tight flex items-center gap-2 truncate">
                    <Cog className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="truncate">{hoveredLocation.name}</span>
                  </h3>
                  <p className="text-zinc-500 text-[10px] tracking-wider uppercase mt-0.5">
                    Complejo La Fe · Planta de Molienda
                  </p>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border flex-shrink-0
                    ${hoveredLocation.status === 'Activo'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : hoveredLocation.status === 'Mantenimiento'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'}`}
                >
                  {hoveredLocation.status}
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2 bg-white/[0.04] p-3 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CircleDot className="w-3 h-3 text-amber-500" /> Au Total
                  </span>
                  <span className="text-white font-bold text-sm">
                    {hoveredLocation.kpis.produccion.toLocaleString()}
                    <span className="text-[10px] text-zinc-500 font-normal ml-0.5">g</span>
                  </span>
                </div>
                <div className="flex flex-col border-l border-white/5 pl-2">
                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Pickaxe className="w-3 h-3 text-blue-400" /> Tenor
                  </span>
                  <span className="text-white font-bold text-sm">
                    {hoveredLocation.kpis.tenor}
                    <span className="text-[10px] text-zinc-500 font-normal ml-0.5">g/t</span>
                  </span>
                </div>
                <div className="flex flex-col border-l border-white/5 pl-2">
                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Percent className="w-3 h-3 text-emerald-400" /> Merma
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold text-sm ${hoveredLocation.kpis.merma > 60 ? 'text-red-400' : 'text-white'}`}>
                      {hoveredLocation.kpis.merma}%
                    </span>
                    {hoveredLocation.kpis.merma > 60 && (
                      <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              <div className="h-11 w-full -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`g-${hoveredLocation.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DAA520" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#DAA520" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke="#DAA520"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={`url(#g-${hoveredLocation.id})`}
                      isAnimationActive={false}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Materiales y Orígenes */}
              {((hoveredLocation.materiales?.length ?? 0) > 0 || (hoveredLocation.origenes?.length ?? 0) > 0) && (
                <div className="text-xs text-zinc-400 p-3 bg-black/20 rounded-xl border border-white/5 space-y-2">
                  {(hoveredLocation.materiales?.length ?? 0) > 0 && (
                    <div className="flex items-start gap-2">
                      <Layers className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-zinc-600 text-[9px] uppercase tracking-wider block mb-0.5">Materiales</span>
                        <span className="text-zinc-300 font-medium">{hoveredLocation.materiales!.join(' · ')}</span>
                      </div>
                    </div>
                  )}
                  {(hoveredLocation.origenes?.length ?? 0) > 0 && (
                    <div className="flex items-start gap-2">
                      <Navigation className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-zinc-600 text-[9px] uppercase tracking-wider block mb-0.5">Orígenes</span>
                        <span className="text-zinc-300 font-medium">{hoveredLocation.origenes!.join(' · ')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <Link href="/planta/produccion" className="pointer-events-auto">
                <button className="w-full bg-zinc-800/80 hover:bg-zinc-700 text-white text-sm font-semibold rounded-xl py-3 transition-colors flex items-center justify-center gap-2 group border border-zinc-700/40">
                  Ver Detalles Técnicos
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-amber-500" />
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. BOTTOM CARDS ──────────────────────────────────────── */}
      <div className="absolute bottom-8 left-8 right-8 z-10 pointer-events-none">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">

          {/* Card 1: Oro Total */}
          <div className="bg-black/45 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Oro Total</p>
              <p className="text-white font-bold text-2xl">
                {globalData.totalGrams.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span className="text-sm font-normal text-zinc-500 ml-1">g</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Server className="w-5 h-5 text-amber-500" />
            </div>
          </div>

          {/* Card 2: Balance Plancha 1 (reemplaza Flota Activa) */}
          <div className="bg-black/45 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Balance Plancha 1</p>
              <p className="text-white font-bold text-2xl">
                {globalData.balancePlancha1.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-sm font-normal text-zinc-500 ml-1">g Au</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-600/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-amber-500" />
            </div>
          </div>

          {/* Card 3: Consumo Diario */}
          <div className="bg-black/45 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Consumo Diario</p>
              <p className="text-white font-bold text-2xl">
                <span className="text-sm font-normal text-zinc-500 mr-0.5">$</span>
                {globalData.todayExpenses.toLocaleString()}
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <BatteryCharging className="w-5 h-5 text-purple-400" />
            </div>
          </div>

          {/* Card 4: Estado de Sistemas */}
          <div className="bg-black/45 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Estado de Sistemas</p>
              {globalData.notifications?.length > 0 ? (
                <p className="text-red-400 font-bold text-xs leading-tight mt-1 max-w-[160px] line-clamp-2">
                  {globalData.notifications[0].title}
                </p>
              ) : (
                <p className="text-green-400 font-bold text-sm mt-1">Operación Normal</p>
              )}
            </div>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center border
              ${globalData.notifications?.length > 0
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-green-500/10 border-green-500/20'}`}>
              <ShieldAlert className={`w-5 h-5 ${globalData.notifications?.length > 0 ? 'text-red-400' : 'text-green-400'}`} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
