/**
 * Resumen Ejecutivo — Server Component con animaciones Framer Motion
 *
 * Patrón RSC + Client Islands de animación:
 *   page.tsx (Server) → obtiene datos via RPCs PostgreSQL
 *                     → pasa JSX children a wrappers Client de FM
 *   FadeIn / StaggerGrid / StaggerItem → Client Components animados
 *   PeriodSelector → Client island interactivo
 *
 * Los wrappers de FM NUNCA hacen fetch — solo animan su children.
 */

import {
  getRentabilidad,
  getProduccionDiaria,
  getGastosPorCategoria,
  type PeriodoDias,
} from '@/lib/rpc/rentabilidad';
import PeriodSelector from './PeriodSelector';
import { FadeIn, StaggerGrid, StaggerItem, FadeInSection } from '@/components/ui/motion';
import {
  FileText, TrendingUp, TrendingDown, Gem, DollarSign,
  Factory, Pickaxe, Scale, Target, Calendar,
} from 'lucide-react';

// ── Helpers de formato ────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtNum(n: number, d = 2) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);
}

// ── Next.js 16 App Router ─────────────────────────────────────
type SearchParams = Promise<{ period?: string }>;
interface PageProps { searchParams: SearchParams }

// ─────────────────────────────────────────────────────────────
export default async function ResumenEjecutivoPage({ searchParams }: PageProps) {
  const { period: periodParam } = await searchParams;
  const period = ([7, 15, 30, 90].includes(Number(periodParam))
    ? Number(periodParam) : 30) as PeriodoDias;

  // 3 RPCs en paralelo — PostgreSQL hace el cálculo pesado
  const [rent, prodDiaria, gastosCat] = await Promise.all([
    getRentabilidad(period),
    getProduccionDiaria(period),
    getGastosPorCategoria(period),
  ]);

  const isProfitable = rent.es_rentable;
  const periodLabel: Record<string, string> = {
    '7': 'Últimos 7 días', '15': 'Últimos 15 días',
    '30': 'Últimos 30 días', '90': 'Últimos 90 días',
  };

  // ── SVG chart nativo ─────────────────────────────────────────
  const chartNode = (() => {
    if (prodDiaria.length === 0) return null;
    const maxOro  = Math.max(...prodDiaria.map((d) => Number(d.oro_g)), 1);
    const W = 100, H = 140, PAD = 2;
    const totalW  = prodDiaria.length * W;
    const toY     = (v: number) => H - PAD - Math.max((v / maxOro) * (H - PAD * 2 - 24), 1);
    const areaPath = [
      `M 0,${H}`,
      ...prodDiaria.map((d, i) => `L ${i * W + W / 2},${toY(Number(d.oro_g))}`),
      `L ${(prodDiaria.length - 1) * W + W / 2},${H}`,
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
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#F59E0B" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <line key={t} x1={0} y1={toY(maxOro * t)} x2={totalW} y2={toY(maxOro * t)}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}
          <path d={areaPath} fill="url(#goldGrad)" />
          <polyline
            points={prodDiaria.map((d, i) => `${i * W + W / 2},${toY(Number(d.oro_g))}`).join(' ')}
            fill="none" stroke="#F59E0B" strokeWidth={1.8}
            strokeLinejoin="round" strokeLinecap="round"
          />
          {prodDiaria.map((d, i) => {
            const oro   = Number(d.oro_g);
            const label = new Date(d.fecha + 'T12:00:00')
              .toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            return (
              <g key={i}>
                <circle cx={i * W + W / 2} cy={toY(oro)} r={3}
                  fill="#F59E0B" stroke="#09090b" strokeWidth={1.5} />
                {oro > 0 && (
                  <text x={i * W + W / 2} y={toY(oro) - 7} textAnchor="middle"
                    fontSize={prodDiaria.length > 15 ? 7 : 9}
                    fill="rgba(245,158,11,0.75)" fontWeight="700">
                    {oro < 100 ? oro.toFixed(1) : Math.round(oro)}
                  </text>
                )}
                <text x={i * W + W / 2} y={H + 16} textAnchor="middle"
                  fontSize={prodDiaria.length > 20 ? 6 : 8}
                  fill="rgba(255,255,255,0.25)" fontWeight="500">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  })();

  // ── KPI data array (computado en servidor) ────────────────────
  const kpis = [
    {
      icon:  <Gem      className="w-4 h-4 text-amber-400" />,
      label: 'Oro Recuperado',
      value: `${fmtNum(rent.oro_planta_g)} g`,
      sub:   `≈ ${fmtNum(rent.prom_diario_g)} g/día`,
      color: 'text-amber-400',
    },
    {
      icon:  <Factory  className="w-4 h-4 text-blue-400" />,
      label: 'Toneladas',
      value: `${fmtNum(rent.ton_procesadas)} t`,
      sub:   `${fmtNum(rent.sacos_total)} sacos`,
      color: 'text-blue-400',
    },
    {
      icon:  <Target   className="w-4 h-4 text-cyan-400" />,
      label: 'Ley Cabeza',
      value: fmtNum(rent.ley_cabeza_gpt, 3),
      sub:   'g Au / t',
      color: 'text-cyan-400',
    },
    {
      icon:  <Scale    className="w-4 h-4 text-white/50" />,
      label: 'Costo / g',
      value: `$${fmtNum(rent.costo_por_gramo, 2)}`,
      sub:   `Margen: $${fmtNum(rent.precio_usd_gramo - rent.costo_por_gramo, 2)}/g`,
      color: 'text-white/80',
    },
    {
      icon:  <Pickaxe  className="w-4 h-4 text-orange-400" />,
      label: 'Quemado (real)',
      value: `${fmtNum(rent.oro_quemado_g, 4)} g`,
      sub:   `Amalgama: ${fmtNum(rent.amalgama_total_g, 2)} g`,
      color: 'text-orange-400',
    },
    {
      icon:  <DollarSign className="w-4 h-4 text-emerald-400" />,
      label: 'Ingreso Bruto',
      value: fmt(rent.ingreso_bruto_usd),
      sub:   `Gastos: ${fmt(rent.gastos_total_usd)}`,
      color: isProfitable ? 'text-emerald-400' : 'text-red-400',
    },
  ];

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 print:space-y-4">

      {/* ── Header (FadeIn delay=0) ── */}
      <FadeIn delay={0} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-xl sm:text-2xl flex items-center gap-2.5">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 flex-shrink-0" />
            Resumen Ejecutivo
          </h1>
          <p className="text-white/40 text-xs sm:text-sm mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {periodLabel[String(period)]} — {rent.dias_con_produccion} día{rent.dias_con_produccion !== 1 ? 's' : ''} con producción
          </p>
        </div>
        <PeriodSelector currentPeriod={String(period)} />
      </FadeIn>

      {/* ── Gold Banner (FadeIn delay=0.1) ── */}
      <FadeIn delay={0.1}>
        <div className={`card-glass rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-5 border-l-4 ${
          isProfitable ? 'border-l-emerald-400/60' : 'border-l-red-400/60'
        }`}>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isProfitable ? 'bg-emerald-500/15 border border-emerald-400/20' : 'bg-red-500/15 border border-red-400/20'
          }`}>
            {isProfitable
              ? <TrendingUp   className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              : <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
              <h2 className={`text-2xl sm:text-3xl font-black tracking-tight leading-none ${
                isProfitable ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {isProfitable ? '+' : ''}{fmt(rent.ganancia_usd)}
              </h2>
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isProfitable
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/25'
                  : 'text-red-400 bg-red-500/10 border-red-400/25'
              }`}>
                {isProfitable ? 'GANANCIA' : 'PÉRDIDA'} · {fmtNum(Math.abs(rent.margen_pct), 1)}% margen
              </span>
            </div>
            <p className="text-xs sm:text-sm text-white/45 leading-snug">
              Ingresos: <span className="text-white/65 font-medium">{fmt(rent.ingreso_bruto_usd)}</span>
              {' '}— Gastos: <span className="text-white/65 font-medium">{fmt(rent.gastos_total_usd)}</span>
            </p>
          </div>
          <div className="text-right hidden sm:block shrink-0 pl-4 border-l border-white/[0.07]">
            <span className="text-[10px] text-white/35 uppercase tracking-widest font-bold block mb-1">Precio Oro</span>
            <p className="text-xl font-black text-amber-400">{fmtFull(rent.precio_usd_gramo * 31.1)}/oz</p>
            <p className="text-xs text-white/40">{fmtFull(rent.precio_usd_gramo)}/g</p>
          </div>
        </div>
      </FadeIn>

      {/* ── KPI Grid (StaggerGrid — cascade desde delay=0.2) ── */}
      <StaggerGrid
        delay={0.2}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3"
      >
        {kpis.map((kpi, i) => (
          <StaggerItem key={i} className="card-glass rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-2 sm:mb-3">
              {kpi.icon}
              <span className="text-[9px] text-white/35 font-bold uppercase tracking-widest leading-tight truncate">
                {kpi.label}
              </span>
            </div>
            <p className={`text-lg sm:text-xl font-black leading-none mb-1 truncate ${kpi.color}`}>
              {kpi.value}
            </p>
            <p className="text-[9px] sm:text-[10px] text-white/35 truncate">{kpi.sub}</p>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* ── Chart + Costs (FadeInSection delay=0.55 — aparece después del grid) ── */}
      <FadeInSection delay={0.55} className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        <div className="lg:col-span-3 card-glass rounded-xl p-5">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-5 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Producción Diaria de Oro (g)
          </h3>
          {chartNode ?? (
            <p className="text-sm text-white/30 text-center py-10">
              Sin datos de producción en el período
            </p>
          )}
        </div>

        <div className="lg:col-span-2 card-glass rounded-xl p-5 flex flex-col">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-5 flex items-center gap-2 flex-shrink-0">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Gastos por Categoría
          </h3>
          {gastosCat.length > 0 ? (
            <div className="space-y-3.5 flex-1">
              {gastosCat.slice(0, 6).map((cat, i) => {
                const colors = ['#10B981','#3B82F6','#F59E0B','#8B5CF6','#EF4444','#06B6D4'];
                return (
                  <div key={cat.categoria}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-white/65 font-medium truncate pr-3">{cat.categoria}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-white/80">{fmt(cat.total_usd)}</span>
                        <span className="text-[10px] text-white/35 w-8 text-right">{cat.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${cat.pct}%`, background: colors[i % colors.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-white/30">Sin gastos registrados</p>
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Total</span>
            <span className="text-lg font-black text-white/90">{fmt(rent.gastos_total_usd)}</span>
          </div>
        </div>
      </FadeInSection>

      {/* ── Bottom stats (StaggerGrid delay=0.75) ── */}
      <StaggerGrid
        delay={0.75}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {[
          {
            title:  'Producción Planta',
            accent: '#10B981',
            rows: [
              { label: 'Turnos registrados', value: prodDiaria.reduce((s, d) => s + d.turnos, 0) },
              { label: 'Sacos procesados',   value: fmtNum(rent.sacos_total, 0) },
              { label: 'Toneladas',          value: `${fmtNum(rent.ton_procesadas, 2)} t` },
              { label: 'Prom. diario',       value: `${fmtNum(rent.prom_diario_g)} g/día` },
            ],
          },
          {
            title:  'Quemada de Plancha',
            accent: '#F59E0B',
            rows: [
              { label: 'Au recuperado (real)', value: `${fmtNum(rent.oro_quemado_g, 4)} g` },
              { label: 'Amalgama total',       value: `${fmtNum(rent.amalgama_total_g, 2)} g` },
              { label: 'Precio oro ref.',      value: `${fmtFull(rent.precio_usd_gramo)}/g` },
              { label: 'Ingreso estimado',     value: fmt(rent.ingreso_bruto_usd) },
            ],
          },
          {
            title:  'Análisis de Costos',
            accent: isProfitable ? '#10B981' : '#EF4444',
            rows: [
              { label: 'Gastos totales', value: fmt(rent.gastos_total_usd) },
              { label: 'Costo / gramo',  value: `$${fmtNum(rent.costo_por_gramo, 2)}` },
              { label: 'Margen neto',    value: `${fmtNum(rent.margen_pct, 1)}%` },
              { label: 'Resultado',      value: `${isProfitable ? '+' : ''}${fmt(rent.ganancia_usd)}` },
            ],
          },
        ].map((card) => (
          <StaggerItem
            key={card.title}
            className="card-glass rounded-xl p-5"
            style={{ borderTop: `2px solid ${card.accent}40` } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full" style={{ background: card.accent }} />
              <span className="text-[10px] text-white/45 font-bold uppercase tracking-widest">{card.title}</span>
            </div>
            <div className="space-y-2.5">
              {card.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{row.label}</span>
                  <span className="text-sm font-bold text-white/80">{String(row.value)}</span>
                </div>
              ))}
            </div>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* Print footer */}
      <div className="text-center text-xs text-white/25 pt-2 print:block hidden">
        Informe generado por MineOS — {new Date().toLocaleDateString('es-ES', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })}
      </div>
    </div>
  );
}
