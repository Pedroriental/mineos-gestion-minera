'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, AlertTriangle, ArrowRight, Cog, Wrench,
  Server, Activity, BatteryCharging, ShieldAlert,
  CircleDot, Percent, Pickaxe, Layers, Navigation, Flame, X,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

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

function generateSparkline(base: number, seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: 24 }).map((_, i) => ({
    t: i,
    v: Math.max(0, base + (((Math.abs(h) * (i + 7)) % 41) - 20)),
  }));
}

// Determines marker icon by node name
function MarkerIcon({ name, active }: { name: string; active: boolean }) {
  const isMant  = /mantenimiento/i.test(name);
  const isFused = /molino\s+\d.*[-]\d/i.test(name);
  const isCont  = /continuo/i.test(name);

  if (isMant) {
    return (
      <div className={`w-8 h-8 flex items-center justify-center rounded-xl border ${active ? 'border-yellow-400/60 bg-yellow-400/10' : 'border-yellow-400/30 bg-yellow-400/5'}`}>
        <Wrench className={`w-4 h-4 ${active ? 'text-yellow-300' : 'text-yellow-500'}`} />
      </div>
    );
  }
  if (isFused) {
    return (
      <div className={`w-10 h-8 flex items-center justify-center rounded-xl border ${active ? 'border-amber-400/70 bg-amber-400/15' : 'border-amber-500/30 bg-amber-500/5'}`}>
        <Cog className={`w-3.5 h-3.5 -mr-1 ${active ? 'text-amber-300' : 'text-amber-500'}`} />
        <Cog className={`w-4 h-4 ${active ? 'text-amber-300' : 'text-amber-500'}`} />
      </div>
    );
  }
  if (isCont) {
    return (
      <div className={`w-8 h-8 flex items-center justify-center rounded-xl border ${active ? 'border-blue-400/60 bg-blue-400/10' : 'border-blue-400/25 bg-blue-400/5'}`}>
        <Activity className={`w-4 h-4 ${active ? 'text-blue-300' : 'text-blue-500'}`} />
      </div>
    );
  }
  // Default: individual molino
  return (
    <div className={`w-8 h-8 flex items-center justify-center rounded-xl border ${active ? 'border-amber-400/80 bg-amber-400/20 shadow-[0_0_12px_rgba(218,165,32,0.5)]' : 'border-amber-500/30 bg-amber-500/8'}`}>
      <Cog className={`w-4 h-4 ${active ? 'text-amber-300 animate-spin-slow' : 'text-amber-600'}`} />
    </div>
  );
}

interface MarkerProps {
  loc: LocationData;
  isSelected: boolean;
  onClick: (id: string) => void;
}

const Marker = memo(function Marker({ loc, isSelected, onClick }: MarkerProps) {
  const statusRing =
    loc.status === 'Activo'
      ? 'ring-2 ring-amber-500/30'
      : loc.status === 'Mantenimiento'
      ? 'ring-2 ring-yellow-400/30 animate-pulse'
      : 'ring-1 ring-zinc-600/30';

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center group"
      style={{ top: `${loc.coordinates.y}%`, left: `${loc.coordinates.x}%` }}
      onClick={() => onClick(loc.id)}
    >
      {/* Ping halo for active nodes */}
      {loc.status === 'Activo' && !isSelected && (
        <div className="absolute inset-0 rounded-xl bg-amber-500/20 animate-ping pointer-events-none" />
      )}

      {/* Icon marker */}
      <div className={`relative rounded-xl transition-all duration-200 ${statusRing} ${isSelected ? 'scale-125' : 'scale-100 group-hover:scale-110'}`}>
        <MarkerIcon name={loc.name} active={isSelected || loc.status === 'Activo'} />
      </div>

      {/* Persistent label — always visible */}
      <div className="mt-1.5 px-1.5 py-0.5 bg-black/50 backdrop-blur-sm border border-white/8 rounded text-center whitespace-nowrap pointer-events-none">
        <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-zinc-400">
          {loc.name.toUpperCase()}
        </span>
      </div>
    </div>
  );
});

// ─── KPI Block ───────────────────────────────────────────────
function KpiBlock({ label, value, unit, icon, alert }: {
  label: string; value: string | number; unit?: string;
  icon: React.ReactNode; alert?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.15em] text-zinc-500">
        {icon} {label}
      </span>
      <span className={`text-lg font-bold font-sans ${alert ? 'text-red-400' : 'text-white'}`}>
        {value}
        {unit && <span className="text-[10px] font-normal text-zinc-500 ml-0.5">{unit}</span>}
        {alert && <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse inline ml-1" />}
      </span>
    </div>
  );
}

