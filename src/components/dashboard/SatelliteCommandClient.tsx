'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, AlertTriangle, ArrowRight, X,
  CircleDot, Percent, Pickaxe, Layers, Navigation,
  Flame, Server, BatteryCharging, ShieldAlert,
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

// ── STATUS COLOR ─────────────────────────────────────────────
function statusColor(status: LocationData['status']) {
  if (status === 'Activo')        return { dot: 'bg-amber-500', ring: 'border-amber-500/40', line: 'bg-amber-500/40', label: 'text-amber-400' };
  if (status === 'Mantenimiento') return { dot: 'bg-yellow-400', ring: 'border-yellow-400/40', line: 'bg-yellow-400/40', label: 'text-yellow-400' };
  return { dot: 'bg-zinc-500', ring: 'border-zinc-600/30', line: 'bg-zinc-600/30', label: 'text-zinc-500' };
}

// ── RADAR MARKER ─────────────────────────────────────────────
interface MarkerProps {
  loc: LocationData;
  isSelected: boolean;
  onClick: (id: string) => void;
}

const Marker = memo(function Marker({ loc, isSelected, onClick }: MarkerProps) {
  const c = statusColor(loc.status);
  const labelRight = loc.coordinates.x < 55;

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-crosshair"
      style={{ top: `${loc.coordinates.y}%`, left: `${loc.coordinates.x}%` }}
      onClick={() => onClick(loc.id)}
    >
      <div className="relative flex items-center">
        {/* Radar pulse ring — thin, slow, NO blur/glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {loc.status === 'Activo' && (
            <div
              className={`w-5 h-5 rounded-full border ${c.ring} animate-ping absolute`}
              style={{ animationDuration: '3s' }}
            />
          )}
        </div>

        {/* Outer ring — static */}
        <div className={`relative p-[3px] rounded-full border ${c.ring} ${isSelected ? 'scale-150' : ''} transition-transform duration-200 flex-shrink-0`}>
          {/* Core dot — NO shadow */}
          <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        </div>

        {/* Callout line + label */}
        {labelRight ? (
          <>
            <div className={`w-4 h-px ${c.line} flex-shrink-0`} />
            <div className="bg-zinc-950/60 backdrop-blur-md border border-white/10 px-2 py-1 flex-shrink-0 shadow-lg rounded-sm">
              <span className={`text-[9px] font-mono uppercase tracking-wider ${c.label}`}>
                {loc.name}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="bg-zinc-950/60 backdrop-blur-md border border-white/10 px-2 py-1 flex-shrink-0 shadow-lg rounded-sm">
              <span className={`text-[9px] font-mono uppercase tracking-wider ${c.label}`}>
                {loc.name}
              </span>
            </div>
            <div className={`w-4 h-px ${c.line} flex-shrink-0`} />
          </>
        )}
      </div>
    </div>
  );
});

// ── KPI ROW ──────────────────────────────────────────────────
function KpiRow({ label, value, unit, alert }: { label: string; value: string | number; unit?: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      <span className={`font-mono text-[13px] ${alert ? 'text-red-400' : 'text-zinc-100'}`}>
        {value}
        {unit && <span className="text-zinc-600 ml-0.5 text-[9px]">{unit}</span>}
        {alert && <AlertTriangle className="w-2.5 h-2.5 text-red-500 inline ml-1 animate-pulse" />}
      </span>
    </div>
  );
}

