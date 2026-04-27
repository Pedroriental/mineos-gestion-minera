'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { 
  ArrowUp, ArrowDown, TrendingUp, AlertTriangle, Zap, 
  Clock, BarChart3, Package, Scale, Pickaxe, Factory, DollarSign 
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, PieChart, Pie, Cell,
} from 'recharts';
import { StaggerGrid, StaggerItem, FadeIn, FadeInSection } from '@/components/ui/motion';

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
  const [now, setNow] = useState<Date | null>(null);
  
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <div style={{ height: 130, background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}` }} className="animate-pulse" />;

  const dayName = now.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase();
  const dateStr = now.toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
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
// MAIN CLIENT COMPONENT
// ═══════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DashboardClient({ data }: { data: any }) {
  const { theme } = useTheme();
  const C = useMemo(() => theme === 'light' ? CL : CD, [theme]);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const fmtFull = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
  
  const profit = (data?.totalIncome || 0) - (data?.todayExpenses || 0);
  const eqOperPct = data?.eqTotal > 0 ? Math.round((data.eqByState.operativo / data.eqTotal) * 100) : 0;

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div className="p-4 md:p-8 w-full max-w-[1500px] mx-auto min-h-screen" style={{ color: C.textPrimary }}>
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ═══════════ LEFT / MAIN AREA ═══════════ */}
        <div className="flex-1 flex flex-col gap-6">

          {/* ── Header ── */}
          <FadeIn className="flex flex-col sm:flex-row sm:items-center justify-between gap-2" delay={0.1}>
            <div className="flex items-center gap-3">
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 style={{ width: 20, height: 20, color: C.accent }} />
              </div>
              <h1 style={{ ...mono, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textPrimary }}>
                Overview
              </h1>
            </div>
            <span style={{ ...mono, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Actualizado hoy
            </span>
          </FadeIn>

          {/* ── KPI Row ── */}
          <StaggerGrid delay={0.2} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            
            {/* Oro Recuperado */}
            <StaggerItem>
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${C.green}`, borderRadius: 12, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Oro Recuperado</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ ...mono, fontSize: 32, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
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
            </StaggerItem>

            {/* Ingresos */}
            <StaggerItem>
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${C.orange}`, borderRadius: 12, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Ingresos Brutos</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ ...mono, fontSize: 32, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
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
            </StaggerItem>

            {/* Gastos */}
            <StaggerItem>
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${C.red}`, borderRadius: 12, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Gastos del Día</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ ...mono, fontSize: 32, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
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
            </StaggerItem>
          </StaggerGrid>

          {/* ── Chart Section ── */}
          <FadeInSection delay={0.4} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
              <div className="flex flex-wrap items-center gap-4">
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
            
            {(data?.cashFlow?.length > 0 || data?.productionTimeline?.length > 0) ? (
              <div className="w-full" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data?.cashFlow?.length > 0 ? data.cashFlow : data.productionTimeline}>
                    <CartesianGrid strokeDasharray="4 4" stroke={C.dotGrid} vertical={true} />
                    <XAxis dataKey="fecha" tick={{ fill: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} tickLine={false} axisLine={{ stroke: C.cardBorder }} />
                    <YAxis tick={{ fill: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} tickLine={false} axisLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: `${C.textMuted}10` }} />
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
              </div>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <BarChart3 style={{ width: 40, height: 40, color: C.textMuted }} />
                <span style={{ ...mono, fontSize: 11, color: C.textMuted, textTransform: 'uppercase' }}>Sin datos financieros aún</span>
              </div>
            )}
          </FadeInSection>

          {/* ── Mina & Procesamiento KPI Row ── */}
          <StaggerGrid delay={0.5} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StaggerItem>
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.blue}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Pickaxe style={{ width: 12, height: 12, color: C.blue }} />
                  <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.textMuted }}>Huecos Hoy</span>
                </div>
                <span style={{ ...mono, fontSize: 26, fontWeight: 800, color: C.textPrimary }}>{data?.todayHuecos || 0}</span>
                <p style={{ ...mono, fontSize: 10, color: C.textMuted, marginTop: 3 }}>{data?.totalHuecosAll || 0} total</p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.red}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Zap style={{ width: 12, height: 12, color: C.red }} />
                  <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.textMuted }}>Disparos</span>
                </div>
                <span style={{ ...mono, fontSize: 26, fontWeight: 800, color: C.textPrimary }}>{data?.todayDisparos || 0}</span>
                <p style={{ ...mono, fontSize: 10, color: C.textMuted, marginTop: 3 }}>{data?.totalVolReportes || 0} reportes</p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.orange}`, borderRadius: 12, padding: '16px 20px' }}>
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
            </StaggerItem>
            <StaggerItem>
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.cyan}`, borderRadius: 12, padding: '16px 20px' }}>
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
            </StaggerItem>
          </StaggerGrid>

          {/* ── Bottom Rows ── */}
          <FadeInSection delay={0.6} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Package style={{ width: 14, height: 14, color: C.blue }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Sacos Totales</span>
              </div>
              <span style={{ ...mono, fontSize: 28, fontWeight: 800, color: C.textPrimary }}>{data?.totalSacos || 0}</span>
              {data?.todaySacos > 0 && <p style={{ ...mono, fontSize: 10, color: C.green, marginTop: 4 }}>+{data.todaySacos} hoy</p>}
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Scale style={{ width: 14, height: 14, color: C.purple }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Toneladas</span>
              </div>
              <span style={{ ...mono, fontSize: 28, fontWeight: 800, color: C.textPrimary }}>{fmtNum(data?.totalTon || 0)}</span>
            </div>

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

            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: data?.avgMerma > 60 ? C.red : data?.avgMerma > 50 ? C.orange : C.green }} />
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Merma Prom.</span>
              </div>
              <span style={{ ...mono, fontSize: 28, fontWeight: 800, color: data?.avgMerma > 60 ? C.red : data?.avgMerma > 50 ? C.orange : C.green }}>
                {data?.avgMerma > 0 ? `${data.avgMerma}%` : '—'}
              </span>
            </div>
          </FadeInSection>

          {/* ── Bottom Row 2 ── */}
          <FadeInSection delay={0.7} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
                <span style={{ ...mono, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Producción por Molino</span>
              </div>
              {data?.molinoData?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.molinoData.map((m: { name: string; oro: number; sacos: number; color: string }, i: number) => {
                    const maxOro = Math.max(...data.molinoData.map((x: { oro: number }) => x.oro));
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

            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, display: 'inline-block' }} />
                <span style={{ ...mono, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Gastos por Categoría</span>
              </div>
              {data?.expensesByCategory?.length > 0 ? (
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.expensesByCategory} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                          {data.expensesByCategory.map((entry: { color: string }, i: number) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                    {data.expensesByCategory.slice(0, 5).map((cat: { name: string; value: number; color: string }, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ ...mono, fontSize: 10, color: C.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</span>
                        </div>
                        <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: C.textPrimary, flexShrink: 0 }}>${cat.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ ...mono, fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '24px 0' }}>SIN GASTOS REGISTRADOS</p>
              )}
            </div>
          </FadeInSection>

        </div>

        {/* ═══════════ RIGHT SIDEBAR ═══════════ */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-6 shrink-0">
          
          <FadeIn delay={0.2}>
            <LiveClock />
          </FadeIn>

          <FadeIn delay={0.3} className="grid grid-cols-2 gap-3">
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
          </FadeIn>

          <FadeIn delay={0.4} className="flex-1">
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: `${C.blue}20`, display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                    <span style={{ ...mono, fontSize: 10, fontWeight: 800, color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>{data?.notifications?.length || 0}</span>
                  </div>
                  <span style={{ ...mono, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textPrimary }}>Actividad</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {(data?.notifications || []).map((n: { id: string; title: string; desc: string; type: string }, i: number) => (
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
                        <p style={{ ...mono, fontSize: 10, color: C.textMuted, marginTop: 4 }}>{n.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {data?.notifications?.length === 0 && (
                  <p style={{ ...mono, fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '24px 0' }}>Sin actividad reciente</p>
                )}
              </div>
            </div>
          </FadeIn>

        </div>
      </div>
    </div>
  );
}