// ─── Modal Content ───────────────────────────────────────────
function ModalContent({
  loc,
  allLocations,
  onClose,
}: {
  loc: LocationData;
  allLocations: LocationData[];
  onClose: () => void;
}) {
  const chartData = useMemo(() => generateSparkline(loc.kpis.produccion, loc.id), [loc.id]);

  // Check if this is a combined node (e.g. "Molino 1-3")
  const fuseMatch = loc.name.match(/^Molino\s+([\d][-\d]+)$/i);
  const fuseNumbers = fuseMatch ? fuseMatch[1].split('-') : [];
  const fusedBases = fuseNumbers.length >= 2
    ? fuseNumbers.map((n) => allLocations.find((l) => l.name === `Molino ${n}`)).filter(Boolean) as LocationData[]
    : [];
  const isFused = fusedBases.length >= 2;

  return (
    <div className="bg-black/55 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[1.8rem] overflow-hidden p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-bold text-[15px] leading-tight flex items-center gap-2 font-sans">
            <Cog className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="truncate">{loc.name.toUpperCase()}</span>
            {isFused && (
              <span className="text-[9px] font-mono text-amber-400/70 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex-shrink-0">
                COMBINADO
              </span>
            )}
          </h3>
          <p className="text-zinc-500 text-[9px] font-mono tracking-[0.14em] uppercase mt-0.5">
            Complejo La Fe · Planta de Molienda
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase border
            ${loc.status === 'Activo' ? 'bg-green-500/15 text-green-400 border-green-500/25'
              : loc.status === 'Mantenimiento' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
              : 'bg-red-500/15 text-red-400 border-red-500/25'}`}>
            {loc.status}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIs grid */}
      {isFused ? (
        // ── FUSED: total header + per-molino breakdown ──
        <div className="space-y-3">
          {/* Total summary */}
          <div className="grid grid-cols-3 gap-2 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10">
            <KpiBlock label="Au Total" value={loc.kpis.produccion.toLocaleString()} unit="g"
              icon={<CircleDot className="w-3 h-3 text-amber-500" />} />
            <KpiBlock label="Tenor Prom" value={loc.kpis.tenor} unit="g/t"
              icon={<Pickaxe className="w-3 h-3 text-blue-400" />} />
            <KpiBlock label="Merma" value={`${loc.kpis.merma}%`}
              icon={<Percent className="w-3 h-3 text-emerald-400" />}
              alert={loc.kpis.merma > 60} />
          </div>
          {/* Individual breakdown */}
          <div className="space-y-2">
            {fusedBases.map((base) => (
              <div key={base.id} className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                  {base.name.toUpperCase()}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <KpiBlock label="Au" value={base.kpis.produccion.toLocaleString()} unit="g"
                    icon={<CircleDot className="w-2.5 h-2.5 text-amber-500" />} />
                  <KpiBlock label="Tenor" value={base.kpis.tenor} unit="g/t"
                    icon={<Pickaxe className="w-2.5 h-2.5 text-blue-400" />} />
                  <KpiBlock label="Merma" value={`${base.kpis.merma}%`}
                    icon={<Percent className="w-2.5 h-2.5 text-emerald-400" />}
                    alert={base.kpis.merma > 60} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ── SIMPLE KPIs ──
        <div className="grid grid-cols-3 gap-2 bg-white/[0.04] p-3 rounded-2xl border border-white/5">
          <KpiBlock label="Au Total" value={loc.kpis.produccion.toLocaleString()} unit="g"
            icon={<CircleDot className="w-3 h-3 text-amber-500" />} />
          <KpiBlock label="Tenor" value={loc.kpis.tenor} unit="g/t"
            icon={<Pickaxe className="w-3 h-3 text-blue-400" />} />
          <KpiBlock label="Merma" value={`${loc.kpis.merma}%`}
            icon={<Percent className="w-3 h-3 text-emerald-400" />}
            alert={loc.kpis.merma > 60} />
        </div>
      )}

      {/* Sparkline */}
      <div className="h-10 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`sg-${loc.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#DAA520" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#DAA520" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="#DAA520" strokeWidth={1.5}
              fillOpacity={1} fill={`url(#sg-${loc.id})`} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Materiales / Orígenes */}
      {((loc.materiales?.length ?? 0) > 0 || (loc.origenes?.length ?? 0) > 0) && (
        <div className="text-xs text-zinc-400 p-3 bg-black/20 rounded-xl border border-white/5 space-y-2">
          {(loc.materiales?.length ?? 0) > 0 && (
            <div className="flex items-start gap-2">
              <Layers className="w-3 h-3 text-zinc-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-zinc-600 text-[9px] font-mono uppercase tracking-wider block mb-0.5">Materiales</span>
                <span className="text-zinc-300 font-medium">{loc.materiales!.join(' · ')}</span>
              </div>
            </div>
          )}
          {(loc.origenes?.length ?? 0) > 0 && (
            <div className="flex items-start gap-2">
              <Navigation className="w-3 h-3 text-zinc-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-zinc-600 text-[9px] font-mono uppercase tracking-wider block mb-0.5">Orígenes</span>
                <span className="text-zinc-300 font-medium">{loc.origenes!.join(' · ')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <Link href="/planta/produccion">
        <button className="w-full bg-white/5 hover:bg-white/10 text-white text-[13px] font-semibold rounded-xl py-2.5 transition-colors flex items-center justify-center gap-2 group border border-white/8">
          Ver Detalles Técnicos
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-amber-500" />
        </button>
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function SatelliteCommandClient({
  locations,
  globalData,
}: {
  locations: LocationData[];
  globalData: GlobalData;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleClose = useCallback(() => setSelectedId(null), []);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedId),
    [locations, selectedId]
  );

  const filteredLocations = useMemo(
    () => locations.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [locations, searchQuery]
  );

  // Modal position clamped to viewport edges
  const modalStyle = useMemo(() => {
    if (!selectedLocation) return {};
    const x = selectedLocation.coordinates.x;
    const y = selectedLocation.coordinates.y;
    const style: React.CSSProperties = {
      top: `${Math.min(Math.max(y, 10), 52)}%`,
      marginTop: '-4rem',
    };
    if (x > 58) {
      style.right = `${Math.max(100 - x + 2, 3)}%`;
    } else {
      style.left = `${x}%`;
      style.marginLeft = '2rem';
    }
    return style;
  }, [selectedLocation]);

  return (
    <div className="relative h-[calc(100vh-56px)] w-full overflow-hidden select-none">

      {/* ── 1. TOPOGRAPHIC BACKGROUND ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat grayscale contrast-[1.5] brightness-[0.75]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2000&auto=format&fit=crop')",
        }}
      />
      {/* Radar overlay */}
      <div className="absolute inset-0 bg-zinc-950/60 mix-blend-multiply pointer-events-none" />
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(9,9,11,0.7)_100%)] pointer-events-none" />
      {/* Amber center glow for markers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_50%_47%,rgba(218,165,32,0.04),transparent)] pointer-events-none" />

      {/* Click-outside backdrop to close modal */}
      {selectedId && (
        <div
          className="absolute inset-0 z-20"
          onClick={handleClose}
        />
      )}

      {/* ── 2. TOP SEARCH BAR ── */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
        <div className="bg-black/50 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-full flex items-center px-4 py-2.5 gap-3">
          <Search className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar nodo táctico..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-white placeholder-zinc-600 w-full text-[13px] font-mono"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white text-xs flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 3. MARKERS ── */}
      {filteredLocations.map((loc) => (
        <Marker
          key={loc.id}
          loc={loc}
          isSelected={selectedId === loc.id}
          onClick={handleMarkerClick}
        />
      ))}

      {/* ── 4. CLICK-LOCKED MODAL ── */}
      <AnimatePresence mode="wait">
        {selectedLocation && (
          <motion.div
            key={selectedLocation.id}
            initial={{ opacity: 0, scale: 0.93, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-30 w-[22rem]"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalContent
              loc={selectedLocation}
              allLocations={locations}
              onClose={handleClose}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. BOTTOM KPI CARDS ── */}
      <div className="absolute bottom-6 left-6 right-6 z-10 pointer-events-none">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Oro Total */}
          <div className="bg-black/50 backdrop-blur-2xl border border-white/8 shadow-2xl rounded-[1.5rem] p-4 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-zinc-500 mb-1">Oro Total</p>
              <p className="text-white font-bold text-xl font-sans">
                {globalData.totalGrams.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span className="text-xs font-normal text-zinc-500 ml-1">g</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Server className="w-4.5 h-4.5 text-amber-500" />
            </div>
          </div>

          {/* Balance Plancha 1 */}
          <div className="bg-black/50 backdrop-blur-2xl border border-white/8 shadow-2xl rounded-[1.5rem] p-4 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-zinc-500 mb-1">Balance Plancha 1</p>
              <p className="text-white font-bold text-xl font-sans">
                {globalData.balancePlancha1.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-normal text-zinc-500 ml-1">g Au</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-600/25 flex items-center justify-center">
              <Flame className="w-4.5 h-4.5 text-amber-500" />
            </div>
          </div>

          {/* Consumo Diario */}
          <div className="bg-black/50 backdrop-blur-2xl border border-white/8 shadow-2xl rounded-[1.5rem] p-4 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-zinc-500 mb-1">Consumo Diario</p>
              <p className="text-white font-bold text-xl font-sans">
                <span className="text-xs font-normal text-zinc-500 mr-0.5">$</span>
                {globalData.todayExpenses.toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <BatteryCharging className="w-4.5 h-4.5 text-purple-400" />
            </div>
          </div>

          {/* Estado Sistemas */}
          <div className="bg-black/50 backdrop-blur-2xl border border-white/8 shadow-2xl rounded-[1.5rem] p-4 flex items-center justify-between pointer-events-auto">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-zinc-500 mb-1">Estado de Sistemas</p>
              {globalData.notifications?.length > 0 ? (
                <p className="text-red-400 font-bold text-xs leading-tight mt-1 max-w-[140px] line-clamp-2">
                  {globalData.notifications[0].title}
                </p>
              ) : (
                <p className="text-green-400 font-bold text-sm mt-1 font-sans">Operación Normal</p>
              )}
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border
              ${globalData.notifications?.length > 0 ? 'bg-red-500/10 border-red-500/25' : 'bg-green-500/10 border-green-500/20'}`}>
              <ShieldAlert className={`w-4.5 h-4.5 ${globalData.notifications?.length > 0 ? 'text-red-400' : 'text-green-400'}`} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
