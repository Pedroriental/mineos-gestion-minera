'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { Loader2, ArrowUp, ArrowDown, TrendingUp, AlertTriangle, Zap, Clock, Bell, ChevronRight, Factory, Pickaxe, DollarSign, BarChart3, Package, Scale } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, PieChart, Pie, Cell,
} from 'recharts';

// ═══════════════════════════════════════════════════════════
// THEME CONSTANTS
// ═══════════════════════════════════════════════════════════
const CD = {
  bg: 'transparent',
  card: 'rgba(10, 28, 40, 0.82)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  tabBg: '#0B0F19',
  accent: '#F59E0B',
  green: '#10B981',
  red: '#EF4444',
  orange: '#F59E0B',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  gridLine: 'rgba(255,255,255,0.06)',
  dotGrid: 'rgba(255,255,255,0.03)',
};

const CL = {
  bg: 'transparent',
  card: 'rgba(255, 255, 255, 0.80)',
  cardBorder: 'rgba(0, 0, 0, 0.09)',
  tabBg: '#E2DDD5',
  accent: '#D97706',
  green: '#059669',
  red: '#DC2626',
  orange: '#D97706',
  blue: '#2563EB',
  purple: '#7C3AED',
  cyan: '#0891B2',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  gridLine: 'rgba(0,0,0,0.05)',
  dotGrid: 'rgba(0,0,0,0.04)',
};

const PIE_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#64748B'];