// ── MODAL ────────────────────────────────────────────────────
function TacticalModal({ loc, allLocations, onClose }: {
  loc: LocationData;
  allLocations: LocationData[];
  onClose: () => void;
}) {
  const chartData = useMemo(() => generateSparkline(loc.kpis.produccion, loc.id), [loc.id]);

  const fuseMatch = loc.name.match(/^Molino\s+([\d][-\d]+)$/i);
  const fuseNumbers = fuseMatch ? fuseMatch[1].split('-') : [];
  const fusedBases = fuseNumbers.length >= 2
    ? fuseNumbers.map((n) => allLocations.find((l) => l.name === `Molino ${n}`)).filter(Boolean) as LocationData[]
    : [];
  const isFused = fusedBases.length >= 2;

  return (
    <div className="bg-[#080808]/80 backdrop-blur-3xl border border-white/[0.04] shadow-2xl w-[20rem] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Nodo Táctico</p>
          <h3 className="font-mono text-[13px] text-zinc-100 mt-0.5 flex items-center gap-2">
            {loc.name.toUpperCase()}
            {isFused && <span className="text-[8px] font-mono tracking-wider text-amber-500/70 bg-amber-500/8 border border-amber-500/15 px-1.5 py-0.5">FUSIONADO</span>}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 border
            ${loc.status === 'Activo' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
            : loc.status === 'Mantenimiento' ? 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5'
            : 'text-zinc-500 border-zinc-700/30'}`}>
            {loc.status}
          </span>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4">
        {isFused ? (
          <>
            <KpiRow label="Au Total (Combinado)" value={loc.kpis.produccion.toLocaleString()} unit="g" />
            <KpiRow label="Tenor Promedio" value={loc.kpis.tenor} unit="g/t" />
            <KpiRow label="Merma" value={`${loc.kpis.merma}%`} alert={loc.kpis.merma > 60} />
            {fusedBases.map((base) => (
              <div key={base.id} className="border-t border-white/[0.06] mt-1 pt-1">
                <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-zinc-600 pt-1 pb-0.5">{base.name.toUpperCase()}</p>
                <KpiRow label="Au" value={base.kpis.produccion.toLocaleString()} unit="g" />
                <KpiRow label="Tenor" value={base.kpis.tenor} unit="g/t" />
                <KpiRow label="Merma" value={`${base.kpis.merma}%`} alert={base.kpis.merma > 60} />
              </div>
            ))}
          </>
        ) : (
          <>
            <KpiRow label="Au Total" value={loc.kpis.produccion.toLocaleString()} unit="g" />
            <KpiRow label="Tenor" value={loc.kpis.tenor} unit="g/t" />
            <KpiRow label="Merma" value={`${loc.kpis.merma}%`} alert={loc.kpis.merma > 60} />
          </>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-10 px-4 pb-1 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`hud-${loc.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={1}
              fillOpacity={1} fill={`url(#hud-${loc.id})`} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Materiales / Orígenes */}
      {((loc.materiales?.length ?? 0) > 0 || (loc.origenes?.length ?? 0) > 0) && (
        <div className="px-4 pb-3 border-t border-white/[0.04] pt-3 space-y-2">
          {(loc.materiales?.length ?? 0) > 0 && (
            <div>
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-600 block mb-1">Materiales</span>
              <span className="font-mono text-[10px] text-zinc-400">{loc.materiales!.join(' · ')}</span>
            </div>
          )}
          {(loc.origenes?.length ?? 0) > 0 && (
            <div>
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-600 block mb-1">Orígenes</span>
              <span className="font-mono text-[10px] text-zinc-400">{loc.origenes!.join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="border-t border-white/[0.04] px-4 py-3">
        <Link href="/planta/produccion">
          <button className="w-full flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-amber-400 transition-colors group">
            <span>Detalles Técnicos</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </Link>
      </div>
    </div>
  );
}

// ── BOTTOM KPI CARD ──────────────────────────────────────────
function HudCard({ label, children, icon }: { label: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="bg-[#080808]/70 backdrop-blur-3xl border border-white/[0.04] shadow-2xl p-4 flex items-center justify-between">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-1">{label}</p>
        {children}
      </div>
      <div className="w-8 h-8 border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-zinc-600">
        {icon}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
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

  const modalStyle = useMemo((): React.CSSProperties => {
    if (!selectedLocation) return {};
    const x = selectedLocation.coordinates.x;
    const y = selectedLocation.coordinates.y;
    const style: React.CSSProperties = { top: `${Math.min(Math.max(y, 8), 50)}%`, marginTop: '-3rem' };
    if (x > 58) { style.right = `${Math.max(100 - x + 2, 3)}%`; }
    else { style.left = `${x}%`; style.marginLeft = '1.8rem'; }
    return style;
  }, [selectedLocation]);

  return (
    <div className="relative h-[calc(100vh-56px)] w-full overflow-hidden select-none font-sans">

      {/* ── FONDO TOPOGRÁFICO LOCAL (cantera / elevación) ── */}
      {/* Base zinc-950 garantiza que nunca haya blanco en carga */}
      <div className="absolute inset-0 bg-zinc-950" />
      {/* Textura de curvas de nivel / cantera minera, muy sutil */}
      <div
        className="absolute inset-0 bg-cover bg-center grayscale opacity-40"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1584285405072-4e6f488667a7?q=80&w=2000&auto=format&fit=crop')" }}
      />
      {/* Scan-line overlay CRT */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)' }} />
      {/* Vignette radial */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_85%_at_50%_50%,transparent_30%,rgba(9,9,11,0.8)_100%)] pointer-events-none" />

      {/* Click-outside to close */}
      {selectedId && <div className="absolute inset-0 z-20" onClick={handleClose} />}

      {/* ── SEARCH BAR ── */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
        <div className="bg-[#080808]/70 backdrop-blur-3xl border border-white/[0.06] flex items-center px-4 py-2 gap-3">
          <Search className="w-3 h-3 text-amber-500/70 flex-shrink-0" />
          <input
            type="text"
            placeholder="BUSCAR NODO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-zinc-300 placeholder-zinc-700 w-full text-[10px] font-mono uppercase tracking-[0.15em]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-600 hover:text-zinc-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── PILAR 3: RADAR MARKERS ── */}
      {filteredLocations.map((loc) => (
        <Marker key={loc.id} loc={loc} isSelected={selectedId === loc.id} onClick={handleMarkerClick} />
      ))}

      {/* ── CLICK-LOCKED MODAL ── */}
      <AnimatePresence mode="wait">
        {selectedLocation && (
          <motion.div
            key={selectedLocation.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute z-30"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <TacticalModal loc={selectedLocation} allLocations={locations} onClose={handleClose} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PILAR 4: BOTTOM HUD CARDS ── */}
      <div className="absolute bottom-5 left-5 right-5 z-10 pointer-events-none">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.03] border border-white/[0.04]">

          <HudCard label="Oro Total" icon={<Server className="w-3.5 h-3.5" />}>
            <p className="font-mono text-zinc-100 text-base">
              {globalData.totalGrams.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              <span className="text-[9px] text-zinc-600 ml-1">g Au</span>
            </p>
          </HudCard>

          <HudCard label="Balance Plancha 1" icon={<Flame className="w-3.5 h-3.5" />}>
            <p className="font-mono text-zinc-100 text-base">
              {globalData.balancePlancha1.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[9px] text-zinc-600 ml-1">g Au</span>
            </p>
          </HudCard>

          <HudCard label="Consumo Diario" icon={<BatteryCharging className="w-3.5 h-3.5" />}>
            <p className="font-mono text-zinc-100 text-base">
              <span className="text-[9px] text-zinc-600 mr-0.5">$</span>
              {globalData.todayExpenses.toLocaleString()}
            </p>
          </HudCard>

          <HudCard label="Estado de Sistemas" icon={<ShieldAlert className="w-3.5 h-3.5" />}>
            {globalData.notifications?.length > 0 ? (
              <p className="font-mono text-red-400 text-[11px] max-w-[140px] line-clamp-2">
                {globalData.notifications[0].title}
              </p>
            ) : (
              <p className="font-mono text-[11px] text-emerald-400 tracking-wider">NOMINAL</p>
            )}
          </HudCard>

        </div>
      </div>
    </div>
  );
}
