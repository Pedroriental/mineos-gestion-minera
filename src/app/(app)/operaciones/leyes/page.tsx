'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Beaker, TrendingUp, TrendingDown, Factory, Target, Loader2, Scale, Info } from 'lucide-react';

export default function ControlLeyesPage() {
  const [reportes, setReportes] = useState<any[]>([]);
  const [recepciones, setRecepciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [repRes, recRes] = await Promise.all([
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('recepcion_material').select('*').order('fecha', { ascending: false }).limit(500),
    ]);
    setReportes(repRes.data || []);
    setRecepciones(recRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalGrams = useMemo(() => reportes.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0), [reportes]);
  const totalTon = useMemo(() => reportes.reduce((s, r) => s + Number(r.toneladas_procesadas || 0), 0), [reportes]);
  const totalSacos = useMemo(() => reportes.reduce((s, r) => s + (r.sacos || 0), 0), [reportes]);
  const leyCabeza = totalTon > 0 ? totalGrams / totalTon : 0;

  const recepcionesConTenor = useMemo(() => recepciones.filter(r => r.tenor_estimado_gpt > 0 && r.peso_estimado_kg > 0), [recepciones]);
  const oroEstimadoTotal = useMemo(() =>
    recepcionesConTenor.reduce((s, r) => s + (Number(r.tenor_estimado_gpt) * Number(r.peso_estimado_kg) / 1000), 0),
    [recepcionesConTenor]
  );
  const recoveryRate = oroEstimadoTotal > 0 ? (totalGrams / oroEstimadoTotal) * 100 : 0;
  const ratioSacoOro = totalSacos > 0 ? totalGrams / totalSacos : 0;

  const molinoStats = useMemo(() => {
    const map = new Map<string, { oro: number; ton: number; sacos: number; count: number; mermas: number[] }>();
    reportes.forEach(r => {
      const name = r.molino || 'Desconocido';
      const e = map.get(name) || { oro: 0, ton: 0, sacos: 0, count: 0, mermas: [] };
      e.oro += Number(r.oro_recuperado_g || 0);
      e.ton += Number(r.toneladas_procesadas || 0);
      e.sacos += r.sacos || 0;
      e.count++;
      if (r.merma_1_pct) e.mermas.push(Number(r.merma_1_pct));
      map.set(name, e);
    });
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      oro: Math.round(v.oro * 100) / 100,
      ton: Math.round(v.ton * 100) / 100,
      sacos: v.sacos,
      count: v.count,
      ley: v.ton > 0 ? Math.round((v.oro / v.ton) * 10000) / 10000 : 0,
      avgMerma: v.mermas.length > 0 ? Math.round((v.mermas.reduce((a, b) => a + b, 0) / v.mermas.length) * 100) / 100 : 0,
    })).sort((a, b) => b.ley - a.ley);
  }, [reportes]);

  const zonaStats = useMemo(() => {
    const map = new Map<string, { oro: number; ton: number; sacos: number }>();
    reportes.forEach(r => {
      const zona = r.material || 'Sin clasificar';
      const e = map.get(zona) || { oro: 0, ton: 0, sacos: 0 };
      e.oro += Number(r.oro_recuperado_g || 0);
      e.ton += Number(r.toneladas_procesadas || 0);
      e.sacos += r.sacos || 0;
      map.set(zona, e);
    });
    return Array.from(map.entries()).map(([zona, v]) => ({
      zona,
      oro: Math.round(v.oro * 100) / 100,
      ton: Math.round(v.ton * 100) / 100,
      sacos: v.sacos,
      ley: v.ton > 0 ? Math.round((v.oro / v.ton) * 10000) / 10000 : 0,
    })).sort((a, b) => b.ley - a.ley);
  }, [reportes]);

  const dailyRecovery = useMemo(() => {
    const map = new Map<string, { oro: number; ton: number }>();
    reportes.forEach(r => {
      const e = map.get(r.fecha) || { oro: 0, ton: 0 };
      e.oro += Number(r.oro_recuperado_g || 0);
      e.ton += Number(r.toneladas_procesadas || 0);
      map.set(r.fecha, e);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-15)
      .map(([fecha, v]) => ({
        fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        ley: v.ton > 0 ? Math.round((v.oro / v.ton) * 10000) / 10000 : 0,
        oro: Math.round(v.oro * 100) / 100,
      }));
  }, [reportes]);

  const fmtNum = (n: number, d = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);

  const getRecoveryColor = (pct: number) => {
    if (pct >= 80) return { text: 'text-emerald-600', bg: 'bg-emerald-500', label: 'EXCELENTE' };
    if (pct >= 60) return { text: 'text-amber-600', bg: 'bg-amber-500', label: 'ACEPTABLE' };
    if (pct >= 40) return { text: 'text-orange-600', bg: 'bg-orange-500', label: 'BAJO' };
    return { text: 'text-red-600', bg: 'bg-red-500', label: 'CRÍTICO' };
  };
  const recoveryStyle = getRecoveryColor(recoveryRate);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-teal-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
          <Beaker className="w-6 h-6 text-teal-400" /> Control de Leyes — Balance Metalúrgico
        </h1>
        <p className="text-white/40 text-sm mt-1.5">
          Análisis de eficiencia de recuperación aurífera basado en {reportes.length} reportes de producción
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card-glass p-6" style={{ borderTop: '3px solid #0D9488' }}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-teal-400" />
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Ley de Cabeza</span>
          </div>
          <p className="text-3xl font-bold text-teal-400">{fmtNum(leyCabeza, 4)}</p>
          <p className="text-xs text-white/30 mt-2">g Au / tonelada procesada</p>
        </div>

        <div className="card-glass p-6" style={{ borderTop: `3px solid ${recoveryRate >= 60 ? '#059669' : '#DC2626'}` }}>
          <div className="flex items-center gap-2 mb-3">
            {recoveryRate >= 60 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Recuperación</span>
          </div>
          <div className="flex items-baseline gap-3">
            <p className={`text-3xl font-bold ${recoveryStyle.text}`}>
              {recoveryRate > 0 ? `${fmtNum(recoveryRate, 1)}%` : '—'}
            </p>
            {recoveryRate > 0 && (
              <span className={`text-[10px] font-bold ${recoveryStyle.text} px-2 py-0.5 rounded-full ${recoveryStyle.bg}/10 border`}>
                {recoveryStyle.label}
              </span>
            )}
          </div>
          <p className="text-xs text-white/30 mt-2">
            {recoveryRate > 0 ? `${fmtNum(totalGrams)}g de ${fmtNum(oroEstimadoTotal)}g est.` : 'Sin datos de tenor'}
          </p>
        </div>

        <div className="card-glass p-6" style={{ borderTop: '3px solid #7C3AED' }}>
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Ratio Saco→Oro</span>
          </div>
          <p className="text-3xl font-bold text-purple-400">{fmtNum(ratioSacoOro, 4)}</p>
          <p className="text-xs text-white/30 mt-2">g Au promedio por saco</p>
        </div>

        <div className="card-glass p-6" style={{ borderTop: '3px solid #2563EB' }}>
          <div className="flex items-center gap-2 mb-3">
            <Factory className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Procesado Total</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{fmtNum(totalTon, 2)}</p>
          <p className="text-xs text-white/30 mt-2">toneladas — {totalSacos} sacos</p>
        </div>
      </div>

      {/* Recovery Gauge */}
      {recoveryRate > 0 && (
        <div className="card-glass p-6">
          <h3 className="text-sm font-semibold text-white/70 mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-400" /> Gauge de Recuperación Metalúrgica
          </h3>
          <div className="w-full bg-white/[0.08] rounded-full h-7 relative overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${recoveryStyle.bg}`}
              style={{ width: `${Math.min(recoveryRate, 100)}%` }}
            />
            <div className="absolute inset-0 flex items-center">
              <div className="absolute left-[40%] top-0 bottom-0 w-px bg-white/50" />
              <div className="absolute left-[60%] top-0 bottom-0 w-px bg-white/50" />
              <div className="absolute left-[80%] top-0 bottom-0 w-px bg-white/50" />
            </div>
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <span className="text-[10px] font-bold text-white/80">0%</span>
              <span className="text-[10px] font-bold text-white/80">100%</span>
            </div>
          </div>
          <div className="gauge-labels-row flex justify-between mt-3 text-[10px] text-white/30 font-medium px-1">
            <span>CRÍTICO (&lt;40%)</span>
            <span>BAJO (40-60%)</span>
            <span>ACEPTABLE (60-80%)</span>
            <span>EXCELENTE (&gt;80%)</span>
          </div>
        </div>
      )}

      {/* Two columns: Molinos + Zonas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Eficiencia por Molino */}
        <div className="card-glass p-6">
          <h3 className="text-sm font-semibold text-white/70 mb-5 flex items-center gap-2">
            <Factory className="w-4 h-4 text-amber-400" /> Eficiencia por Molino (Ranking)
          </h3>
          {molinoStats.length > 0 ? (
            <div className="space-y-5">
              {molinoStats.map((m, i) => {
                const maxLey = molinoStats[0]?.ley || 1;
                const pct = maxLey > 0 ? (m.ley / maxLey) * 100 : 0;
                return (
                  <div key={m.name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                          i === 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.07] text-white/40'
                        }`}>{i + 1}</span>
                        <span className="text-sm font-semibold text-white/75">{m.name}</span>
                      </div>
                      <span className="text-sm text-teal-400 font-bold">{fmtNum(m.ley, 4)} g/t</span>
                    </div>
                    <div className="h-2.5 bg-white/[0.07] rounded-full overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all duration-700 ${
                        i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-teal-500' : 'bg-blue-400'
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/30 pl-9">
                      <span>{fmtNum(m.oro)}g Au</span>
                      <span>{m.sacos} sacos</span>
                      <span>{fmtNum(m.ton)} ton</span>
                      {m.avgMerma > 0 && (
                        <span className={`font-semibold ${m.avgMerma > 60 ? 'text-red-500' : m.avgMerma > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          Merma: {m.avgMerma}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/30 text-center py-8">Sin datos de molinos</p>
          )}
        </div>

        {/* Ley por Zona / Material */}
        <div className="card-glass p-6">
          <h3 className="text-sm font-semibold text-white/70 mb-5 flex items-center gap-2">
            <Target className="w-4 h-4 text-teal-400" /> Ley por Material / Zona
          </h3>
          {zonaStats.length > 0 ? (
            <div className="space-y-4">
              {zonaStats.slice(0, 8).map((z, i) => {
                const maxLey = zonaStats[0]?.ley || 1;
                const pct = maxLey > 0 ? (z.ley / maxLey) * 100 : 0;
                return (
                  <div key={z.zona}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-amber-500 text-sm">★</span>}
                        <span className="text-sm font-semibold text-white/75">{z.zona}</span>
                      </div>
                      <span className="text-sm font-bold text-teal-400">{fmtNum(z.ley, 4)} g/t</span>
                    </div>
                    <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden mb-1.5">
                      <div className="h-full rounded-full bg-teal-500 transition-all duration-700"
                        style={{ width: `${pct}%`, opacity: 1 - (i * 0.12) }} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      <span className="text-amber-400 font-medium">{fmtNum(z.oro)}g Au</span>
                      <span>{fmtNum(z.ton)} ton</span>
                      <span>{z.sacos} sacos</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/30 text-center py-8">Sin datos de zonas</p>
          )}
        </div>
      </div>

      {/* Daily Ley Timeline */}
      {dailyRecovery.length > 0 && (
        <div className="card-glass p-6">
          <h3 className="text-sm font-semibold text-white/70 mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Evolución de Ley de Cabeza (últimos 15 días)
          </h3>
          <div className="flex items-end gap-3 h-44 px-2">
            {dailyRecovery.map((d, i) => {
              const maxLey = Math.max(...dailyRecovery.map(x => x.ley));
              const h = maxLey > 0 ? (d.ley / maxLey) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5" title={`${d.fecha}: ${d.ley} g/t — ${d.oro}g Au`}>
                  <span className="text-[10px] text-teal-400 font-bold">{d.ley > 0 ? fmtNum(d.ley, 2) : ''}</span>
                  <div className="w-full bg-white/[0.07] rounded-md relative" style={{ height: '130px' }}>
                    <div
                      className="absolute bottom-0 w-full rounded-md bg-gradient-to-t from-teal-500 to-teal-400 transition-all duration-500"
                      style={{ height: `${Math.max(h, 3)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/30 font-medium">{d.fecha}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="card-glass p-5 flex items-start gap-4" style={{ borderColor: 'rgba(13, 148, 136, 0.2)' }}>
        <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <p className="text-sm text-white/55 leading-relaxed">
            <strong className="text-white/70">¿Cómo mejorar la precisión?</strong> Para obtener un Recovery Rate más exacto, registra el <strong className="text-teal-400">tenor estimado (g/t)</strong> en cada
            recepción de material. Esto permite comparar el oro contenido en el mineral vs. el oro efectivamente recuperado en planta.
          </p>
          <p className="text-xs text-white/25 mt-2 font-mono">
            Recovery (%) = (Oro Recuperado ÷ Oro Contenido Estimado) × 100
          </p>
        </div>
      </div>
    </div>
  );
}
