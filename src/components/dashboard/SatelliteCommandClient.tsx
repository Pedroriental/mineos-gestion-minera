'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertTriangle, ArrowRight, Pickaxe, Zap, Cog, Activity, Server, BatteryCharging, ShieldAlert } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

export interface LocationData {
  id: string;
  name: string;
  type: 'molino' | 'mina';
  coordinates: { x: number; y: number };
  status: 'Activo' | 'Mantenimiento' | 'Inactivo';
  kpis: { produccion: number; tenor: number; merma: number };
}

export interface GlobalData {
  totalGrams: number;
  eqTotal: number;
  todayExpenses: number;
  notifications: any[];
}

// Sparkline Mock Data (Last 24h)
const generateSparkline = (base: number) => {
  return Array.from({ length: 24 }).map((_, i) => ({
    time: i,
    value: Math.max(0, base + (Math.random() * 40 - 20))
  }));
};

export default function SatelliteCommandClient({ locations, globalData }: { locations: LocationData[], globalData: GlobalData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const selectedLocation = useMemo(() => locations.find(l => l.id === selectedId), [locations, selectedId]);
  
  // Generar datos estables de gráfico para el modal activo
  const chartData = useMemo(() => {
    if (!selectedLocation) return [];
    return generateSparkline(selectedLocation.kpis.produccion);
  }, [selectedLocation?.id]); // Solo recalcula si cambia el ID

  const handleContainerClick = (e: React.MouseEvent) => {
    // Si hace click en el fondo (no en un punto), deseleccionamos
    if (e.target === e.currentTarget) {
      setSelectedId(null);
    }
  };

  return (
    <div 
      className="relative h-[calc(100vh-80px)] w-full overflow-hidden bg-zinc-950 font-sans"
      onClick={handleContainerClick}
    >
      {/* ── 1. Fondo Satelital (Terreno Oscuro) ── */}
      <div className="absolute inset-0 object-cover opacity-60 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black pointer-events-none" />
      
      {/* Grid line overlay to make it look like a radar/map */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '100px 100px' }} />

      {/* ── 2. Top Floating Bar (Glass Formula) ── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-full overflow-hidden flex items-center px-4 py-3">
          <Search className="w-5 h-5 text-zinc-400 mr-3 flex-shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar equipos, frentes, molinos..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-white placeholder-zinc-500 w-full text-sm font-medium"
          />
        </div>
      </div>

      {/* ── 3. Marcadores Topográficos ── */}
      {locations.filter(loc => loc.name.toLowerCase().includes(searchQuery.toLowerCase())).map((loc) => (
        <div 
          key={loc.id}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
          style={{ top: `${loc.coordinates.y}%`, left: `${loc.coordinates.x}%` }}
          onClick={(e) => {
             e.stopPropagation();
             setSelectedId(loc.id);
          }}
        >
          {/* Label de contexto (Visible solo en hover o si está seleccionado) */}
          <div className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 shadow-xl transition-all duration-300 pointer-events-none
            ${selectedId === loc.id ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'}`}>
            <span className="text-white text-xs font-bold">{loc.name}</span>
          </div>

          {/* El Punto Pulsante */}
          <div className="relative">
            {loc.status === 'Activo' && (
              <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-75 duration-1000" />
            )}
            <div className={`w-4 h-4 rounded-full border-2 border-zinc-900 transition-transform ${selectedId === loc.id ? 'scale-150' : 'scale-100 group-hover:scale-125'}
              ${loc.status === 'Mantenimiento' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-amber-500 shadow-[0_0_15px_rgba(218,165,32,0.8)] animate-pulse'}
            `} />
          </div>
        </div>
      ))}

      {/* ── 4. Hover Modal (Ventana iOS) ── */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            key={selectedLocation.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute z-30 w-80"
            style={{
               // Calculamos posición inteligente: si está muy a la derecha, lo ponemos a la izquierda, si no, a la derecha
               top: `${selectedLocation.coordinates.y}%`,
               left: selectedLocation.coordinates.x > 70 ? undefined : `${selectedLocation.coordinates.x}%`,
               right: selectedLocation.coordinates.x > 70 ? `${100 - selectedLocation.coordinates.x}%` : undefined,
               marginLeft: selectedLocation.coordinates.x > 70 ? 0 : '1.5rem',
               marginRight: selectedLocation.coordinates.x > 70 ? '1.5rem' : 0,
               marginTop: '-4rem'
            }}
            onClick={e => e.stopPropagation()} // Evitar que el clic cierre el modal
          >
            {/* Fórmula Glass Estricta */}
            <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden p-6 flex flex-col gap-5">
              
              {/* Header */}
              <div className="flex items-start justify-between">
                 <div>
                    <h3 className="text-white font-bold text-lg leading-tight flex items-center gap-2">
                      {selectedLocation.type === 'molino' ? <Cog className="w-4 h-4 text-zinc-400" /> : <Pickaxe className="w-4 h-4 text-zinc-400" />}
                      {selectedLocation.name}
                    </h3>
                    <p className="text-zinc-400 text-xs tracking-wider uppercase mt-1">ID: {selectedLocation.id.split('-')[0]}</p>
                 </div>
                 <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border
                    ${selectedLocation.status === 'Activo' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {selectedLocation.status}
                 </div>
              </div>

              {/* Body (Grid 3 cols) */}
              <div className="grid grid-cols-3 gap-3">
                 <div className="flex flex-col">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Producción</span>
                    <span className="text-white font-semibold">{selectedLocation.kpis.produccion} g/día</span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Tenor</span>
                    <span className="text-white font-semibold">{selectedLocation.kpis.tenor} g/t</span>
                 </div>
                 <div className="flex flex-col relative">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Merma</span>
                    <div className="flex items-center gap-1.5">
                       <span className={`font-semibold ${selectedLocation.kpis.merma > 60 ? 'text-red-400' : 'text-white'}`}>{selectedLocation.kpis.merma}%</span>
                       {selectedLocation.kpis.merma > 60 && <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />}
                    </div>
                 </div>
              </div>

              {/* Gráfico Sparkline (Recharts) */}
              <div className="h-16 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                       <defs>
                          <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                             <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorProd)" isAnimationActive={false} />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>

              {/* Footer Action */}
              <Link href={selectedLocation.type === 'molino' ? '/planta/produccion' : '/mina/extraccion'}>
                <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl py-3 mt-1 transition-colors flex items-center justify-center gap-2 group">
                   Ver Detalles Técnicos <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. Global Overview (Bottom Cards) ── */}
      <div className="absolute bottom-8 left-8 right-8 z-10 pointer-events-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           
           {/* Card 1: Oro Total */}
           <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden p-5 flex items-center justify-between pointer-events-auto">
              <div>
                 <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Oro Total Mensual</p>
                 <p className="text-white font-bold text-2xl">{globalData.totalGrams.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}g</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                 <Server className="w-5 h-5 text-amber-500" />
              </div>
           </div>

           {/* Card 2: Flota Activa */}
           <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden p-5 flex items-center justify-between pointer-events-auto">
              <div>
                 <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Flota Activa</p>
                 <p className="text-white font-bold text-2xl">{globalData.eqTotal} <span className="text-sm font-normal text-zinc-500">Equipos</span></p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                 <Activity className="w-5 h-5 text-blue-400" />
              </div>
           </div>

           {/* Card 3: Consumo */}
           <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden p-5 flex items-center justify-between pointer-events-auto">
              <div>
                 <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Consumo Diario (USD)</p>
                 <p className="text-white font-bold text-2xl">${globalData.todayExpenses.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                 <BatteryCharging className="w-5 h-5 text-purple-400" />
              </div>
           </div>

           {/* Card 4: Alertas */}
           <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden p-5 flex items-center justify-between pointer-events-auto">
              <div>
                 <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Alertas Anómalas</p>
                 {globalData.notifications && globalData.notifications.length > 0 ? (
                    <p className="text-red-400 font-bold text-sm leading-tight mt-1 truncate max-w-[180px]">
                      {globalData.notifications[0].title}
                    </p>
                 ) : (
                    <p className="text-green-400 font-bold text-sm mt-1">Sistemas Normales</p>
                 )}
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border 
                 ${globalData.notifications && globalData.notifications.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                 <ShieldAlert className={`w-5 h-5 ${globalData.notifications && globalData.notifications.length > 0 ? 'text-red-400' : 'text-green-400'}`} />
              </div>
           </div>

        </div>
      </div>

    </div>
  );
}