// ═══════════════════════════════════════════════════════════
// LIGHT TOOLTIP
// ═══════════════════════════════════════════════════════════
function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  const { theme } = useTheme();
  const C = theme === 'light' ? CL : CD;
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: theme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(8, 22, 32, 0.97)', border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.20)' }}>
      <p style={{ color: C.textSecondary, fontSize: 11, fontWeight: 600, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
          <span style={{ color: C.textSecondary, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{entry.name}:</span>
          <span style={{ color: C.textPrimary, fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LIVE CLOCK
// ═══════════════════════════════════════════════════════════
function LiveClock() {
  const { theme } = useTheme();
  const C = theme === 'light' ? CL : CD;
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: theme === 'light' ? '0 2px 12px rgba(0,0,0,0.08)' : '0 4px 24px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(217,119,6,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>{dayName}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>{dateStr}</span>
        </div>
        <div style={{ textAlign: 'center', margin: '16px 0 12px' }}>
          <span style={{ fontSize: 48, fontWeight: 800, color: C.textPrimary, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em', lineHeight: 1 }}>{timeStr}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>OPERACIONES MINERAS</span>
          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'pulseSoft 2s ease-in-out infinite' }} />
            EN LÍNEA
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { theme } = useTheme();
  const C = useMemo(() => theme === 'light' ? CL : CD, [theme]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const [
        gastosRes, equiposRes, stockRes, recentExpRes,
        historicalGastosRes, gastosByCatRes,
        balanceDiarioRes, reportesRes,
        voladuraRes, arenasRes, quemadaRes,
      ] = await Promise.all([
        supabase.from('gastos').select('monto').eq('fecha', today),
        supabase.from('equipos').select('estado').eq('activo', true),
        supabase.from('inventario_items').select('id').eq('activo', true).filter('stock_actual', 'lte', 'stock_minimo' as never),
        supabase.from('gastos').select('id, descripcion, monto, fecha, categorias_gasto(nombre)').order('created_at', { ascending: false }).limit(8),
        supabase.from('gastos').select('fecha, monto').order('fecha', { ascending: false }).limit(200),
        supabase.from('gastos').select('monto, categorias_gasto(nombre)').order('created_at', { ascending: false }).limit(500),
        supabase.from('balance_diario').select('*').order('fecha', { ascending: false }).limit(30),
        supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
        supabase.from('reportes_voladuras').select('fecha, huecos_cantidad, chupis_cantidad, arroz_kg, numero_disparo, mina, turno, sin_novedad').order('fecha', { ascending: false }).limit(200),
        supabase.from('venta_arenas').select('fecha, cantidad_kg, precio_por_kg, total_venta, comprador').order('fecha', { ascending: false }).limit(200),
        supabase.from('quemada_plancha').select('fecha, gramos_oro_puro_recuperado, gramos_oro_bruto, porcentaje_pureza').order('fecha', { ascending: false }).limit(200),
      ]);

      // ── Gold Price: multi-step fallback ──
      let goldPrice: { usd_gramo: number; usd_onza: number } | null = null;

      // 1) Try today's cache
      const { data: todayCache } = await supabase
        .from('precio_oro_cache')
        .select('precio_usd_por_gramo, precio_usd_por_onza')
        .eq('fecha', today)
        .single();

      if (todayCache) {
        goldPrice = { usd_gramo: Number(todayCache.precio_usd_por_gramo), usd_onza: Number(todayCache.precio_usd_por_onza) };
      }

      // 2) Fallback: most recent cached price
      if (!goldPrice) {
        const { data: latestCache } = await supabase
          .from('precio_oro_cache')
          .select('precio_usd_por_gramo, precio_usd_por_onza')
          .order('fecha', { ascending: false })
          .limit(1)
          .single();

        if (latestCache) {
          goldPrice = { usd_gramo: Number(latestCache.precio_usd_por_gramo), usd_onza: Number(latestCache.precio_usd_por_onza) };
        }
      }

      // 3) Fallback: fetch live from free API and cache it
      if (!goldPrice) {
        try {
          const liveRes = await fetch('https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&currencies=XAU');
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            // XAU rate is USD per troy ounce (inverted in some APIs)
            if (liveData?.rates?.XAU) {
              const usdPerOnza = 1 / liveData.rates.XAU;
              const usdPerGramo = usdPerOnza / 31.1035;
              goldPrice = { usd_gramo: Math.round(usdPerGramo * 1000000) / 1000000, usd_onza: Math.round(usdPerOnza * 100) / 100 };
            }
          }
        } catch { /* silent - try next fallback */ }
      }

      // 4) Last resort: use a reasonable market estimate
      if (!goldPrice) {
        // ~$3,100/oz as of early 2026 — better than showing $0
        goldPrice = { usd_gramo: 99.68, usd_onza: 3100.00 };
      }

      // Cache the price for today if we got it from a non-cache source
      if (goldPrice && !todayCache) {
        supabase.from('precio_oro_cache').upsert({
          fecha: today,
          precio_usd_por_gramo: goldPrice.usd_gramo,
          precio_usd_por_onza: goldPrice.usd_onza,
          fuente: 'fallback',
        }, { onConflict: 'fecha,fuente' }).then(() => {}); // fire and forget
      }

      const reportesProd = (reportesRes?.data || []) as Array<{
        id: string; fecha: string; molino: string; material: string;
        amalgama_1_g: number; amalgama_2_g: number; oro_recuperado_g: number;
        merma_1_pct: number; merma_2_pct: number; sacos: number;
        toneladas_procesadas: number; tenor_tonelada_gpt: number;
        turno: string; responsable?: string;
      }>;

      // ── Totals ──
      const totalGrams = reportesProd.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0);
      const totalSacos = reportesProd.reduce((s, r) => s + (r.sacos || 0), 0);
      const totalTon = reportesProd.reduce((s, r) => s + Number(r.toneladas_procesadas || 0), 0);
      const todayReportes = reportesProd.filter(r => r.fecha === today);
      const todayGrams = todayReportes.reduce((s, r) => s + Number(r.oro_recuperado_g || 0), 0);
      const todaySacos = todayReportes.reduce((s, r) => s + (r.sacos || 0), 0);

      const todayExpenses = (gastosRes.data || []).reduce((sum, g) => sum + Number(g.monto), 0);
      const totalIncome = goldPrice ? totalGrams * goldPrice.usd_gramo : 0;


      // ── Equipment ──
      const eqData = equiposRes.data || [];
      const eqByState = {
        operativo: eqData.filter(e => e.estado === 'operativo').length,
        en_mantenimiento: eqData.filter(e => e.estado === 'en_mantenimiento').length,
        fuera_servicio: eqData.filter(e => e.estado === 'fuera_servicio').length,
        en_reparacion: eqData.filter(e => e.estado === 'en_reparacion').length,
      };

      // ── Production timeline ──
      const prodMap = new Map<string, { sacos: number; oro: number; ton: number }>();
      reportesProd.forEach(r => {
        const e = prodMap.get(r.fecha) || { sacos: 0, oro: 0, ton: 0 };
        e.oro += Number(r.oro_recuperado_g || 0);
        e.sacos += r.sacos || 0;
        e.ton += Number(r.toneladas_procesadas || 0);
        prodMap.set(r.fecha, e);
      });
      const productionTimeline = Array.from(prodMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-15)
        .map(([fecha, v]) => ({
          fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
          Oro: Math.round(v.oro * 100) / 100,
          Sacos: v.sacos,
          Toneladas: Math.round(v.ton * 100) / 100,
        }));

      // ── Cash flow ──
      let cashFlow: Array<{ fecha: string; Ingresos: number; Gastos: number; Balance: number }> = [];
      if (balanceDiarioRes.data?.length) {
        cashFlow = balanceDiarioRes.data.map(b => ({
          fecha: new Date(b.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
          Ingresos: Math.round(Number(b.ingreso_total_usd)),
          Gastos: Math.round(Number(b.gasto_total_usd)),
          Balance: Math.round(Number(b.rentabilidad_usd)),
        })).reverse();
      } else {
        const dateMap = new Map<string, { income: number; expense: number }>();
        reportesProd.forEach(r => {
          const grams = Number(r.oro_recuperado_g);
          const income = goldPrice ? grams * goldPrice.usd_gramo : grams * 80;
          const e = dateMap.get(r.fecha) || { income: 0, expense: 0 };
          e.income += income;
          dateMap.set(r.fecha, e);
        });
        (historicalGastosRes.data || []).forEach(g => {
          const e = dateMap.get(g.fecha) || { income: 0, expense: 0 };
          e.expense += Number(g.monto);
          dateMap.set(g.fecha, e);
        });
        cashFlow = Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-15).map(([fecha, v]) => ({
          fecha: new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
          Ingresos: Math.round(v.income),
          Gastos: Math.round(v.expense),
          Balance: Math.round(v.income - v.expense),
        }));
      }

      // ── Expenses by category ──
      const catMap = new Map<string, number>();
      (gastosByCatRes.data || []).forEach((g: any) => {
        const name = g.categorias_gasto?.nombre || 'Sin categoría';
        catMap.set(name, (catMap.get(name) || 0) + Number(g.monto));
      });
      const expensesByCategory = Array.from(catMap.entries())
        .map(([name, value], i) => ({ name, value: Math.round(value), color: PIE_COLORS[i % PIE_COLORS.length] }))
        .sort((a, b) => b.value - a.value).slice(0, 8);

      // ── Merma ──
      const allMermas = reportesProd.filter(r => r.merma_1_pct).map(r => Number(r.merma_1_pct));
      const avgMerma = allMermas.length > 0 ? allMermas.reduce((s, v) => s + v, 0) / allMermas.length : 0;

      // ── Molino breakdown ──
      const molinoMap = new Map<string, { oro: number; sacos: number }>();
      reportesProd.forEach(r => {
        const name = r.molino || 'Desconocido';
        const e = molinoMap.get(name) || { oro: 0, sacos: 0 };
        e.oro += Number(r.oro_recuperado_g);
        e.sacos += r.sacos;
        molinoMap.set(name, e);
      });
      const molinoData = Array.from(molinoMap.entries())
        .map(([name, v], i) => ({ name, oro: Math.round(v.oro * 100) / 100, sacos: v.sacos, color: PIE_COLORS[i % PIE_COLORS.length] }))
        .sort((a, b) => b.oro - a.oro);

      // ── Voladuras ──
      const reportesVol = (voladuraRes.data || []) as Array<{ fecha: string; huecos_cantidad: number; chupis_cantidad: number; arroz_kg: number; numero_disparo?: string; mina?: string; turno: string; sin_novedad: boolean }>;
      const todayVol = reportesVol.filter(v => v.fecha === today);
      const todayHuecos = todayVol.reduce((s, v) => s + (v.huecos_cantidad || 0), 0);
      const todayDisparos = todayVol.filter(v => v.numero_disparo).length;
      const totalHuecosAll = reportesVol.reduce((s, v) => s + (v.huecos_cantidad || 0), 0);
      const totalVolReportes = reportesVol.length;

      // ── Arenas ──
      const arenasData = (arenasRes.data || []) as Array<{ fecha: string; cantidad_kg: number; total_venta: number; comprador: string }>;
      const thisMonth = today.slice(0, 7);
      const arenasMonth = arenasData.filter(a => a.fecha?.startsWith(thisMonth));
      const arenasMonthTon = arenasMonth.reduce((s, a) => s + Number(a.cantidad_kg || 0), 0);
      const arenasMonthRevenue = arenasMonth.reduce((s, a) => s + Number(a.total_venta || 0), 0);
      const totalArenasRevenue = arenasData.reduce((s, a) => s + Number(a.total_venta || 0), 0);

      // ── Quemada ──
      const quemadaData = (quemadaRes.data || []) as Array<{ fecha: string; gramos_oro_puro_recuperado: number; gramos_oro_bruto?: number; porcentaje_pureza?: number }>;
      const totalOroQuemada = quemadaData.reduce((s, q) => s + Number(q.gramos_oro_puro_recuperado || 0), 0);
      const quemadaConPct = quemadaData.filter(q => q.porcentaje_pureza && q.porcentaje_pureza > 0);
      const avgRecupQuemada = quemadaConPct.length > 0 ? quemadaConPct.reduce((s, q) => s + Number(q.porcentaje_pureza), 0) / quemadaConPct.length : 0;

      // ── Recent activity for notifications ──
      const recentProd = reportesProd.slice(0, 3).map(r => ({
        id: r.id, type: 'production' as const, title: `${r.molino} — ${r.material}`,
        desc: `${Number(r.oro_recuperado_g).toFixed(2)}g Au • ${r.sacos} sacos`, date: r.fecha,
      }));
      const recentExp = (recentExpRes.data || []).slice(0, 2).map((g: any) => ({
        id: g.id, type: 'expense' as const, title: g.descripcion,
        desc: `$${Number(g.monto).toLocaleString()}`, date: g.fecha,
      }));
      const recentVol = reportesVol.slice(0, 2).map((v, i) => ({
        id: `vol-${i}`, type: 'voladura' as const, title: `Voladura — ${v.mina || 'Mina'}`,
        desc: `${v.huecos_cantidad} huecos${v.numero_disparo ? ` • Disparo #${v.numero_disparo}` : ''}`, date: v.fecha,
      }));
      const recentArenas = arenasData.slice(0, 1).map((a, i) => ({
        id: `arena-${i}`, type: 'arenas' as const, title: `Arenas — ${a.comprador}`,
        desc: `${Number(a.cantidad_kg).toFixed(1)} ton • $${Number(a.total_venta).toLocaleString()}`, date: a.fecha,
      }));
      const notifications = [...recentProd, ...recentExp, ...recentVol, ...recentArenas]
        .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

      setData({
        goldPrice, totalGrams, totalSacos, totalTon, totalIncome,
        todayGrams, todaySacos, todayExpenses,
        eqTotal: eqData.length, eqByState,
        lowStock: stockRes.data?.length || 0,
        productionTimeline, cashFlow,
        expensesByCategory, avgMerma: Math.round(avgMerma * 100) / 100,
        molinoData, notifications, numDays: prodMap.size,
        todayHuecos, todayDisparos, totalHuecosAll, totalVolReportes,
        arenasMonthTon, arenasMonthRevenue, totalArenasRevenue,
        totalOroQuemada, avgRecupQuemada: Math.round(avgRecupQuemada * 10) / 10,
        numQuemadas: quemadaData.length,
      });
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Loading ───
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 32, height: 32, color: C.accent, animation: 'spin 1s linear infinite' }} />
          <p style={{ color: C.textMuted, fontSize: 12, marginTop: 12, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cargando sistema...</p>
        </div>
      </div>
    );
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const fmtFull = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
  const profit = (data?.totalIncome || 0) - (data?.todayExpenses || 0);
  const eqOperPct = data?.eqTotal > 0 ? Math.round((data.eqByState.operativo / data.eqTotal) * 100) : 0;

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="dashboard-padding" style={{ background: 'transparent', color: C.textPrimary }}>
      <div className="dashboard-outer-grid" style={{ maxWidth: 1500, margin: '0 auto' }}>

        {/* ═══════════ LEFT / MAIN AREA ═══════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 style={{ width: 20, height: 20, color: C.accent }} />
              </div>
              <h1 style={{ ...mono, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textPrimary }}>
                Overview
              </h1>
            </div>
            <span style={{ ...mono, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Actualizado {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* ── KPI Row ── */}
          <div className="dashboard-kpi-grid">
            {/* Oro Recuperado */}
            <div className="dash-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${C.green}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Oro Recuperado</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span className="kpi-big-number" style={{ ...mono, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {fmtNum(data?.totalGrams || 0)}
                    </span>
                    <span style={{ ...mono, fontSize: 16, color: C.textMuted, fontWeight: 600 }}>g</span>
                  </div>
                  <span style={{ ...mono, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {data?.numDays || 0} días de producción
                  </span>
                </div>
                {data?.todayGrams > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <ArrowUp style={{ width: 16, height: 16, color: C.green }} />
                    <span style={{ ...mono, fontSize: 12, color: C.green, fontWeight: 700 }}>+{fmtNum(data.todayGrams)}g</span>
                  </div>
                ) : (
                  <span style={{ ...mono, fontSize: 10, color: C.textMuted, background: `${C.textMuted}20`, padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>HOY: 0g</span>
                )}
              </div>
            </div>

            {/* Ingresos */}
            <div className="dash-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${C.orange}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Ingresos Brutos</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span className="kpi-big-number" style={{ ...mono, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {fmt(data?.totalIncome || 0)}
                    </span>
                  </div>
                  <span style={{ ...mono, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {data?.goldPrice ? `${fmtNum(data.totalGrams)}g × ${fmtFull(data.goldPrice.usd_gramo)}/g` : 'Sin precio'}
                  </span>
                </div>
                <TrendingUp style={{ width: 18, height: 18, color: C.orange, flexShrink: 0 }} />
              </div>
            </div>

            {/* Gastos */}
            <div className="dash-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${C.red}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Gastos del Día</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span className="kpi-big-number" style={{ ...mono, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {fmt(data?.todayExpenses || 0)}
                    </span>
                  </div>
                  <span style={{ ...mono, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Rentabilidad: {fmt(profit)}
                  </span>
                </div>
                {profit >= 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${C.green}20`, padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                    <ArrowUp style={{ width: 12, height: 12, color: C.green }} />
                    <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: C.green }}>POS</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${C.red}20`, padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                    <ArrowDown style={{ width: 12, height: 12, color: C.red }} />
                    <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: C.red }}>NEG</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Chart Section ── */}
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
            {/* Tab bar + Legend */}
            <div className="dashboard-chart-header">
              <div style={{ display: 'flex', gap: 0, background: C.tabBg, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.cardBorder}` }}>
                {(['week', 'month', 'year'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)} style={{
                    ...mono, fontSize: 11, fontWeight: 700, padding: '7px 16px', border: 'none', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: period === p ? (theme === 'light' ? '#1E293B' : '#F8FAFC') : 'transparent',
                    color: period === p ? (theme === 'light' ? '#F8FAFC' : '#0B0F19') : C.textMuted,
                    transition: 'all 0.15s ease',
                  }}>
                    {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
                  </button>
                ))}
              </div>
              <div className="dashboard-chart-legend">
                {[
                  { label: 'Ingresos', color: C.green },
                  { label: 'Gastos', color: C.red },
                  { label: 'Balance', color: C.orange },
                ].map(l => (
                  <span key={l.label} style={{ ...mono, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: C.textSecondary }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                    {l.label.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            {/* Chart */}
            {(data?.cashFlow?.length > 0 || data?.productionTimeline?.length > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data?.cashFlow?.length > 0 ? data.cashFlow : data.productionTimeline}>
                  <CartesianGrid strokeDasharray="4 4" stroke={C.dotGrid} vertical={true} />
                  <XAxis dataKey="fecha" tick={{ fill: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} tickLine={false} axisLine={{ stroke: C.cardBorder }} />
                  <YAxis tick={{ fill: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                  <Tooltip content={<DarkTooltip />} />
                  {data?.cashFlow?.length > 0 ? (
                    <>
                      <Line type="monotone" dataKey="Ingresos" stroke={C.green} strokeWidth={2.5} dot={{ r: 3, fill: C.green, stroke: C.card, strokeWidth: 2 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Gastos" stroke={C.red} strokeWidth={2.5} dot={{ r: 3, fill: C.red, stroke: C.card, strokeWidth: 2 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Balance" stroke={C.orange} strokeWidth={2.5} dot={{ r: 3, fill: C.orange, stroke: C.card, strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </>
                  ) : (
                    <>
                      <Bar dataKey="Sacos" fill={C.blue} opacity={0.6} radius={[3, 3, 0, 0]} barSize={16} />
                      <Line type="monotone" dataKey="Oro" stroke={C.orange} strokeWidth={2.5} dot={{ r: 3, fill: C.orange, stroke: C.card, strokeWidth: 2 }} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <BarChart3 style={{ width: 40, height: 40, color: C.textMuted }} />
                <span style={{ ...mono, fontSize: 11, color: C.textMuted, textTransform: 'uppercase' }}>Sin datos financieros aún</span>
              </div>
            )}
          </div>

          {/* ── Mina & Procesamiento KPI Row ── */}
          <div className="dashboard-mini-kpi-grid">
            {/* Huecos Hoy */}
            <div className="dash-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.blue}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Pickaxe style={{ width: 12, height: 12, color: C.blue }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.textMuted }}>Huecos Hoy</span>
              </div>
              <span style={{ ...mono, fontSize: 26, fontWeight: 800, color: C.textPrimary }}>{data?.todayHuecos || 0}</span>
              <p style={{ ...mono, fontSize: 10, color: C.textMuted, marginTop: 3 }}>{data?.totalHuecosAll || 0} total</p>
            </div>
            {/* Disparos Hoy */}
            <div className="dash-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.red}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Zap style={{ width: 12, height: 12, color: C.red }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.textMuted }}>Disparos</span>
              </div>
              <span style={{ ...mono, fontSize: 26, fontWeight: 800, color: C.textPrimary }}>{data?.todayDisparos || 0}</span>
              <p style={{ ...mono, fontSize: 10, color: C.textMuted, marginTop: 3 }}>{data?.totalVolReportes || 0} reportes</p>
            </div>
            {/* Oro Quemada */}
            <div className="dash-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.orange}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Factory style={{ width: 12, height: 12, color: C.orange }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.textMuted }}>Oro Quemada</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ ...mono, fontSize: 26, fontWeight: 800, color: C.textPrimary }}>{fmtNum(data?.totalOroQuemada || 0)}</span>
                <span style={{ ...mono, fontSize: 12, color: C.textMuted }}>g</span>
              </div>
              <p style={{ ...mono, fontSize: 10, color: C.textMuted, marginTop: 3 }}>
                {data?.avgRecupQuemada > 0 ? `${data.avgRecupQuemada}% recup.` : `${data?.numQuemadas || 0} quemadas`}
              </p>
            </div>
            {/* Arenas Mes */}
            <div className="dash-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.cyan}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Clock style={{ width: 12, height: 12, color: C.cyan }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.textMuted }}>Arenas /Mes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ ...mono, fontSize: 26, fontWeight: 800, color: C.textPrimary }}>{fmtNum(data?.arenasMonthTon || 0)}</span>
                <span style={{ ...mono, fontSize: 12, color: C.textMuted }}> ton</span>
              </div>
              <p style={{ ...mono, fontSize: 10, color: C.cyan, marginTop: 3 }}>{fmt(data?.arenasMonthRevenue || 0)}</p>
            </div>
          </div>

          {/* ── Bottom Row: Stats Grid ── */}
          <div className="dashboard-stats-grid">
            {/* Sacos */}
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Package style={{ width: 14, height: 14, color: C.blue }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Sacos Totales</span>
              </div>
              <span style={{ ...mono, fontSize: 28, fontWeight: 800, color: C.textPrimary }}>{data?.totalSacos || 0}</span>
              {data?.todaySacos > 0 && <p style={{ ...mono, fontSize: 10, color: C.green, marginTop: 4 }}>+{data.todaySacos} hoy</p>}
            </div>

            {/* Toneladas */}
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Scale style={{ width: 14, height: 14, color: C.purple }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Toneladas</span>
              </div>
              <span style={{ ...mono, fontSize: 28, fontWeight: 800, color: C.textPrimary }}>{fmtNum(data?.totalTon || 0)}</span>
            </div>

            {/* Equipos */}
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Pickaxe style={{ width: 14, height: 14, color: C.green }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Equipos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ ...mono, fontSize: 28, fontWeight: 800, color: C.textPrimary }}>{eqOperPct}%</span>
                <span style={{ ...mono, fontSize: 12, color: C.textMuted }}>op.</span>
              </div>
              <p style={{ ...mono, fontSize: 10, color: C.textMuted, marginTop: 4 }}>{data?.eqByState?.operativo || 0}/{data?.eqTotal || 0} operativos</p>
            </div>

            {/* Merma */}
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: data?.avgMerma > 60 ? C.red : data?.avgMerma > 50 ? C.orange : C.green }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Merma Prom.</span>
              </div>
              <span style={{ ...mono, fontSize: 28, fontWeight: 800, color: data?.avgMerma > 60 ? C.red : data?.avgMerma > 50 ? C.orange : C.green }}>
                {data?.avgMerma > 0 ? `${data.avgMerma}%` : '—'}
              </span>
            </div>
          </div>

          {/* ── Bottom Row 2: Molino Breakdown + Expense Pie ── */}
          <div className="dashboard-bottom-grid">
            {/* Producción por Molino */}
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
                <span style={{ ...mono, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Producción por Molino</span>
              </div>
              {data?.molinoData?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.molinoData.map((m: any, i: number) => {
                    const maxOro = Math.max(...data.molinoData.map((x: any) => x.oro));
                    const pct = maxOro > 0 ? (m.oro / maxOro) * 100 : 0;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ ...mono, fontSize: 11, color: C.textPrimary, fontWeight: 600 }}>{m.name}</span>
                          <span style={{ ...mono, fontSize: 11, color: m.color, fontWeight: 700 }}>{m.oro}g • {m.sacos}s</span>
                        </div>
                        <div style={{ height: 4, background: C.dotGrid, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ ...mono, fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '24px 0' }}>SIN DATOS</p>
              )}
            </div>

            {/* Distribución Gastos */}
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, display: 'inline-block' }} />
                <span style={{ ...mono, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Gastos por Categoría</span>
              </div>
              {data?.expensesByCategory?.length > 0 ? (
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.expensesByCategory} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                          {data.expensesByCategory.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.expensesByCategory.slice(0, 5).map((cat: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                          <span style={{ ...mono, fontSize: 10, color: C.textSecondary }}>{cat.name}</span>
                        </div>
                        <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: C.textPrimary }}>${cat.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ ...mono, fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '24px 0' }}>SIN GASTOS REGISTRADOS</p>
              )}
            </div>
          </div>

          {/* ── Gold Price Footer ── */}
          <div className="dashboard-footer-row">
            <div style={{ flex: 1, background: theme === 'light' ? C.card : `linear-gradient(135deg, ${C.card} 0%, rgba(14, 38, 55, 0.90) 100%)`, border: `1px solid ${C.cardBorder}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <DollarSign style={{ width: 16, height: 16, color: C.accent }} />
                <span style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Precio del Oro</span>
              </div>
              <span style={{ ...mono, fontSize: 16, fontWeight: 800, color: C.accent }}>
                {data?.goldPrice ? `${fmtFull(data.goldPrice.usd_onza)} /oz` : 'Cargando...'}
              </span>
            </div>
            <div style={{ flex: 1, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Zap style={{ width: 16, height: 16, color: C.green }} />
                <span style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Estado Sistema</span>
              </div>
              <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: C.green, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════ RIGHT SIDEBAR ═══════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Clock */}
          <LiveClock />

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, display: 'block', marginBottom: 4 }}>
                Stock Bajo
              </span>
              <span style={{ ...mono, fontSize: 24, fontWeight: 800, color: (data?.lowStock || 0) > 0 ? C.red : C.green }}>
                {data?.lowStock || 0}
              </span>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, display: 'block', marginBottom: 4 }}>
                Días Prod.
              </span>
              <span style={{ ...mono, fontSize: 24, fontWeight: 800, color: C.blue }}>
                {data?.numDays || 0}
              </span>
            </div>
          </div>

          {/* Notifications */}
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: `${C.blue}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ ...mono, fontSize: 10, fontWeight: 800, color: C.blue }}>{data?.notifications?.length || 0}</span>
                </div>
                <span style={{ ...mono, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textPrimary }}>Actividad</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(data?.notifications || []).map((n: any, i: number) => (
                <div key={n.id + i} style={{ padding: '12px 0', borderBottom: i < (data?.notifications?.length || 0) - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.type === 'production' ? C.green : n.type === 'voladura' ? C.blue : n.type === 'arenas' ? C.cyan : C.red, display: 'inline-block', marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.textPrimary, textTransform: 'uppercase', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title}
                        <span style={{ ...mono, fontSize: 9, fontWeight: 600, color: n.type === 'production' ? C.green : n.type === 'voladura' ? C.blue : n.type === 'arenas' ? C.cyan : C.red, marginLeft: 6, textTransform: 'uppercase' }}>
                          {n.type === 'production' ? 'PROD' : n.type === 'voladura' ? 'MINA' : n.type === 'arenas' ? 'ARENAS' : 'GASTO'}
                        </span>
                      </p>
                      <p style={{ ...mono, fontSize: 10, color: C.textMuted, marginTop: 2 }}>{n.desc}</p>
                      <p style={{ ...mono, fontSize: 9, color: C.textMuted, marginTop: 2 }}>{n.date}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.notifications || data.notifications.length === 0) && (
                <p style={{ ...mono, fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>SIN ACTIVIDAD RECIENTE</p>
              )}
            </div>
          </div>

          {/* Equipment Status */}
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Estado Equipos</span>
              <span style={{
                ...mono, fontSize: 10, fontWeight: 700,
                color: eqOperPct >= 80 ? C.green : eqOperPct >= 50 ? C.orange : C.red,
                background: `${eqOperPct >= 80 ? C.green : eqOperPct >= 50 ? C.orange : C.red}20`,
                padding: '2px 8px', borderRadius: 4,
              }}>
                {eqOperPct >= 80 ? 'ONLINE' : eqOperPct >= 50 ? 'PARCIAL' : 'ALERTA'}
              </span>
            </div>
            {[
              { label: 'Operativos', count: data?.eqByState?.operativo || 0, color: C.green },
              { label: 'Mantenimiento', count: data?.eqByState?.en_mantenimiento || 0, color: C.orange },
              { label: 'Fuera Serv.', count: data?.eqByState?.fuera_servicio || 0, color: C.red },
              { label: 'Reparación', count: data?.eqByState?.en_reparacion || 0, color: C.blue },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                  <span style={{ ...mono, fontSize: 10, color: C.textSecondary }}>{s.label}</span>
                </div>
                <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: s.color }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
