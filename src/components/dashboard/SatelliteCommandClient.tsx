'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Factory, Pickaxe, AlertCircle, ArrowRight, X,
  Layers, Wallet, ShieldAlert, Award, TrendingUp, Activity,
  ChevronRight, Sparkles, Flame, CheckCircle, BarChart3, HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip
} from 'recharts';
import Link from 'next/link';

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

// ── Helper to format numbers ──────────────────────────────────
const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ── Helper to generate clean sparklines ────────────────────────
function generateSparkline(base: number, seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: 12 }).map((_, i) => {
    const val = Math.max(0, base * 0.4 + (((Math.abs(h) * (i + 5)) % 47) / 47) * (base * 0.8));
    return {
      t: `H${i + 1}`,
      v: Math.round(val * 100) / 100,
    };
  });
}

// ── Custom Tooltip for Charts ─────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950/95 border border-zinc-800 p-2.5 rounded-lg shadow-xl backdrop-blur-md">
        <p className="text-white/40 text-[9px] font-medium tracking-wider mb-1 uppercase">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-white/80 text-[11px]">{entry.name}:</span>
            <span className="text-amber-400 font-bold text-xs">{fmtNum(entry.value)} g</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Find currently selected location
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedId),
    [locations, selectedId]
  );

  // Filter locations based on search
  const filteredLocations = useMemo(
    () => locations.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [locations, searchQuery]
  );

  // Sparkline data for selection details
  const selectedSparklineData = useMemo(() => {
    if (!selectedLocation) return [];
    return generateSparkline(selectedLocation.kpis.produccion || 100, selectedLocation.id);
  }, [selectedLocation]);

  // Chart data for operational overview (Distribution of gold across active nodes)
  const barChartData = useMemo(() => {
    return locations
      .filter(loc => loc.kpis.produccion > 0)
      .map(loc => ({
        name: loc.name,
        produccion: loc.kpis.produccion,
        status: loc.status
      }))
      .sort((a, b) => b.produccion - a.produccion);
  }, [locations]);

  return (
    <div className="w-full max-w-[1600px] mx-auto h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col overflow-hidden font-sans text-zinc-200">
      
      {/* ── Header Sección Fija ── */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-white/95 font-black tracking-tight text-2.5xl flex items-center gap-3">
            <Layers className="w-7 h-7 text-amber-500" /> Centro de Mando Gerencial
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Monitoreo en tiempo real y Business Intelligence de planta y minas.
          </p>
        </div>
      </div>

      {/* ── Fila de KPIs Globales Premium ── */}
      <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* KPI 1: Oro Total */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Oro Total</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tracking-tight">{fmtNum(globalData.totalGrams)}</span>
              <span className="text-xs text-zinc-500 font-medium">g Au</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 leading-tight">
            Acumulado total histórico en planta.
          </div>
        </div>

        {/* KPI 2: Plancha 1 */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Balance Plancha 1</span>
              <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tracking-tight">{fmtNum(globalData.balancePlancha1)}</span>
              <span className="text-xs text-zinc-500 font-medium">g Au</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 leading-tight">
            Producción en la línea principal de molinos.
          </div>
        </div>

        {/* KPI 3: Consumo Diario */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Consumo Diario</span>
              <Wallet className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tracking-tight">{fmtMoney(globalData.todayExpenses)}</span>
              <span className="text-xs text-zinc-500 font-medium">USD</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 leading-tight">
            Gastos operativos registrados el día de hoy.
          </div>
        </div>

        {/* KPI 4: Estado Operativo */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Estado Sistemas</span>
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2.5xl font-black text-emerald-400 tracking-tight">
                {globalData.notifications?.length > 0 ? 'ALERTAS' : 'NOMINAL'}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 leading-tight truncate">
            {globalData.notifications?.length > 0 ? globalData.notifications[0].title : 'Operaciones funcionando con normalidad.'}
          </div>
        </div>

      </div>

      {/* ── Split Screen Grid 12 (Área de Trabajo) ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">

        {/* ── PANEL IZQUIERDO: LISTA DE NODOS (7 columnas) ── */}
        <div className="lg:col-span-7 flex flex-col min-h-0 bg-zinc-900/40 rounded-2xl border border-zinc-800/80 p-5 overflow-hidden">
          
          {/* Barra de Búsqueda de Nodos */}
          <div className="flex-shrink-0 flex items-center bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 mb-4 shadow-inner">
            <Search className="w-4 h-4 text-zinc-500 mr-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar nodo operativo por nombre o tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white placeholder:text-zinc-650 w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Grilla Scrollable de Nodos */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {filteredLocations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                <AlertCircle className="w-10 h-10 mb-3 text-zinc-600 animate-pulse" />
                <p className="text-sm font-semibold">No se encontraron nodos operativos</p>
                <p className="text-xs text-zinc-600 mt-1">Prueba a buscar con otro término.</p>
              </div>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = selectedId === loc.id;
                return (
                  <motion.div
                    key={loc.id}
                    onClick={() => setSelectedId(isSelected ? null : loc.id)}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.995 }}
                    className={`p-5 rounded-xl border cursor-pointer transition-all duration-150 relative overflow-hidden ${
                      isSelected
                        ? 'bg-zinc-900/90 border-amber-500/50 shadow-md shadow-amber-950/5'
                        : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/60'
                    }`}
                  >
                    
                    {/* Fila Superior: Nombre del Nodo + Badge de Estado */}
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2.5">
                        {loc.type === 'molino' ? (
                          <Factory className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                        ) : (
                          <Pickaxe className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                        )}
                        <h3 className="font-bold text-white text-sm tracking-wide">{loc.name}</h3>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        loc.status === 'Activo'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : loc.status === 'Mantenimiento'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-zinc-800/30 text-zinc-400 border-zinc-800'
                      }`}>
                        {loc.status}
                      </span>
                    </div>

                    {/* Fila Central: KPIs del Nodo */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 border-t border-b border-zinc-800/40 my-3 text-xs">
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-0.5">Producción Oro</span>
                        <span className="font-extrabold text-amber-500 text-sm tabular-nums">
                          {fmtNum(loc.kpis.produccion)} <span className="text-[10px] font-medium text-zinc-500">g</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-0.5">Tenor Prom.</span>
                        <span className="font-extrabold text-white/90 text-sm tabular-nums">
                          {fmtNum(loc.kpis.tenor)} <span className="text-[10px] font-medium text-zinc-500">g/T</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-0.5">Merma Prom.</span>
                        <span className={`font-extrabold text-sm tabular-nums ${loc.kpis.merma > 55 ? 'text-red-400' : 'text-white/90'}`}>
                          {loc.kpis.merma}%
                        </span>
                      </div>
                    </div>

                    {/* Fila Inferior: Materiales y Orígenes */}
                    <div className="flex items-center justify-between gap-4 mt-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {loc.materiales && loc.materiales.slice(0, 3).map((mat, idx) => (
                          <span key={idx} className="bg-zinc-800/50 text-[10px] text-zinc-400 px-2 py-0.5 rounded border border-zinc-800/40">
                            {mat}
                          </span>
                        ))}
                      </div>
                      <ChevronRight className={`w-4 h-4 text-zinc-650 transition-transform ${isSelected ? 'translate-x-0.5 text-amber-500' : ''}`} />
                    </div>

                  </motion.div>
                );
              })
            )}
          </div>

        </div>

        {/* ── PANEL DERECHO: ANALÍTICAS Y DETALLES (5 columnas) ── */}
        <div className="lg:col-span-5 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            
            {/* 1. VISTA DE NODOS SELECCIONADOS */}
            {selectedLocation ? (
              <motion.div
                key={selectedLocation.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-zinc-900/60 rounded-2xl border border-zinc-800/80 p-6 backdrop-blur-md flex flex-col h-full overflow-hidden"
              >
                {/* Header de Detalle */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4 flex-shrink-0">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">// ANÁLISIS DE RENDIMIENTO</span>
                    <h2 className="text-lg font-black text-white tracking-wide">{selectedLocation.name.toUpperCase()}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1 rounded-lg hover:bg-zinc-800/50 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* KPI Overview */}
                <div className="grid grid-cols-2 gap-3 mb-5 flex-shrink-0">
                  <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-3.5">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-0.5">Producción total</span>
                    <span className="text-xl font-black text-amber-500 tabular-nums">{fmtNum(selectedLocation.kpis.produccion)} g</span>
                  </div>
                  <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-3.5">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-0.5">Merma Promedio</span>
                    <span className={`text-xl font-black tabular-nums ${selectedLocation.kpis.merma > 55 ? 'text-red-400' : 'text-white'}`}>
                      {selectedLocation.kpis.merma}%
                    </span>
                  </div>
                </div>

                {/* Recharts Area Trend Sparkline */}
                <div className="flex-1 min-h-[160px] max-h-[220px] bg-zinc-950/40 rounded-xl border border-zinc-800/40 p-4 mb-5 flex flex-col">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-3 block flex-shrink-0">TENDENCIA SIMULADA DE PRODUCCIÓN</span>
                  <div className="flex-1 w-full relative">
                    <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                      <AreaChart data={selectedSparklineData}>
                        <defs>
                          <linearGradient id="selectedGoldGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="t" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="v" name="Producción" stroke="#f59e0b" strokeWidth={1.5} fill="url(#selectedGoldGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Materiales y Orígenes Breakdown */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-5 text-sm custom-scrollbar">
                  {selectedLocation.materiales && selectedLocation.materiales.length > 0 && (
                    <div className="bg-zinc-950/20 border border-zinc-800/40 rounded-xl p-4">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">MATERIALES REGISTRADOS</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedLocation.materiales.map((mat, idx) => (
                          <span key={idx} className="bg-zinc-800/40 text-xs text-zinc-300 px-2.5 py-1 rounded-lg border border-zinc-800/80">
                            {mat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedLocation.origenes && selectedLocation.origenes.length > 0 && (
                    <div className="bg-zinc-950/20 border border-zinc-800/40 rounded-xl p-4">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">ORÍGENES DE EXTRACCIÓN</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedLocation.origenes.map((orig, idx) => (
                          <span key={idx} className="bg-zinc-800/45 text-xs text-zinc-300 px-2.5 py-1 rounded-lg border border-zinc-800/80">
                            {orig}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Drilldown CTA Button */}
                <div className="border-t border-zinc-800/80 pt-4 flex-shrink-0">
                  <Link href={selectedLocation.type === 'molino' ? '/planta/produccion' : '/mina/bitacora'} className="w-full">
                    <button className="btn-primary w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold shadow-lg shadow-amber-950/30">
                      Ver Historial Técnico Completo <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>

              </motion.div>
            ) : (
              
              // 2. VISTA ANALÍTICA GLOBAL (CUANDO NO HAY NADA SELECCIONADO)
              <motion.div
                key="global-analytics"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-zinc-900/60 rounded-2xl border border-zinc-800/80 p-6 backdrop-blur-md flex flex-col h-full overflow-hidden"
              >
                {/* Header Analítico Global */}
                <div className="border-b border-zinc-800/80 pb-4 mb-5 flex-shrink-0">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">// ANÁLISIS COMPARATIVO</span>
                  <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-amber-500" /> Distribución de Producción
                  </h2>
                </div>

                {/* Gráfico de Barras de Distribución de Oro */}
                <div className="flex-1 bg-zinc-950/40 rounded-xl border border-zinc-800/40 p-4 flex flex-col min-h-[220px]">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-4 block flex-shrink-0">RENDIMIENTO DE ORO RECUPERADO POR NODO</span>
                  
                  {barChartData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 p-4">
                      <HelpCircle className="w-8 h-8 text-zinc-650 mb-2 animate-pulse" />
                      <p className="text-xs">No hay suficiente data de producción acumulada para graficar.</p>
                    </div>
                  ) : (
                    <div className="flex-1 w-full relative">
                      <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                        <BarChart data={barChartData} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                          <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} tickLine={false} axisLine={false} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Bar dataKey="produccion" name="Producción">
                            {barChartData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.status === 'Activo'
                                    ? '#f59e0b'
                                    : entry.status === 'Mantenimiento'
                                    ? 'rgba(245, 158, 11, 0.4)'
                                    : 'rgba(255, 255, 255, 0.1)'
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Resumen Informativo al Pie */}
                <div className="mt-5 p-4 bg-zinc-950/20 border border-zinc-800/40 rounded-xl flex-shrink-0">
                  <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Monitoreo y Auditoría
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Haz clic sobre cualquier nodo de la grilla operativa a la izquierda para desplegar sus métricas históricas de tenor, sparklines de rendimiento y procedencia de materiales de manera individual.
                  </p>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
