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
} from '@/lib/rpc/rentabilidad';
import { createServerClient } from '@/lib/supabase-server';
import { FadeIn, StaggerGrid, StaggerItem, FadeInSection } from '@/components/ui/motion';
import {
  TrendingUp, TrendingDown, Gem, DollarSign,
  Factory, Pickaxe, Scale, Target, Calendar, ArrowRight, Users, ArrowLeftRight,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ResumenViewportShell } from '@/components/resumen/ResumenViewportShell';

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
type SearchParams = Promise<{ desde?: string; hasta?: string }>;
interface PageProps { searchParams: SearchParams }

// ─────────────────────────────────────────────────────────────
export default async function ResumenEjecutivoPage({ searchParams }: PageProps) {
  const { desde, hasta } = await searchParams;
  const hasParams = !!desde && !!hasta;

  const supabase = await createServerClient();
  let nominaQuery = supabase
    .from('nomina_semanas')
    .select('area, total_pagado, semana_inicio, semana_fin');

  if (hasParams) {
    nominaQuery = nominaQuery.lte('semana_inicio', hasta).gte('semana_fin', desde);
  }

  // RPCs + nóminas del período en paralelo
  const [rent, prodDiaria, gastosCat, { data: nominaSemanas }] = await Promise.all([
    getRentabilidad(desde, hasta),
    getProduccionDiaria(desde, hasta),
    getGastosPorCategoria(desde, hasta),
    nominaQuery,
  ]);

  const sumNominaArea = (area: string) =>
    (nominaSemanas ?? [])
      .filter((s) => (s.area || 'planta') === area)
      .reduce((acc, s) => acc + (Number(s.total_pagado) || 0), 0);

  const nominaPlantaUsd = sumNominaArea('planta');
  const nominaMinaUsd = sumNominaArea('mina');
  const nominaAdminUsd = sumNominaArea('administracion');
  const nominaTotalUsd = nominaPlantaUsd + nominaMinaUsd + nominaAdminUsd;
  const semanasNomina = (nominaSemanas ?? []).length;
  const valorOroPlantaUsd = rent.oro_planta_g * rent.precio_usd_gramo;
  const balanceTotalUsd = valorOroPlantaUsd - nominaTotalUsd;
  const coberturaTotalPct =
    nominaTotalUsd > 0 ? (valorOroPlantaUsd / nominaTotalUsd) * 100 : valorOroPlantaUsd > 0 ? 100 : 0;
  const gramosPorMilNomina =
    nominaTotalUsd > 0 ? rent.oro_planta_g / (nominaTotalUsd / 1000) : 0;

  const isProfitable = rent.es_rentable;
  const activeLabel = desde && hasta ? `${desde} a ${hasta}` : 'Histórico General';

  // ── SVG chart nativo ─────────────────────────────────────────
  const chartNode = (() => {
    if (prodDiaria.length === 0) return null;
    const maxOro  = Math.max(...prodDiaria.map((d) => Number(d.oro_g)), 1);
    const W = 100, H = 90, PAD = 2;
    const totalW  = prodDiaria.length * W;
    const toY     = (v: number) => H - PAD - Math.max((v / maxOro) * (H - PAD * 2 - 24), 1);
    const areaPath = [
      `M 0,${H}`,
      ...prodDiaria.map((d, i) => `L ${i * W + W / 2},${toY(Number(d.oro_g))}`),
      `L ${(prodDiaria.length - 1) * W + W / 2},${H}`,
      'Z',
    ].join(' ');

    return (
      <div className="resumen-ejecutivo-page__chart-viewport">
        <svg
          viewBox={`0 0 ${totalW} ${H + 20}`}
          className="resumen-ejecutivo-page__chart-svg"
          style={{ minWidth: Math.max(totalW, 260), display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
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

  // ── 8 indicadores en rejilla 2×4 (incl. balance oro vs nómina total) ──
  type KpiGlow =
    | 'amber' | 'blue' | 'orange' | 'cyan' | 'emerald' | 'neutral' | 'violet' | 'lime' | 'red';

  type KpiMetric = {
    icon: ReactNode;
    label: string;
    value: string;
    sub?: string;
    glow: KpiGlow;
  };

  const kpis: KpiMetric[] = [
    {
      icon: <Gem className="h-3 w-3 text-amber-400" />,
      label: 'Oro Recuperado',
      value: `${fmtNum(rent.oro_planta_g)} g`,
      sub: `≈ ${fmtNum(rent.prom_diario_g)} g/día`,
      glow: 'amber',
    },
    {
      icon: <Factory className="h-3 w-3 text-blue-400" />,
      label: 'Toneladas',
      value: `${fmtNum(rent.ton_procesadas)} t`,
      sub: `${fmtNum(rent.sacos_total)} sacos`,
      glow: 'blue',
    },
    {
      icon: <Pickaxe className="h-3 w-3 text-orange-400" />,
      label: 'Quemado (real)',
      value: `${fmtNum(rent.oro_quemado_g, 4)} g`,
      sub: `Amalgama: ${fmtNum(rent.amalgama_total_g, 2)} g`,
      glow: 'orange',
    },
    {
      icon: <Target className="h-3 w-3 text-cyan-400" />,
      label: 'Ley Cabeza',
      value: fmtNum(rent.ley_cabeza_gpt, 3),
      sub: 'g Au / t',
      glow: 'cyan',
    },
    {
      icon: <DollarSign className="h-3 w-3 text-emerald-400" />,
      label: 'Ingreso Bruto',
      value: fmt(rent.ingreso_bruto_usd),
      sub: `Gastos: ${fmt(rent.gastos_total_usd)}`,
      glow: 'emerald',
    },
    {
      icon: <Scale className="h-3 w-3 text-white/50" />,
      label: 'Costo / g',
      value: `$${fmtNum(rent.costo_por_gramo, 2)}`,
      sub: `Margen: $${fmtNum(rent.precio_usd_gramo - rent.costo_por_gramo, 2)}/g`,
      glow: 'neutral',
    },
    {
      icon: <Users className="h-3 w-3 text-violet-400" />,
      label: 'Nómina Total',
      value: fmt(nominaTotalUsd),
      sub:
        semanasNomina > 0
          ? `Molino ${fmt(nominaPlantaUsd)} · Mina ${fmt(nominaMinaUsd)} · Admin ${fmt(nominaAdminUsd)}`
          : 'Sin nómina cerrada en el período',
      glow: 'violet',
    },
    {
      icon: <ArrowLeftRight className="h-3 w-3 text-lime-400" />,
      label: 'Balance Au / Nómina',
      value: fmt(balanceTotalUsd),
      sub: `Oro ${fmt(valorOroPlantaUsd)} vs nómina · ${fmtNum(coberturaTotalPct, 0)}% · ${fmtNum(gramosPorMilNomina)} g/$1k`,
      glow: balanceTotalUsd >= 0 ? 'lime' : 'red',
    },
  ];

  const bottomCards = [
          {
            title:  'Producción Planta',
            accent: '#10B981',
            href:   '/planta/produccion',
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
            href:   '/mina/quemado',
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
            href:   '/admin/gastos',
            rows: [
              { label: 'Gastos totales', value: fmt(rent.gastos_total_usd) },
              { label: 'Costo / gramo',  value: `$${fmtNum(rent.costo_por_gramo, 2)}` },
              { label: 'Margen neto',    value: `${fmtNum(rent.margen_pct, 1)}%` },
              { label: 'Resultado',      value: `${isProfitable ? '+' : ''}${fmt(rent.ganancia_usd)}` },
            ],
          },
  ];

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="resumen-ejecutivo-page flex min-h-0 w-full flex-1 flex-col overflow-hidden print:space-y-4">

      <ResumenViewportShell>
      <div className="resumen-ejecutivo-page__body min-h-0 flex-1 overflow-hidden">
        <div className="resumen-ejecutivo-page__content min-h-0 flex-1">
          {/* Fila 1: tarjeta larga ganancia + precio oro */}
          <FadeIn delay={0.1} className="shrink-0">
            <div
              className={`resumen-ejecutivo-page__hero-bar card-glass grid overflow-hidden rounded-xl sm:rounded-2xl sm:grid-cols-[1fr_auto] ${
                isProfitable
                  ? 'resumen-ejecutivo-page__hero-bar--profit'
                  : 'resumen-ejecutivo-page__hero-bar--loss'
              }`}
            >
              <div className="resumen-ejecutivo-page__ganancia flex min-w-0 items-center gap-2.5 border-b border-white/[0.06] p-2.5 sm:border-b-0 sm:border-r sm:border-white/[0.08] sm:px-3.5 sm:py-2.5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
                    isProfitable
                      ? 'border border-emerald-400/20 bg-emerald-500/15'
                      : 'border border-red-400/20 bg-red-500/15'
                  }`}
                >
                  {isProfitable ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400 sm:h-5 sm:w-5" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400 sm:h-5 sm:w-5" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-3 lg:gap-6">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <h2
                      className={`text-lg font-black leading-none tracking-tight sm:text-xl lg:text-2xl ${
                        isProfitable ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isProfitable ? '+' : ''}
                      {fmt(rent.ganancia_usd)}
                    </h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        isProfitable
                          ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-400'
                          : 'border-red-400/25 bg-red-500/10 text-red-400'
                      }`}
                    >
                      {isProfitable ? 'GANANCIA' : 'PÉRDIDA'} · {fmtNum(Math.abs(rent.margen_pct), 1)}% margen
                    </span>
                  </div>
                  <div className="resumen-ejecutivo-page__ganancia-meta flex shrink-0 flex-col items-end text-right">
                    <p className="resumen-ejecutivo-page__period mb-0.5 flex items-center justify-end gap-1.5 text-[10px] text-white/40 sm:text-xs">
                      <Calendar className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                      <span className="max-w-[14rem] truncate sm:max-w-none">
                        {activeLabel} — {rent.dias_con_produccion} día{rent.dias_con_produccion !== 1 ? 's' : ''} con producción
                      </span>
                    </p>
                    <p className="text-[10px] leading-snug text-white/45 sm:text-xs">
                      Ingresos: <span className="font-medium text-white/65">{fmt(rent.ingreso_bruto_usd)}</span>
                      {' '}— Gastos: <span className="font-medium text-white/65">{fmt(rent.gastos_total_usd)}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="resumen-ejecutivo-page__precio-oro resumen-ejecutivo-page__precio-oro--accent flex shrink-0 flex-col justify-center border-t border-white/[0.06] px-3 py-2.5 sm:border-t-0 sm:px-4 sm:py-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">Precio Oro</span>
                <p className="text-base font-black leading-none text-amber-400 sm:text-lg">
                  {fmtFull(rent.precio_usd_gramo * 31.1)}
                  <span className="text-xs font-bold text-amber-400/80">/oz</span>
                </p>
                <p className="text-[10px] text-white/40 sm:text-xs">{fmtFull(rent.precio_usd_gramo)}/g</p>
              </div>
            </div>
          </FadeIn>

          {/* Fila 2: KPIs (izq) | gráfico + gastos (der) */}
          <div className="resumen-ejecutivo-page__split min-h-0">
            <StaggerGrid delay={0.2} className="resumen-ejecutivo-page__kpis grid h-full min-h-0 gap-1.5 sm:gap-2">
              {kpis.map((metric, i) => (
                <StaggerItem key={i} className="resumen-ejecutivo-page__kpi-item h-full min-h-0 min-w-0">
                  <div className="resumen-ejecutivo-page__kpi card-glass gerencial-kpi-card h-full min-h-0 min-w-0 rounded-lg p-2 sm:rounded-xl sm:p-2.5">
                    <div className={`gerencial-kpi-glow gerencial-kpi-glow--${metric.glow}`} aria-hidden />
                    <div className="resumen-ejecutivo-page__kpi-head relative flex items-center gap-1">
                      {metric.icon}
                      <span className="truncate text-[8px] font-bold uppercase leading-tight tracking-widest text-white/35">
                        {metric.label}
                      </span>
                    </div>
                    <p className={`resumen-ejecutivo-page__kpi-value gerencial-kpi-value gerencial-kpi-value--${metric.glow} relative truncate text-sm font-black leading-none`}>
                      {metric.value}
                    </p>
                    <p className="resumen-ejecutivo-page__kpi-sub relative line-clamp-2 text-[8px] leading-tight text-white/35">
                      {metric.sub ?? '\u00A0'}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGrid>

            <FadeInSection delay={0.55} className="resumen-ejecutivo-page__charts-col min-h-0 h-full">
              <div className="resumen-ejecutivo-page__chart card-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl p-3 sm:p-3.5">
                <h3 className="mb-2 flex shrink-0 items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> Producción Diaria de Oro (g)
                </h3>
                <div className="min-h-0 flex-1 overflow-hidden">
                  {chartNode ?? (
                    <p className="py-4 text-center text-sm text-white/30">Sin datos de producción en el período</p>
                  )}
                </div>
              </div>

              <div className="resumen-ejecutivo-page__gastos card-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl p-3 sm:p-3.5">
                <h3 className="mb-2 flex shrink-0 items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> Gastos por Categoría
                </h3>
                {gastosCat.length > 0 ? (
                  <>
                    <div
                      className="resumen-ejecutivo-page__gastos-scroll min-h-0 flex-1"
                      role="region"
                      aria-label="Listado de gastos por categoría"
                      title="Desplaza para ver más categorías"
                    >
                      <div className="resumen-ejecutivo-page__gastos-list space-y-2 pr-0.5">
                        {gastosCat.map((cat, i) => {
                          const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];
                          return (
                            <div key={cat.categoria}>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="truncate pr-2 text-[11px] font-medium text-white/65">{cat.categoria}</span>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="text-[11px] font-bold text-white/80">{fmt(cat.total_usd)}</span>
                                  <span className="w-8 text-right text-[10px] text-white/35">{cat.pct}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${cat.pct}%`, background: colors[i % colors.length] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-2 flex shrink-0 items-center justify-between border-t border-white/[0.07] pt-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/40">Total</span>
                      <span className="text-sm font-black text-white/90 sm:text-base">{fmt(rent.gastos_total_usd)}</span>
                    </div>
                  </>
                ) : (
                  <p className="py-3 text-center text-sm text-white/30">Sin gastos registrados</p>
                )}
              </div>
            </FadeInSection>
          </div>
        </div>

        {/* Franja inferior: 3 tarjetas horizontales */}
        <StaggerGrid delay={0.75} className="resumen-ejecutivo-page__summary-row shrink-0">
          {bottomCards.map((card) => {
            const summaryAccent =
              card.accent === '#F59E0B'
                ? 'amber'
                : card.accent === '#EF4444'
                  ? 'red'
                  : 'emerald';
            return (
            <StaggerItem
              key={card.title}
              className={`resumen-ejecutivo-page__summary-card resumen-ejecutivo-page__summary-card--${summaryAccent} card-glass group min-h-0 overflow-hidden rounded-xl p-0`}
            >
              <Link href={card.href} className="flex h-full min-h-0 flex-col justify-center p-3 transition-colors hover:bg-white/[0.02] sm:p-3.5">
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`resumen-ejecutivo-page__summary-accent resumen-ejecutivo-page__summary-accent--${summaryAccent} h-3.5 w-1 rounded-full`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/45 transition-colors group-hover:text-white/70">
                      {card.title}
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-white/20 transition-colors group-hover:text-white/60" />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
                  {card.rows.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <span className="block truncate text-[10px] text-white/40">{row.label}</span>
                      <span className="block truncate text-xs font-bold text-white/80">{String(row.value)}</span>
                    </div>
                  ))}
                </div>
              </Link>
            </StaggerItem>
            );
          })}
        </StaggerGrid>
      </div>
      </ResumenViewportShell>

      <div className="hidden pt-2 text-center text-xs text-white/25 print:block">
        Informe generado por MineOS —{' '}
        {new Date().toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </div>
    </div>
  );
}
