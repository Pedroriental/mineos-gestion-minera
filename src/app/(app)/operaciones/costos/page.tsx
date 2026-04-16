'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Target, Loader2, Calculator, Gem, Pickaxe, Scale } from 'lucide-react';

export default function CostoPorGramoPage() {
  const [reportes, setReportes] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [goldPrice, setGoldPrice] = useState<{ usd_gramo: number; usd_onza: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [calcRecovery, setCalcRecovery] = useState(65);
  const [calcCostoDiario, setCalcCostoDiario] = useState(0);

  const loadData = useCallback(async () => {
    const [repRes, gastosRes, precioRes, precioFallbackRes] = await Promise.all([
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('gastos').select('monto, fecha, categorias_gasto(nombre)').order('fecha', { ascending: false }).limit(500),
      supabase.from('precio_oro_cache').select('precio_usd_por_gramo, precio_usd_por_onza').eq('fecha', new Date().toISOString().split('T')[0]).single(),
      supabase.from('precio_oro_cache').select('precio_usd_por_gramo, precio_usd_por_onza').order('fecha', { ascending: false }).limit(1).single(),
    ]);
    setReportes(repRes.data || []);
    setGastos(gastosRes.data || []);
    const p = precioRes.data || precioFallbackRes.data;
    setGoldPrice(p ? { usd_gramo: Number(p.precio_usd_por_gramo), usd_onza: Number(p.precio_usd_por_onza) } : { usd_gramo: 99.68, usd_onza: 3100.00 });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalGrams = useMemo(() => reportes.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0), [reportes]);
  const totalTon = useMemo(() => reportes.reduce((s, r) => s + Number(r.toneladas_procesadas || 0), 0), [reportes]);
  const totalGastos = useMemo(() => gastos.reduce((s, g) => s + Number(g.monto || 0), 0), [gastos]);
  const prodDays = useMemo(() => new Set(reportes.map(r => r.fecha)).size, [reportes]);
  const gastoDays = useMemo(() => new Set(gastos.map(g => g.fecha)).size, [gastos]);
  const costoPorGramo = totalGrams > 0 ? totalGastos / totalGrams : 0;
  const margenPorGramo = goldPrice ? goldPrice.usd_gramo - costoPorGramo : 0;
  const margenPct = goldPrice && goldPrice.usd_gramo > 0 ? (margenPorGramo / goldPrice.usd_gramo) * 100 : 0;
  const costoPorTon = totalTon > 0 ? totalGastos / totalTon : 0;
  const costoDiarioPromedio = gastoDays > 0 ? totalGastos / gastoDays : 0;
  const breakEvenGramos = goldPrice && goldPrice.usd_gramo > 0 ? costoDiarioPromedio / goldPrice.usd_gramo : 0;

  useEffect(() => {
    if (costoDiarioPromedio > 0 && calcCostoDiario === 0) setCalcCostoDiario(Math.round(costoDiarioPromedio));
  }, [costoDiarioPromedio, calcCostoDiario]);

  const leyDeCorte = useMemo(() => {
    if (!goldPrice || calcRecovery <= 0) return 0;
    const costoTon = costoPorTon > 0 ? costoPorTon : (calcCostoDiario > 0 && totalTon > 0 ? calcCostoDiario / (totalTon / prodDays) : 0);
    if (costoTon <= 0) return 0;
    return costoTon / (goldPrice.usd_gramo * (calcRecovery / 100));
  }, [goldPrice, calcRecovery, costoPorTon, calcCostoDiario, totalTon, prodDays]);

  const gastosByCategory = useMemo(() => {
    const map = new Map<string, number>();
    gastos.forEach((g: any) => {
      const name = g.categorias_gasto?.nombre || 'Sin categoría';
      map.set(name, (map.get(name) || 0) + Number(g.monto));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [gastos]);

  const dailyTimeline = useMemo(() => {
    const dateMap = new Map<string, { gastos: number; gramos: number }>();
    reportes.forEach(r => { const e = dateMap.get(r.fecha) || { gastos: 0, gramos: 0 }; e.gramos += Number(r.oro_recuperado_g || 0); dateMap.set(r.fecha, e); });
    gastos.forEach(g => { const e = dateMap.get(g.fecha) || { gastos: 0, gramos: 0 }; e.gastos += Number(g.monto); dateMap.set(g.fecha, e); });
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-15).map(([fecha, v]) => ({
      fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      costoPorG: v.gramos > 0 ? Math.round((v.gastos / v.gramos) * 100) / 100 : 0,
      gramos: Math.round(v.gramos * 100) / 100,
      gastos: Math.round(v.gastos),
    }));
  }, [reportes, gastos]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const fmtFull = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtNum = (n: number, d = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>;

  const isProfitable = margenPorGramo > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-emerald-400" /> Costo por Gramo &amp; Ley de Corte
        </h1>
        <p className="text-white/40 text-sm mt-1.5">
          Análisis de rentabilidad y calculadora de ley de corte — basado en {prodDays} días de producción
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card-glass p-6" style={{ borderTop: `3px solid ${isProfitable ? '#059669' : '#DC2626'}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-white/40" />
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Costo / Gramo</span>
          </div>
          <p className="text-3xl font-bold text-white/85">{fmtFull(costoPorGramo)}</p>
          <p className="text-xs text-white/30 mt-2">{fmt(totalGastos)} ÷ {fmtNum(totalGrams)}g</p>
        </div>

        <div className="card-glass p-6" style={{ borderTop: '3px solid #F59E0B' }}>
          <div className="flex items-center gap-2 mb-3">
            <Gem className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Precio Oro / g</span>
          </div>
          <p className="text-3xl font-bold text-amber-400">{fmtFull(goldPrice?.usd_gramo || 0)}</p>
          <p className="text-xs text-white/30 mt-2">{fmtFull(goldPrice?.usd_onza || 0)} / oz troy</p>
        </div>

        <div className="card-glass p-6" style={{ borderTop: `3px solid ${isProfitable ? '#059669' : '#DC2626'}` }}>
          <div className="flex items-center gap-2 mb-3">
            {isProfitable ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Margen / Gramo</span>
          </div>
          <p className={`text-3xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfitable ? '+' : ''}{fmtFull(margenPorGramo)}
          </p>
          <p className={`text-xs mt-2 font-semibold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfitable ? '✓ RENTABLE' : '✗ NO RENTABLE'} — {fmtNum(margenPct, 1)}%
          </p>
        </div>

        <div className="card-glass p-6" style={{ borderTop: '3px solid #3B82F6' }}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Punto de Equilibrio</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{fmtNum(breakEvenGramos, 2)} g</p>
          <p className="text-xs text-white/30 mt-2">Au mínimo diario para cubrir gastos</p>
        </div>
      </div>

      {/* Row 2: Ley de Corte + Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Ley de Corte Calculator — 3 cols */}
        <div className="lg:col-span-3 card-glass p-7" style={{ borderLeft: '4px solid #0D9488' }}>
          <h3 className="text-base font-semibold text-white/80 mb-6 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-teal-400" /> Calculadora de Ley de Corte (Cut-off Grade)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-white/55">Recovery Rate (%)</label>
                  <span className="text-sm font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">{calcRecovery}%</span>
                </div>
                <input type="range" min="10" max="100" step="1" value={calcRecovery}
                  onChange={e => setCalcRecovery(Number(e.target.value))}
                  className="w-full h-2 bg-white/[0.10] rounded-lg appearance-none cursor-pointer accent-teal-400" />
                <div className="flex justify-between text-[10px] text-white/30 mt-1.5">
                  <span>10%</span><span>40%</span><span>60%</span><span>80%</span><span>100%</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-white/55 mb-1.5 block">Costo Operativo Diario (USD)</label>
                <input type="number" value={calcCostoDiario}
                  onChange={e => setCalcCostoDiario(Number(e.target.value))}
                  className="input-field text-lg font-semibold" />
                <p className="text-xs text-white/30 mt-1.5">Promedio real: {fmt(costoDiarioPromedio)}/día</p>
              </div>

              {/* Formula */}
              <div className="text-xs text-white/30 bg-white/[0.05] p-4 rounded-xl font-mono leading-relaxed border border-white/[0.07]">
                Ley de Corte = Costo/ton ÷ (Precio Au/g × Recovery%)
                <br />
                = {fmt(costoPorTon)}/t ÷ ({fmtFull(goldPrice?.usd_gramo || 0)}/g × {calcRecovery}%)
                <br />
                = <strong className="text-teal-400">{fmtNum(leyDeCorte, 4)} g/t</strong>
              </div>
            </div>

            {/* Result */}
            <div className="flex flex-col gap-5">
              <div className="flex-1 p-6 bg-teal-500/[0.07] rounded-xl border border-teal-400/20 flex flex-col items-center justify-center">
                <span className="text-xs text-teal-400 font-semibold uppercase tracking-wider mb-3">Ley de Corte Calculada</span>
                <p className="text-5xl font-extrabold text-teal-400 mb-2">
                  {leyDeCorte > 0 ? fmtNum(leyDeCorte, 4) : '—'}
                </p>
                <p className="text-sm text-teal-400 font-medium">g/t</p>
                <p className="text-xs text-teal-400/70 mt-3 text-center leading-relaxed">
                  Mineral con ley inferior a este valor <strong>NO es rentable</strong> procesar
                </p>
              </div>

              {/* Extra KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="card-glass p-4">
                  <span className="text-[10px] text-white/35 font-semibold uppercase tracking-wider block mb-1.5">Costo / Tonelada</span>
                  <p className="text-xl font-bold text-white/75">{fmt(costoPorTon)}</p>
                </div>
                <div className="card-glass p-4">
                  <span className="text-[10px] text-white/35 font-semibold uppercase tracking-wider block mb-1.5">Gasto Diario</span>
                  <p className="text-xl font-bold text-white/75">{fmt(costoDiarioPromedio)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Breakdown — 2 cols */}
        <div className="lg:col-span-2 card-glass p-6">
          <h3 className="text-sm font-semibold text-white/70 mb-5 flex items-center gap-2">
            <Pickaxe className="w-4 h-4 text-amber-400" /> Distribución de Costos
          </h3>
          {gastosByCategory.length > 0 ? (
            <div className="space-y-5">
              {gastosByCategory.map((cat, i) => {
                const pct = totalGastos > 0 ? (cat.value / totalGastos) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/65 font-medium truncate pr-3">{cat.name}</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-bold text-white/80">{fmt(cat.value)}</span>
                        <span className="text-xs text-white/35 w-10 text-right">{fmtNum(pct, 1)}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${pct}%`, opacity: 1 - (i * 0.1) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/30 text-center py-8">Sin gastos registrados</p>
          )}

          {/* Total */}
          <div className="mt-6 pt-4 border-t border-white/[0.07] flex items-center justify-between">
            <span className="text-sm font-semibold text-white/50">Total Acumulado</span>
            <span className="text-lg font-bold text-white/85">{fmt(totalGastos)}</span>
          </div>
        </div>
      </div>

      {/* Daily Cost Trend */}
      {dailyTimeline.length > 0 && (
        <div className="card-glass p-6">
          <h3 className="text-sm font-semibold text-white/70 mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Costo por Gramo — Evolución Diaria
          </h3>
          <div className="flex items-end gap-3 h-44 px-2">
            {dailyTimeline.map((d, i) => {
              const maxCost = Math.max(...dailyTimeline.filter(x => x.costoPorG > 0).map(x => x.costoPorG), 1);
              const h = maxCost > 0 && d.costoPorG > 0 ? (d.costoPorG / maxCost) * 100 : 0;
              const isOverPrice = goldPrice && d.costoPorG > goldPrice.usd_gramo;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5"
                  title={`${d.fecha}: Costo/g ${fmtFull(d.costoPorG)} — ${d.gramos}g Au — Gastos ${fmt(d.gastos)}`}>
                  <span className={`text-[10px] font-bold ${isOverPrice ? 'text-red-500' : 'text-emerald-600'}`}>
                    {d.costoPorG > 0 ? `$${fmtNum(d.costoPorG, 0)}` : ''}
                  </span>
                  <div className="w-full bg-white/[0.07] rounded-md relative" style={{ height: '130px' }}>
                    <div className={`absolute bottom-0 w-full rounded-md transition-all duration-500 ${
                      isOverPrice ? 'bg-gradient-to-t from-red-500 to-red-400' : 'bg-gradient-to-t from-emerald-500 to-emerald-400'
                    }`} style={{ height: `${Math.max(h, 3)}%` }} />
                  </div>
                  <span className="text-[10px] text-white/30 font-medium">{d.fecha}</span>
                </div>
              );
            })}
          </div>
          {goldPrice && (
            <div className="flex items-center gap-6 mt-4 text-xs text-white/30">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-emerald-500 rounded-sm inline-block" /> Rentable (costo &lt; precio oro)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-red-500 rounded-sm inline-block" /> No rentable (costo &gt; precio oro)</span>
              <span className="ml-auto font-medium">Referencia: {fmtFull(goldPrice.usd_gramo)}/g</span>
            </div>
          )}
        </div>
      )}

      {/* Profitability Summary */}
      <div className={`card-glass p-6 flex items-start gap-5`}
        style={{ borderLeft: `4px solid ${isProfitable ? '#059669' : '#DC2626'}` }}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isProfitable ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          {isProfitable ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
        </div>
        <div>
          <h4 className={`text-sm font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfitable ? '✓ Operación Rentable' : '✗ Operación No Rentable'}
          </h4>
          <p className="text-sm text-white/55 mt-2 leading-relaxed">
            {isProfitable
              ? `Con un costo de ${fmtFull(costoPorGramo)}/g y un precio del oro de ${fmtFull(goldPrice?.usd_gramo || 0)}/g, tienes un margen positivo de ${fmtFull(margenPorGramo)}/g (${fmtNum(margenPct, 1)}%). Necesitas producir al menos ${fmtNum(breakEvenGramos, 2)}g Au diarios para cubrir gastos.`
              : `El costo de producción (${fmtFull(costoPorGramo)}/g) supera el precio del oro (${fmtFull(goldPrice?.usd_gramo || 0)}/g). Se recomienda revisar los gastos operativos y optimizar la eficiencia de recuperación.`
            }
          </p>
          {leyDeCorte > 0 && (
            <p className="text-xs text-white/35 mt-3">
              <strong>Ley de Corte:</strong> No procesar material con ley inferior a <strong className="text-teal-400">{fmtNum(leyDeCorte, 4)} g/t</strong> al {calcRecovery}% de recuperación.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
