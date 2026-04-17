'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, TrendingUp, TrendingDown, Gem, DollarSign, Factory, Users, AlertTriangle, ChevronDown, Loader2, Pickaxe, Scale, Target, Calendar, Printer } from 'lucide-react';

type Period = '7d' | '15d' | '30d' | 'all';

export default function ResumenEjecutivoPage() {
  const [reportes, setReportes] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [quemadas, setQuemadas] = useState<any[]>([]);
  const [recepciones, setRecepciones] = useState<any[]>([]);
  const [guardias, setGuardias] = useState<any[]>([]);
  const [goldPrice, setGoldPrice] = useState<{ usd_gramo: number; usd_onza: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');

  const loadData = useCallback(async () => {
    const [repRes, gastosRes, quemadasRes, recRes, guardiaRes, precioRes, precioFallbackRes] = await Promise.all([
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(1000),
      supabase.from('gastos').select('monto, fecha, categorias_gasto(nombre)').order('fecha', { ascending: false }).limit(1000),
      supabase.from('reportes_quemado').select('*').order('fecha', { ascending: false }).limit(200),
      supabase.from('recepcion_material').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('libro_guardia').select('id, fecha, incidentes').order('fecha', { ascending: false }).limit(200),
      supabase.from('precio_oro_cache').select('precio_usd_por_gramo, precio_usd_por_onza').eq('fecha', new Date().toISOString().split('T')[0]).single(),
      supabase.from('precio_oro_cache').select('precio_usd_por_gramo, precio_usd_por_onza').order('fecha', { ascending: false }).limit(1).single(),
    ]);
    setReportes(repRes.data || []);
    setGastos(gastosRes.data || []);
    setQuemadas(quemadasRes.data || []);
    setRecepciones(recRes.data || []);
    setGuardias(guardiaRes.data || []);
    const p = precioRes.data || precioFallbackRes.data;
    setGoldPrice(p ? { usd_gramo: Number(p.precio_usd_por_gramo), usd_onza: Number(p.precio_usd_por_onza) } : { usd_gramo: 99.68, usd_onza: 3100 });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter by period
  const cutoffDate = useMemo(() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period));
    return d.toISOString().split('T')[0];
  }, [period]);

  const filteredReportes = useMemo(() => cutoffDate ? reportes.filter(r => r.fecha >= cutoffDate) : reportes, [reportes, cutoffDate]);
  const filteredGastos = useMemo(() => cutoffDate ? gastos.filter(g => g.fecha >= cutoffDate) : gastos, [gastos, cutoffDate]);
  const filteredQuemadas = useMemo(() => cutoffDate ? quemadas.filter(q => q.fecha >= cutoffDate) : quemadas, [quemadas, cutoffDate]);
  const filteredRecepciones = useMemo(() => cutoffDate ? recepciones.filter(r => r.fecha >= cutoffDate) : recepciones, [recepciones, cutoffDate]);
  const filteredGuardias = useMemo(() => cutoffDate ? guardias.filter(g => g.fecha >= cutoffDate) : guardias, [guardias, cutoffDate]);

  // ═══ CALCULATIONS ═══
  const totalGrams = useMemo(() => filteredReportes.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0), [filteredReportes]);
  const totalTon = useMemo(() => filteredReportes.reduce((s, r) => s + Number(r.toneladas_procesadas || 0), 0), [filteredReportes]);
  const totalSacos = useMemo(() => filteredReportes.reduce((s, r) => s + (r.sacos || 0), 0), [filteredReportes]);
  const totalGastos = useMemo(() => filteredGastos.reduce((s, g) => s + Number(g.monto || 0), 0), [filteredGastos]);
  const totalQuemadaOro      = useMemo(() => filteredQuemadas.reduce((s, q) => s + Number(q.total_oro_g     || 0), 0), [filteredQuemadas]);
  const totalQuemadaAmalgama = useMemo(() => filteredQuemadas.reduce((s, q) => s + Number(q.total_amalgama_g || 0), 0), [filteredQuemadas]);
  const totalRecepcionKg = useMemo(() => filteredRecepciones.reduce((s, r) => s + Number(r.peso_estimado_kg || 0), 0), [filteredRecepciones]);
  const totalRecepcionSacos = useMemo(() => filteredRecepciones.reduce((s, r) => s + (r.sacos_recibidos || 0), 0), [filteredRecepciones]);
  const incidentes = useMemo(() => filteredGuardias.filter(g => g.incidentes && g.incidentes.trim().length > 0), [filteredGuardias]);

  const leyCabeza = totalTon > 0 ? totalGrams / totalTon : 0;
  const costoPorGramo = totalGrams > 0 ? totalGastos / totalGrams : 0;
  const ingresoEstimado = goldPrice ? totalGrams * goldPrice.usd_gramo : 0;
  // Rentabilidad real: usa el oro puro quemado como referencia (es el dato definitivo)
  const ingresoReal    = goldPrice && totalQuemadaOro > 0 ? totalQuemadaOro * goldPrice.usd_gramo : ingresoEstimado;
  const ganancia = ingresoReal - totalGastos;
  const isProfitable = ganancia > 0;
  const margenPct = ingresoReal > 0 ? (ganancia / ingresoReal) * 100 : 0;

  const prodDays = useMemo(() => new Set(filteredReportes.map(r => r.fecha)).size, [filteredReportes]);
  const promDiarioGramos = prodDays > 0 ? totalGrams / prodDays : 0;
  const promDiarioTon = prodDays > 0 ? totalTon / prodDays : 0;

  // Gastos by category
  const gastosByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredGastos.forEach((g: any) => {
      const name = g.categorias_gasto?.nombre || 'Sin categoría';
      map.set(name, (map.get(name) || 0) + Number(g.monto));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredGastos]);

  // Top molino
  const topMolino = useMemo(() => {
    const map = new Map<string, { oro: number; ton: number }>();
    filteredReportes.forEach(r => {
      const n = r.molino || 'Desconocido';
      const e = map.get(n) || { oro: 0, ton: 0 };
      e.oro += Number(r.oro_recuperado_g || 0);
      e.ton += Number(r.toneladas_procesadas || 0);
      map.set(n, e);
    });
    let best = { name: '—', oro: 0, ley: 0 };
    map.forEach((v, k) => { const ley = v.ton > 0 ? v.oro / v.ton : 0; if (ley > best.ley) best = { name: k, oro: v.oro, ley }; });
    return best;
  }, [filteredReportes]);

  // Production timeline (daily)
  const dailyProd = useMemo(() => {
    const map = new Map<string, { oro: number; ton: number }>();
    filteredReportes.forEach(r => {
      const e = map.get(r.fecha) || { oro: 0, ton: 0 };
      e.oro += Number(r.oro_recuperado_g || 0);
      e.ton += Number(r.toneladas_procesadas || 0);
      map.set(r.fecha, e);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, v]) => ({
      fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      oro: Math.round(v.oro * 100) / 100,
    }));
  }, [filteredReportes]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const fmtFull = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtNum = (n: number, d = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);

  const periodLabel: Record<Period, string> = { '7d': 'Últimos 7 días', '15d': 'Últimos 15 días', '30d': 'Últimos 30 días', 'all': 'Todo el historial' };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 print:space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-xl sm:text-2xl flex items-center gap-2.5">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 flex-shrink-0" /> Resumen Ejecutivo
          </h1>
          <p className="text-white/40 text-xs sm:text-sm mt-1">
            {periodLabel[period]} — {prodDays} día{prodDays !== 1 ? 's' : ''} con producción registrada
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {/* Period selector — scrollable on mobile */}
          <div className="flex bg-white/[0.06] border border-white/[0.08] rounded-xl p-1 gap-0.5 overflow-x-auto no-scrollbar">
            {(['7d', '15d', '30d', 'all'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                  period === p
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-400/30'
                    : 'text-white/40 hover:text-white/70'
                }`}>
                {p === 'all' ? 'Todo' : p}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()} className="btn-secondary !py-2 !px-3 gap-1.5 text-xs hidden sm:inline-flex">
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
        </div>
      </div>

      {/* ── Top Gold Banner ── */}
      <div className="card-glass rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-5 border-l-4 border-l-emerald-400/60">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/15 border border-emerald-400/20">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-none text-emerald-400">
              +{fmtNum(totalGrams + totalQuemadaOro, 2)} g
            </h2>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-400/25">
              TOTAL (PROD + QUEMADO)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-white/45 leading-snug">
            Producción planta: <span className="text-white/65 font-medium">{fmtNum(totalGrams, 2)} g</span>
            {' '}— Quemado real: <span className="text-amber-400 font-medium">{fmtNum(totalQuemadaOro, 2)} g</span>
          </p>
        </div>
        {/* Gold price — shown sm+ */}
        <div className="text-right hidden sm:block shrink-0 pl-4 border-l border-white/[0.07]">
          <span className="text-[10px] text-white/35 uppercase tracking-widest font-bold block mb-1">Precio Oro</span>
          <p className="text-xl font-black text-amber-400">{fmtFull(goldPrice?.usd_onza || 0)}/oz</p>
          <p className="text-xs text-white/40">{fmtFull(goldPrice?.usd_gramo || 0)}/g</p>
        </div>
      </div>

      {/* ── KPI Grid — 2 cols on mobile, 3 on sm, 6 on lg ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {[
          { icon: <Gem className="w-4 h-4 text-amber-400" />, label: 'Oro', value: `${fmtNum(totalGrams)} g`, sub: `${fmtNum(promDiarioGramos)} g/día`, color: 'text-amber-400' },
          { icon: <Factory className="w-4 h-4 text-blue-400" />, label: 'Toneladas', value: `${fmtNum(totalTon)} t`, sub: `${fmtNum(promDiarioTon)} t/día`, color: 'text-blue-400' },
          { icon: <Target className="w-4 h-4 text-cyan-400" />, label: 'Ley Cabeza', value: fmtNum(leyCabeza, 3), sub: 'g Au / t', color: 'text-cyan-400' },
          { icon: <Scale className="w-4 h-4 text-white/50" />, label: 'Costo/g', value: `$${fmtNum(costoPorGramo, 2)}`, sub: `Mar: $${fmtNum(goldPrice ? goldPrice.usd_gramo - costoPorGramo : 0, 2)}/g`, color: 'text-white/80' },
          { icon: <Pickaxe className="w-4 h-4 text-orange-400" />, label: 'Quemadas', value: String(filteredQuemadas.length), sub: `${fmtNum(totalQuemadaOro, 4)} g Au`, color: 'text-orange-400' },
          { icon: <AlertTriangle className="w-4 h-4 text-red-400" />, label: 'Incidentes', value: String(incidentes.length), sub: incidentes.length === 0 ? '✓ Sin novedad' : 'Registrados', color: incidentes.length > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map((kpi, i) => (
          <div key={i} className="card-glass rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-2 sm:mb-3">
              {kpi.icon}
              <span className="text-[9px] text-white/35 font-bold uppercase tracking-widest leading-tight truncate">{kpi.label}</span>
            </div>
            <p className={`text-lg sm:text-xl font-black leading-none mb-1 truncate ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[9px] sm:text-[10px] text-white/35 truncate">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Row: Chart + Costs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── Production Chart — Area Chart style with SVG ── */}
        <div className="lg:col-span-3 card-glass rounded-xl p-5">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-5 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Producción Diaria de Oro (g)
          </h3>
          {dailyProd.length > 0 ? (() => {
            const maxOro = Math.max(...dailyProd.map(d => d.oro), 1);
            const W = 100;  // viewBox width units per bar
            const H = 140;  // viewBox height
            const PAD = 2;
            const totalW = dailyProd.length * W;
            const toY = (v: number) => H - PAD - Math.max((v / maxOro) * (H - PAD * 2 - 24), 1);

            // Build SVG polyline points
            const pts = dailyProd.map((d, i) => `${i * W + W / 2},${toY(d.oro)}`).join(' ');
            const areaPath = [
              `M ${0},${H}`,
              ...dailyProd.map((d, i) => `L ${i * W + W / 2},${toY(d.oro)}`),
              `L ${(dailyProd.length - 1) * W + W / 2},${H}`,
              'Z',
            ].join(' ');

            return (
              <div className="overflow-x-auto pb-1">
                <svg
                  viewBox={`0 0 ${totalW} ${H + 20}`}
                  style={{ minWidth: Math.max(totalW, 300), height: 160, display: 'block', width: '100%' }}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal guide lines */}
                  {[0.25, 0.5, 0.75, 1].map(t => (
                    <line
                      key={t}
                      x1={0} y1={toY(maxOro * t)}
                      x2={totalW} y2={toY(maxOro * t)}
                      stroke="rgba(255,255,255,0.05)" strokeWidth={1}
                    />
                  ))}

                  {/* Area fill */}
                  <path d={areaPath} fill="url(#goldAreaGrad)" />

                  {/* Line */}
                  <polyline
                    points={pts}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* Dots + labels */}
                  {dailyProd.map((d, i) => (
                    <g key={i}>
                      <circle
                        cx={i * W + W / 2} cy={toY(d.oro)}
                        r={3} fill="#F59E0B" stroke="#09090b" strokeWidth={1.5}
                      />
                      {/* Value label (only show if bars > 1g to avoid clutter) */}
                      {d.oro > 0 && (
                        <text
                          x={i * W + W / 2} y={toY(d.oro) - 7}
                          textAnchor="middle"
                          fontSize={dailyProd.length > 15 ? 7 : 9}
                          fill="rgba(245,158,11,0.75)"
                          fontWeight="700"
                        >
                          {d.oro < 100 ? d.oro.toFixed(1) : Math.round(d.oro)}
                        </text>
                      )}
                      {/* Date label */}
                      <text
                        x={i * W + W / 2} y={H + 16}
                        textAnchor="middle"
                        fontSize={dailyProd.length > 20 ? 6 : 8}
                        fill="rgba(255,255,255,0.25)"
                        fontWeight="500"
                      >
                        {d.fecha}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            );
          })() : (
            <p className="text-sm text-white/30 text-center py-10">Sin datos de producción en el período</p>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="lg:col-span-2 card-glass rounded-xl p-5 flex flex-col">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-5 flex items-center gap-2 flex-shrink-0">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Gastos por Categoría
          </h3>
          {gastosByCategory.length > 0 ? (
            <div className="space-y-3.5 flex-1">
              {gastosByCategory.slice(0, 6).map((cat, i) => {
                const pct = totalGastos > 0 ? (cat.value / totalGastos) * 100 : 0;
                const colors = ['#10B981','#3B82F6','#F59E0B','#8B5CF6','#EF4444','#06B6D4'];
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-white/65 font-medium truncate pr-3">{cat.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-white/80">{fmt(cat.value)}</span>
                        <span className="text-[10px] text-white/35 w-8 text-right">{fmtNum(pct, 0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-white/30 text-center">Sin gastos registrados en el período</p>
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Total</span>
            <span className="text-lg font-black text-white/90">{fmt(totalGastos)}</span>
          </div>
        </div>
      </div>


      {/* ── Bottom Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Recepción de Material',
            accent: '#3B82F6',
            rows: [
              { label: 'Recepciones', value: filteredRecepciones.length, color: 'text-white/80' },
              { label: 'Peso total', value: `${fmtNum(totalRecepcionKg)} kg`, color: 'text-white/80' },
              { label: 'Sacos recibidos', value: totalRecepcionSacos, color: 'text-white/80' },
            ],
          },
          {
            title: 'Producción Planta',
            accent: '#10B981',
            rows: [
              { label: 'Reportes', value: filteredReportes.length, color: 'text-white/80' },
              { label: 'Sacos procesados', value: totalSacos, color: 'text-white/80' },
              { label: 'Mejor molino', value: `${topMolino.name} (${fmtNum(topMolino.ley, 2)} g/t)`, color: 'text-amber-400' },
            ],
          },
          {
            title: 'Quemada de Plancha',
            accent: '#F59E0B',
            rows: [
              { label: 'Quemadas', value: filteredQuemadas.length, color: 'text-white/80' },
              { label: 'Au recuperado', value: `${fmtNum(totalQuemadaOro, 4)} g`, color: 'text-amber-400' },
              { label: 'Amalgama total', value: `${fmtNum(totalQuemadaAmalgama, 2)} g`, color: 'text-white/60' },
            ],
          },
          {
            title: 'Seguridad y Guardia',
            accent: incidentes.length > 0 ? '#EF4444' : '#10B981',
            rows: [
              { label: 'Entregas de turno', value: filteredGuardias.length, color: 'text-white/80' },
              { label: 'Incidentes', value: incidentes.length === 0 ? '✓ 0' : incidentes.length, color: incidentes.length > 0 ? 'text-red-400' : 'text-emerald-400' },
              { label: 'Estado', value: incidentes.length === 0 ? 'Sin novedad' : 'Revisar', color: incidentes.length === 0 ? 'text-emerald-400' : 'text-amber-400' },
            ],
          },
        ].map((card) => (
          <div key={card.title} className="card-glass rounded-xl p-5" style={{ borderTop: `2px solid ${card.accent}40` }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full" style={{ background: card.accent }} />
              <span className="text-[10px] text-white/45 font-bold uppercase tracking-widest">{card.title}</span>
            </div>
            <div className="space-y-2.5">
              {card.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{row.label}</span>
                  <span className={`text-sm font-bold ${row.color}`}>{String(row.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer — Print only */}
      <div className="text-center text-xs text-white/25 pt-2 print:block hidden">
        Informe generado por MineOS — {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}
