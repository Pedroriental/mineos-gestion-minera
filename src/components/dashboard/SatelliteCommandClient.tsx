'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, AlertTriangle, ArrowRight, Cog, Server,
  Activity, BatteryCharging, ShieldAlert, CircleDot, Percent, Pickaxe,
  Layers, Navigation,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────
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
}

// ── Sparkline Generator ───────────────────────────────────────
// Usar un seed basado en el ID garantiza que los datos sean estables
// mientras no cambie la entidad seleccionada.
function generateSparkline(base: number, seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: 24 }).map((_, i) => ({
    time: i,
    value: Math.max(0, base + (((hash * (i + 7)) % 41) - 20)),
  }));
}

// ── Main Component ────────────────────────────────────────────
export default function SatelliteCommandClient({
  locations,
  globalData,
}: {
  locations: LocationData[];
  globalData: GlobalData;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedId),
    [locations, selectedId]
  );

  const chartData = useMemo(() => {
    if (!selectedLocation) return [];
    return generateSparkline(selectedLocation.kpis.produccion, selectedLocation.id);
  }, [selectedLocation?.id]);

  const filteredLocations = useMemo(
    () => locations.filter((loc) => loc.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [locations, searchQuery]
  );

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setSelectedId(null);
  };

  return (
    <div
      className="relative h-[calc(100vh-80px)] w-full overflow-hidden font-sans"
      onClick={handleContainerClick}
    >
      {/* ── 1. Fondo Satelital Oscuro ──────────────────────────── */}
      {/* Imagen real de terreno/satélite desde Unsplash */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1618401479427-c8ef9465fbe1?q=80&w=2000&auto=format&fit=crop')",
        }}
      />
      {/* Capa oscura encima para contraste de los marcadores */}
      <div className="absolute inset-0 bg-black/72 pointer-events-none" />
      {/* Tinte de color verde topográfico muy sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(20,40,20,0.35),transparent)] pointer-events-none" />

      {/* ── 2. Top Floating Bar ──────────────────────────────────── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4">
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-full flex items-center px-5 py-3">
          <Search className="w-5 h-5 text-amber-500 mr-3 flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscador Mineos: Verticales, Molinos, Disparos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-white placeholder-zinc-500 w-full text-sm font-medium tracking-wide"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="ml-2 text-zinc-500 hover:text-white text-xs">✕</button>
          )}
        </div>
      </div>

      {/* ── 3. Marcadores Topográficos ───────────────────────────── */}
      {filteredLocations.map((loc) => (
        <div
          key={loc.id}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
          style={{ top: `${loc.coordinates.y}%`, left: `${loc.coordinates.x}%` }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(loc.id === selectedId ? null : loc.id);
          }}
        >
          {/* Label flotante sobre el punto */}
          <div
            className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 shadow-xl transition-all duration-200 pointer-events-none
              ${selectedId === loc.id ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'}`}
          >
            <span className="text-white text-[11px] font-bold">{loc.name}</span>
          </div>

          {/* Punto */}
          <div className="relative">
            {loc.status === 'Activo' && (
              <div className="absolute inset-0 w-4 h-4 bg-amber-500 rounded-full animate-ping opacity-60" />
            )}
            <div
              className={`w-4 h-4 rounded-full border-2 border-zinc-950 shadow-lg transition-transform duration-200
                ${selectedId === loc.id ? 'scale-[1.75]' : 'scale-100 group-hover:scale-125'}
                ${loc.status === 'Activo'
                  ? 'bg-amber-500 shadow-[0_0_16px_rgba(218,165,32,0.9)]'
                  : loc.status === 'Mantenimiento'
                  ? 'bg-yellow-500 shadow-[0_0_16px_rgba(234,179,8,0.8)] animate-pulse'
                  : 'bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.8)]'
                }`}
            />
          </div>
        </div>
      ))}

      {/* ── 4. Modal iOS Glass ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {selectedLocation && (
          <motion.div
            key={selectedLocation.id}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="absolute z-30 w-[22rem]"
            style={{
              // Posicionamiento inteligente (no se sale de pantalla)
              top: `${Math.min(selectedLocation.coordinates.y, 58)}%`,
              ...(selectedLocation.coordinates.x > 65
                ? { right: `${100 - selectedLocation.coordinates.x + 2}%` }
                : { left: `${selectedLocation.coordinates.x}%`, marginLeft: '1.5rem' }),
              marginTop: '-4rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden p-6 flex flex-col gap-4">

              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-bold text-base leading-tight flex items-center gap-2">
                    <Cog className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    {selectedLocation.name}
                  </h3>
                  <p className="text-zinc-500 text-[10px] tracking-wider uppercase mt-0.5">
                    Complejo Minero La Fe · {selectedLocation.type === 'molino' ? 'Planta' : 'Mina'}
                  </p>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border flex-shrink-0
                    ${selectedLocation.status === 'Activo'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : selectedLocation.status === 'Mantenimiento'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'}`}
                >
                  {selectedLocation.status}
                </div>
              </div>

              {/* KPIs Grid */}
              <div className="grid grid-cols-3 gap-2 bg-white/[0.04] p-3 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CircleDot className="w-3 h-3 text-amber-500" /> Au Producción
                  </span>
                  <span className="text-white font-bold text-sm">
                    {selectedLocation.kpis.produccion.toLocaleString()}
                    <span className="text-[10px] text-zinc-500 font-normal ml-0.5">g</span>
                  </span>
                </div>
                <div className="flex flex-col border-l border-white/5 pl-2">
                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Pickaxe className="w-3 h-3 text-blue-400" /> Tenor
                  </span>
                  <span className="text-white font-bold text-sm">
                    {selectedLocation.kpis.tenor}
                    <span className="text-[10px] text-zinc-500 font-normal ml-0.5">g/t</span>
                  </span>
                </div>
                <div className="flex flex-col border-l border-white/5 pl-2">
                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Percent className="w-3 h-3 text-emerald-400" /> Merma
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold text-sm ${selectedLocation.kpis.merma > 60 ? 'text-red-400' : 'text-white'}`}>
                      {selectedLocation.kpis.merma}%
                    </span>
                    {selectedLocation.kpis.merma > 60 && (
                      <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* Mini Sparkline */}
              <div className="h-12 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`grad-${selectedLocation.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DAA520" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#DAA520" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#DAA520"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={`url(#grad-${selectedLocation.id})`}
                      isAnimationActive={false}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Material y Origen (si existen) */}
              {((selectedLocation.materiales && selectedLocation.materiales.length > 0) ||
                (selectedLocation.origenes && selectedLocation.origenes.length > 0)) && (
                <div className="border-t border-white/5 pt-3 space-y-1.5">
                  {selectedLocation.materiales && selectedLocation.materiales.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Layers className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-zinc-500 text-[9px] uppercase tracking-wider">Material</span>
                        <p className="text-zinc-300 text-xs font-medium">
                          {selectedLocation.materiales.join(' · ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedLocation.origenes && selectedLocation.origenes.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Navigation className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-zinc-500 text-[9px] uppercase tracking-wider">Origen</span>
                        <p className="text-zinc-300 text-xs font-medium">
                          {selectedLocation.origenes.join(' · ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Action */}
              <Link href="/planta/produccion">
                <button className="w-full bg-zinc-800/80 hover:bg-zinc-700 text-white text-sm font-semibold rounded-xl py-3 transition-colors flex items-center justify-center gap-2 group border border-zinc-700/40 shadow-inner">
                  Ver Detalles Técnicos
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-amber-500" />
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. Bottom Cards ──────────────────────────────────────── */}
      <div className="absolute bottom-8 left-8 right-8 z-10 pointer-events-none">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">

          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between pointer-events-auto">
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

          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Flota Activa</p>
              <p className="text-white font-bold text-2xl">
                {globalData.eqTotal}
                <span className="text-sm font-normal text-zinc-500 ml-1">Equipos</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between pointer-events-auto">
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

          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between pointer-events-auto">
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
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center border
                ${globalData.notifications?.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/20'}`}
            >
              <ShieldAlert className={`w-5 h-5 ${globalData.notifications?.length > 0 ? 'text-red-400' : 'text-green-400'}`} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
