'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, AlertTriangle, ArrowRight, X,
  CircleDot, Percent, Pickaxe, Layers, Navigation,
  Flame, Server, BatteryCharging, ShieldAlert,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

// ── Dynamic import — NO SSR (Three.js requires browser) ──────
const TacticalBackground = dynamic(
  () => import('./TacticalBackground'),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[#050505]" /> }
);

// ── Types ─────────────────────────────────────────────────────
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

// ── Clip-path style for sci-fi panels ────────────────────────
const CLIP_PANEL = {
  clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
};

// ── Status helpers ────────────────────────────────────────────
function statusDotColor(status: LocationData['status']) {
  if (status === 'Activo')        return 'bg-amber-500';
  if (status === 'Mantenimiento') return 'bg-yellow-400';
  return 'bg-zinc-500';
}
function statusRingColor(status: LocationData['status']) {
  if (status === 'Activo')        return 'border-amber-500/50';
  if (status === 'Mantenimiento') return 'border-yellow-400/50';
  return 'border-zinc-600/30';
}
function statusBadge(status: LocationData['status']) {
  if (status === 'Activo')        return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
  if (status === 'Mantenimiento') return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5';
  return 'text-zinc-500 border-zinc-700/30 bg-zinc-900/50';
}

// ════════════════════════════════════════════════════════════════
// RADAR MARKER — Framer Motion blip with cyberpunk callout label
// ════════════════════════════════════════════════════════════════
interface MarkerProps {
  loc: LocationData;
  isSelected: boolean;
  onClick: (id: string) => void;
}

const Marker = memo(function Marker({ loc, isSelected, onClick }: MarkerProps) {
  const dot   = statusDotColor(loc.status);
  const ring  = statusRingColor(loc.status);
  const labelRight = loc.coordinates.x < 58;

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-crosshair"
      style={{ top: `${loc.coordinates.y}%`, left: `${loc.coordinates.x}%` }}
      onClick={() => onClick(loc.id)}
    >
      <div className="flex items-center gap-0">

        {/* Label LEFT side (when node is on right half) */}
        {!labelRight && (
          <div className="flex items-center mr-1.5">
            <div className="bg-black/80 backdrop-blur-md border-l-2 border-amber-500 pl-2 pr-3 py-1 shadow-xl">
              <span className="font-mono text-[10px] uppercase text-zinc-300 tracking-[0.2em] whitespace-nowrap">
                {loc.name}
              </span>
            </div>
            <div className="w-4 h-[1px] bg-amber-500/40" />
          </div>
        )}

        {/* Core blip */}
        <div className="relative flex items-center justify-center w-6 h-6 flex-shrink-0">
          {/* Outer pulse ring */}
          {loc.status === 'Activo' && (
            <motion.div
              className={`absolute w-6 h-6 rounded-full border ${ring}`}
              animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            />
          )}
          {/* Secondary slow ring */}
          <motion.div
            className={`absolute w-4 h-4 rounded-full border ${ring}`}
            animate={isSelected ? { scale: [1, 1.4, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
          {/* Center dot */}
          <motion.div
            className={`w-2 h-2 rounded-full ${dot} z-10`}
            animate={isSelected ? { scale: [1, 1.3, 1] } : {}}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        </div>

        {/* Label RIGHT side */}
        {labelRight && (
          <div className="flex items-center ml-1.5">
            <div className="w-4 h-[1px] bg-amber-500/40" />
            <div className="bg-black/80 backdrop-blur-md border-l-2 border-amber-500 pl-2 pr-3 py-1 shadow-xl">
              <span className="font-mono text-[10px] uppercase text-zinc-300 tracking-[0.2em] whitespace-nowrap">
                {loc.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ════════════════════════════════════════════════════════════════
// KPI ROW
// ════════════════════════════════════════════════════════════════
function KpiRow({ label, value, unit, alert }: {
  label: string; value: string | number; unit?: string; alert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      <span
        className={`font-mono text-[13px] ${alert ? 'text-red-400' : 'text-zinc-100'}`}
        style={alert ? undefined : { textShadow: '0 0 8px rgba(218,165,32,0.2)' }}
      >
        {value}
        {unit && <span className="text-zinc-600 ml-0.5 text-[9px]">{unit}</span>}
        {alert && <AlertTriangle className="w-2.5 h-2.5 text-red-500 inline ml-1 animate-pulse" />}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TACTICAL MODAL
// ════════════════════════════════════════════════════════════════
function TacticalModal({ loc, allLocations, onClose }: {
  loc: LocationData;
  allLocations: LocationData[];
  onClose: () => void;
}) {
  const chartData = useMemo(() => generateSparkline(loc.kpis.produccion, loc.id), [loc.id]);

  const fuseMatch   = loc.name.match(/^Molino\s+([\d][-\d]+)$/i);
  const fuseNumbers = fuseMatch ? fuseMatch[1].split('-') : [];
  const fusedBases  = fuseNumbers.length >= 2
    ? fuseNumbers.map((n) => allLocations.find((l) => l.name === `Molino ${n}`)).filter(Boolean) as LocationData[]
    : [];
  const isFused = fusedBases.length >= 2;

  return (
    <div
      className="bg-zinc-950/90 backdrop-blur-3xl border-t border-amber-500/30 shadow-[0_-4px_15px_rgba(218,165,32,0.1)] w-[21rem] overflow-hidden"
      style={CLIP_PANEL}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.25em] text-zinc-600">// Nodo Táctico</p>
          <h3 className="font-mono text-[13px] text-zinc-100 mt-0.5 flex items-center gap-2"
              style={{ textShadow: '0 0 10px rgba(218,165,32,0.3)' }}>
            {loc.name.toUpperCase()}
            {isFused && (
              <span className="text-[8px] font-mono tracking-wider text-amber-500/70 border border-amber-500/20 px-1.5 py-0.5">
                FUSIONADO
              </span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 border ${statusBadge(loc.status)}`}>
            {loc.status}
          </span>
          <button onClick={onClose} className="text-zinc-600 hover:text-amber-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4">
        {isFused ? (
          <>
            <KpiRow label="Au Total (Combinado)" value={loc.kpis.produccion.toLocaleString()} unit="g" />
            <KpiRow label="Tenor Promedio"        value={loc.kpis.tenor}                       unit="g/t" />
            <KpiRow label="Merma"                 value={`${loc.kpis.merma}%`}                 alert={loc.kpis.merma > 60} />
            {fusedBases.map((base) => (
              <div key={base.id} className="border-t border-white/[0.06] mt-1 pt-1">
                <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-zinc-600 pt-1 pb-0.5">
                  {base.name.toUpperCase()}
                </p>
                <KpiRow label="Au"     value={base.kpis.produccion.toLocaleString()} unit="g" />
                <KpiRow label="Tenor"  value={base.kpis.tenor}                       unit="g/t" />
                <KpiRow label="Merma"  value={`${base.kpis.merma}%`}                 alert={base.kpis.merma > 60} />
              </div>
            ))}
          </>
        ) : (
          <>
            <KpiRow label="Au Total" value={loc.kpis.produccion.toLocaleString()} unit="g" />
            <KpiRow label="Tenor"    value={loc.kpis.tenor}                       unit="g/t" />
            <KpiRow label="Merma"    value={`${loc.kpis.merma}%`}                 alert={loc.kpis.merma > 60} />
          </>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-10 px-4 pb-1 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`hud-${loc.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={1}
              fillOpacity={1} fill={`url(#hud-${loc.id})`}
              isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Materiales / Orígenes */}
      {((loc.materiales?.length ?? 0) > 0 || (loc.origenes?.length ?? 0) > 0) && (
        <div className="px-4 pb-3 border-t border-white/[0.04] pt-3 space-y-2">
          {(loc.materiales?.length ?? 0) > 0 && (
            <div>
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-600 block mb-0.5">Materiales</span>
              <span className="font-mono text-[10px] text-zinc-400">{loc.materiales!.join(' · ')}</span>
            </div>
          )}
          {(loc.origenes?.length ?? 0) > 0 && (
            <div>
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-600 block mb-0.5">Orígenes</span>
              <span className="font-mono text-[10px] text-zinc-400">{loc.origenes!.join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="border-t border-white/[0.04] px-4 py-3">
        <Link href="/planta/produccion">
          <button className="w-full flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-amber-400 transition-colors group">
            <span>// Detalles Técnicos</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </Link>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// BOTTOM HUD CARD — clip-path sci-fi panel
// ════════════════════════════════════════════════════════════════
function HudCard({ label, metric, unit, icon, alert }: {
  label: string;
  metric: string | number;
  unit?: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div
      className="bg-zinc-950/90 backdrop-blur-3xl border-t border-amber-500/30 shadow-[0_-4px_15px_rgba(218,165,32,0.08)] p-4 flex items-center justify-between"
      style={CLIP_PANEL}
    >
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-1">
          {label}
        </p>
        <p
          className={`font-mono text-xl ${alert ? 'text-red-400' : 'text-white'}`}
          style={{ textShadow: alert ? undefined : '0 0 12px rgba(218,165,32,0.25)' }}
        >
          {metric}
          {unit && <span className="text-[10px] font-normal text-zinc-600 ml-1">{unit}</span>}
        </p>
      </div>
      <div className="text-zinc-700 border border-zinc-800 p-2">
        {icon}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function SatelliteCommandClient({
  locations,
  globalData,
}: {
  locations: LocationData[];
  globalData: GlobalData;
}) {
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
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

  const modalStyle = useMemo((): React.CSSProperties => {
    if (!selectedLocation) return {};
    const x = selectedLocation.coordinates.x;
    const y = selectedLocation.coordinates.y;
    const style: React.CSSProperties = {
      top: `${Math.min(Math.max(y, 8), 52)}%`,
      marginTop: '-3.5rem',
    };
    if (x > 58) { style.right = `${Math.max(100 - x + 2, 3)}%`; }
    else         { style.left = `${x}%`; style.marginLeft = '2rem'; }
    return style;
  }, [selectedLocation]);

  return (
    <div className="relative h-[calc(100vh-56px)] w-full overflow-hidden select-none font-sans bg-[#050505]">

      {/* ── THREE.JS 3D GRID BACKGROUND ── */}
      {/* Wrapper con dimensiones explícitas — Canvas NUNCA colapsa a 0px */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden bg-[#050505]">
        <TacticalBackground />
      </div>

      {/* Amber center glow — makes node cluster pop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,rgba(218,165,32,0.04),transparent)] pointer-events-none z-[1]" />
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(5,5,5,0.85)_100%)] pointer-events-none z-[1]" />

      {/* Click-outside to close */}
      {selectedId && (
        <div className="absolute inset-0 z-20" onClick={handleClose} />
      )}

      {/* ── SEARCH BAR ── */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
        <div
          className="bg-zinc-950/90 backdrop-blur-3xl border-t border-amber-500/20 flex items-center px-4 py-2.5 gap-3"
          style={CLIP_PANEL}
        >
          <Search className="w-3 h-3 text-amber-500/70 flex-shrink-0" />
          <input
            type="text"
            placeholder="// BUSCAR NODO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-zinc-300 placeholder-zinc-700 w-full text-[10px] font-mono uppercase tracking-[0.15em]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-600 hover:text-amber-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── MARKERS (z-10, above canvas z-0) ── */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {filteredLocations.map((loc) => (
          <div key={loc.id} className="pointer-events-auto">
            <Marker
              loc={loc}
              isSelected={selectedId === loc.id}
              onClick={handleMarkerClick}
            />
          </div>
        ))}
      </div>

      {/* ── MODAL ── */}
      <AnimatePresence mode="wait">
        {selectedLocation && (
          <motion.div
            key={selectedLocation.id}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute z-30"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <TacticalModal
              loc={selectedLocation}
              allLocations={locations}
              onClose={handleClose}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM HUD CARDS ── */}
      <div className="absolute bottom-5 left-5 right-5 z-10 pointer-events-none">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="pointer-events-auto">
            <HudCard
              label="// Oro Total"
              metric={globalData.totalGrams.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              unit="g Au"
              icon={<Server className="w-4 h-4" />}
            />
          </div>
          <div className="pointer-events-auto">
            <HudCard
              label="// Balance Plancha 1"
              metric={globalData.balancePlancha1.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              unit="g Au"
              icon={<Flame className="w-4 h-4" />}
            />
          </div>
          <div className="pointer-events-auto">
            <HudCard
              label="// Consumo Diario"
              metric={`$${globalData.todayExpenses.toLocaleString()}`}
              icon={<BatteryCharging className="w-4 h-4" />}
            />
          </div>
          <div className="pointer-events-auto">
            <HudCard
              label="// Estado Sistemas"
              metric={globalData.notifications?.length > 0 ? globalData.notifications[0].title : 'NOMINAL'}
              icon={<ShieldAlert className="w-4 h-4" />}
              alert={globalData.notifications?.length > 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
