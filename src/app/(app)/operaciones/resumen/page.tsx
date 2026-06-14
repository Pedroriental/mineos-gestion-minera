/**
 * Resumen Ejecutivo — Server Component con animaciones Framer Motion
 *
 * Patrón RSC + Client Islands de animación:
 *   page.tsx (Server) → obtiene datos via RPCs PostgreSQL
 *                     → pasa JSX children a wrappers Client de FM
 *   FadeIn / StaggerGrid / StaggerItem → Client Components animados
 */

import {
  getRentabilidad,
  getProduccionDiaria,
  getGastosPorCategoria,
} from '@/lib/rpc/rentabilidad';
import { createServerClient } from '@/lib/supabase-server';
import { getNominaAggregationForPeriod } from '@/lib/nomina/nomina-read-model.server';
import { monthBounds, sumNominaByArea } from '@/lib/nomina/nomina-read-model';
import { FadeIn, StaggerGrid, StaggerItem, FadeInSection } from '@/components/ui/motion';
import {
  TrendingUp, TrendingDown, Gem, DollarSign,
  Factory, Pickaxe, Scale, Target, Calendar, ArrowRight, Users, ArrowLeftRight,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ResumenViewportShell } from '@/components/resumen/ResumenViewportShell';
import { mineosKpiGlow, mineosKpiValue, type MineosTone } from '@/lib/mineos-visual';

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

type KpiGlow = 'amber' | 'emerald' | 'neutral' | 'red';

function glowToTone(glow: KpiGlow): MineosTone {
  if (glow === 'amber') return 'general';
  if (glow === 'emerald') return 'benefit';
  if (glow === 'red') return 'expense';
  return 'neutral';
}

type KpiMetric = {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  glow: KpiGlow;
};

const GASTO_BAR_TONES: MineosTone[] = ['benefit', 'general', 'neutral', 'expense', 'benefit'];

// ── Next.js 16 App Router ─────────────────────────────────────
type SearchParams = Promise<{ desde?: string; hasta?: string }>;
interface PageProps { searchParams: SearchParams }

// ─────────────────────────────────────────────────────────────
export default async function ResumenEjecutivoPage({ searchParams }: PageProps) {
  const { desde: desdeParam, hasta: hastaParam } = await searchParams;
  const now = new Date();
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultBounds = monthBounds(defaultMes);
  const desde = desdeParam && hastaParam ? desdeParam : defaultBounds.desde;
  const hasta = desdeParam && hastaParam ? hastaParam : defaultBounds.hasta;

  const supabase = await createServerClient();

  const [rent, prodDiaria, gastosCat, nominaAgg] = await Promise.all([
    getRentabilidad(desde, hasta),
    getProduccionDiaria(desde, hasta),
    getGastosPorCategoria(desde, hasta),
    getNominaAggregationForPeriod(supabase, { from: desde, to: hasta }),
  ]);

  const nominaPlantaUsd = sumNominaByArea(nominaAgg, 'planta');
  const nominaMinaUsd = sumNominaByArea(nominaAgg, 'mina');
  const nominaAdminUsd = sumNominaByArea(nominaAgg, 'administracion');
  const nominaTotalUsd = nominaAgg.totalUsd;
  const semanasNomina = nominaAgg.rowCount;
  const valorOroPlantaUsd = rent.oro_planta_g * rent.precio_usd_gramo;
  const balanceTotalUsd = valorOroPlantaUsd - nominaTotalUsd;
  const coberturaTotalPct =
    nominaTotalUsd > 0 ? (valorOroPlantaUsd / nominaTotalUsd) * 100 : valorOroPlantaUsd > 0 ? 100 : 0;
  const gramosPorMilNomina =
    nominaTotalUsd > 0 ? rent.oro_planta_g / (nominaTotalUsd / 1000) : 0;

  const isProfitable = rent.es_rentable;
  const activeLabel = desde && hasta ? `${desde} a ${hasta}` : 'Histórico General';

  const flowTotal = Math.max(valorOroPlantaUsd + nominaTotalUsd, 1);
  const oroBarPct = (valorOroPlantaUsd / flowTotal) * 100;
  const nominaBarPct = (nominaTotalUsd / flowTotal) * 100;

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
              <stop offset="0%" stopColor="var(--mineos-general-bright)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--mineos-general-bright)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={0}
              y1={toY(maxOro * t)}
              x2={totalW}
              y2={toY(maxOro * t)}
              className="resumen-ejecutivo-page__chart-gridline"
              strokeWidth={1}
            />
          ))}
          <path d={areaPath} fill="url(#goldGrad)" />
          <polyline
            points={prodDiaria.map((d, i) => `${i * W + W / 2},${toY(Number(d.oro_g))}`).join(' ')}
            fill="none"
            className="resumen-ejecutivo-page__chart-line"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {prodDiaria.map((d, i) => {
            const oro   = Number(d.oro_g);
            const label = new Date(d.fecha + 'T12:00:00')
              .toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            return (
              <g key={i}>
                <circle
                  cx={i * W + W / 2}
                  cy={toY(oro)}
                  r={3.5}
                  className="resumen-ejecutivo-page__chart-dot"
                  strokeWidth={1.5}
                />
                {oro > 0 && (
                  <text
                    x={i * W + W / 2}
                    y={toY(oro) - 8}
                    textAnchor="middle"
                    fontSize={prodDiaria.length > 15 ? 7 : 9}
                    className="resumen-ejecutivo-page__chart-label-value"
                    fontWeight="700"
                  >
                    {oro < 100 ? oro.toFixed(1) : Math.round(oro)}
                  </text>
                )}
                <text
                  x={i * W + W / 2}
                  y={H + 16}
                  textAnchor="middle"
                  fontSize={prodDiaria.length > 20 ? 6 : 8}
                  className="resumen-ejecutivo-page__chart-label-date"
                  fontWeight="500"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  })();

  const metalKpis: KpiMetric[] = [
    {
      icon: <Gem className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />,
      label: 'Oro recuperado',
      value: `${fmtNum(rent.oro_planta_g)} g`,
      sub: `≈ ${fmtNum(rent.prom_diario_g)} g/día en molino`,
      glow: 'amber',
    },
    {
      icon: <Factory className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />,
      label: 'Toneladas',
      value: `${fmtNum(rent.ton_procesadas)} t`,
      sub: `${fmtNum(rent.sacos_total)} sacos procesados`,
      glow: 'amber',
    },
    {
      icon: <Pickaxe className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />,
      label: 'Quemado real',
      value: `${fmtNum(rent.oro_quemado_g, 4)} g`,
      sub: `Amalgama: ${fmtNum(rent.amalgama_total_g, 2)} g`,
      glow: 'amber',
    },
    {
      icon: <Target className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />,
      label: 'Ley cabeza',
      value: fmtNum(rent.ley_cabeza_gpt, 3),
      sub: 'g Au / t procesada',
      glow: 'amber',
    },
  ];

  const economiaKpis: KpiMetric[] = [
    {
      icon: <DollarSign className="h-3.5 w-3.5 text-[var(--mineos-benefit)]" />,
      label: 'Ingreso bruto',
      value: fmt(rent.ingreso_bruto_usd),
      sub: `Gastos operativos: ${fmt(rent.gastos_total_usd)}`,
      glow: 'emerald',
    },
    {
      icon: <Scale className="h-3.5 w-3.5 text-[var(--text-muted)]" />,
      label: 'Costo / g',
      value: `$${fmtNum(rent.costo_por_gramo, 2)}`,
      sub: `Margen unitario: $${fmtNum(rent.precio_usd_gramo - rent.costo_por_gramo, 2)}/g`,
      glow: 'neutral',
    },
    {
      icon: <Users className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />,
      label: 'Nómina total',
      value: fmt(nominaTotalUsd),
      sub:
        semanasNomina > 0
          ? `Molino ${fmt(nominaPlantaUsd)} · Mina ${fmt(nominaMinaUsd)} · Admin ${fmt(nominaAdminUsd)}`
          : 'Sin nómina cerrada en el período',
      glow: 'amber',
    },
    {
      icon: <ArrowLeftRight className="h-3.5 w-3.5 text-[var(--mineos-benefit)]" />,
      label: 'Balance Au / nómina',
      value: fmt(balanceTotalUsd),
      sub: `${fmtNum(coberturaTotalPct, 0)}% cobertura · ${fmtNum(gramosPorMilNomina, 1)} g por $1k nómina`,
      glow: balanceTotalUsd >= 0 ? 'emerald' : 'red',
    },
  ];

  const bottomCards: Array<{
    title: string;
    accent: 'amber' | 'emerald' | 'red';
    href: string;
    rows: { label: string; value: string | number }[];
  }> = [
    {
      title:  'Producción planta',
      accent: 'emerald',
      href:   '/planta/produccion',
      rows: [
        { label: 'Turnos registrados', value: prodDiaria.reduce((s, d) => s + d.turnos, 0) },
        { label: 'Sacos procesados',   value: fmtNum(rent.sacos_total, 0) },
        { label: 'Toneladas',          value: `${fmtNum(rent.ton_procesadas, 2)} t` },
        { label: 'Prom. diario',       value: `${fmtNum(rent.prom_diario_g)} g/día` },
      ],
    },
    {
      title:  'Quemada de plancha',
      accent: 'amber',
      href:   '/mina/quemado',
      rows: [
        { label: 'Au recuperado (real)', value: `${fmtNum(rent.oro_quemado_g, 4)} g` },
        { label: 'Amalgama total',       value: `${fmtNum(rent.amalgama_total_g, 2)} g` },
        { label: 'Precio oro ref.',      value: `${fmtFull(rent.precio_usd_gramo)}/g` },
        { label: 'Ingreso estimado',     value: fmt(rent.ingreso_bruto_usd) },
      ],
    },
    {
      title:  'Análisis de costos',
      accent: isProfitable ? 'emerald' : 'red',
      href:   '/admin/gastos',
      rows: [
        { label: 'Gastos totales', value: fmt(rent.gastos_total_usd) },
        { label: 'Costo / gramo',  value: `$${fmtNum(rent.costo_por_gramo, 2)}` },
        { label: 'Margen neto',    value: `${fmtNum(rent.margen_pct, 1)}%` },
        { label: 'Resultado',      value: `${isProfitable ? '+' : ''}${fmt(rent.ganancia_usd)}` },
      ],
    },
  ];

  function renderKpi(metric: KpiMetric, key: string) {
    const tone = glowToTone(metric.glow);
    return (
      <StaggerItem key={key} className="resumen-ejecutivo-page__kpi-item h-full min-h-0 min-w-0">
        <div className="resumen-ejecutivo-page__kpi card-glass gerencial-kpi-card h-full min-h-0 min-w-0 rounded-lg p-2.5 sm:rounded-xl sm:p-3">
          <div className={mineosKpiGlow(tone)} aria-hidden />
          <div className="resumen-ejecutivo-page__kpi-head relative flex items-center gap-1.5">
            {metric.icon}
            <span className="resumen-ejecutivo-page__kpi-label truncate">{metric.label}</span>
          </div>
          <p className={`resumen-ejecutivo-page__kpi-value ${mineosKpiValue(tone)} relative truncate`}>
            {metric.value}
          </p>
          <p className="resumen-ejecutivo-page__kpi-sub relative line-clamp-2">
            {metric.sub ?? '\u00A0'}
          </p>
        </div>
      </StaggerItem>
    );
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="resumen-ejecutivo-page flex min-h-0 w-full flex-1 flex-col overflow-hidden print:space-y-4">

      <ResumenViewportShell>
      <div className="resumen-ejecutivo-page__body min-h-0 flex-1 overflow-hidden">
        <div className="resumen-ejecutivo-page__content min-h-0 flex-1">
          {/* Hero: tesis operativa — resultado + cadena mina→molino + referencia oro */}
          <FadeIn delay={0.08} className="shrink-0">
            <div
              className={`resumen-ejecutivo-page__hero card-glass overflow-hidden rounded-xl sm:rounded-2xl ${
                isProfitable
                  ? 'resumen-ejecutivo-page__hero--profit'
                  : 'resumen-ejecutivo-page__hero--loss'
              }`}
            >
              <div className="resumen-ejecutivo-page__hero-top">
                <p className="resumen-ejecutivo-page__hero-eyebrow">Sala de control · Rentabilidad</p>
                <p className="resumen-ejecutivo-page__hero-period">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{activeLabel}</span>
                  <span className="resumen-ejecutivo-page__hero-period-sep" aria-hidden>·</span>
                  <span className="shrink-0">
                    {rent.dias_con_produccion} día{rent.dias_con_produccion !== 1 ? 's' : ''} con producción
                  </span>
                </p>
              </div>

              <div className="resumen-ejecutivo-page__hero-main">
                <div className="resumen-ejecutivo-page__hero-result">
                  <span className="resumen-ejecutivo-page__hero-result-label">Resultado neto</span>
                  <div className="resumen-ejecutivo-page__hero-result-row">
                    <div
                      className={`resumen-ejecutivo-page__hero-result-icon ${
                        isProfitable ? 'resumen-ejecutivo-page__hero-result-icon--profit' : 'resumen-ejecutivo-page__hero-result-icon--loss'
                      }`}
                    >
                      {isProfitable ? (
                        <TrendingUp className="h-5 w-5" aria-hidden />
                      ) : (
                        <TrendingDown className="h-5 w-5" aria-hidden />
                      )}
                    </div>
                    <h2
                      className={`resumen-ejecutivo-page__ganancia resumen-ejecutivo-page__hero-result-value ${
                        isProfitable ? 'resumen-ejecutivo-page__hero-result-value--profit' : 'resumen-ejecutivo-page__hero-result-value--loss'
                      }`}
                    >
                      {isProfitable ? '+' : ''}
                      {fmt(rent.ganancia_usd)}
                    </h2>
                  </div>
                  <span
                    className={`resumen-ejecutivo-page__hero-badge ${
                      isProfitable ? 'resumen-ejecutivo-page__hero-badge--profit' : 'resumen-ejecutivo-page__hero-badge--loss'
                    }`}
                  >
                    {isProfitable ? 'Operación rentable' : 'Operación en pérdida'}
                    {' · '}
                    {fmtNum(Math.abs(rent.margen_pct), 1)}% margen
                  </span>
                  <p className="resumen-ejecutivo-page__hero-result-meta">
                    Ingresos {fmt(rent.ingreso_bruto_usd)} · Gastos {fmt(rent.gastos_total_usd)}
                  </p>
                </div>

                <div className="resumen-ejecutivo-page__hero-chain">
                  <span className="resumen-ejecutivo-page__hero-chain-label">Cadena de valor</span>
                  <div className="resumen-ejecutivo-page__hero-flow">
                    <div className="resumen-ejecutivo-page__hero-flow-node">
                      <Pickaxe className="h-3.5 w-3.5" aria-hidden />
                      <span className="resumen-ejecutivo-page__hero-flow-title">Mina</span>
                      <span className="resumen-ejecutivo-page__hero-flow-value">{fmtNum(rent.oro_quemado_g, 3)} g Au</span>
                    </div>
                    <ChevronRight className="resumen-ejecutivo-page__hero-flow-arrow h-4 w-4 shrink-0" aria-hidden />
                    <div className="resumen-ejecutivo-page__hero-flow-node resumen-ejecutivo-page__hero-flow-node--highlight">
                      <Factory className="h-3.5 w-3.5" aria-hidden />
                      <span className="resumen-ejecutivo-page__hero-flow-title">Molino</span>
                      <span className="resumen-ejecutivo-page__hero-flow-value">{fmtNum(rent.oro_planta_g)} g Au</span>
                    </div>
                  </div>
                  <div className="resumen-ejecutivo-page__balance-bridge">
                    <div className="resumen-ejecutivo-page__balance-bar" role="img" aria-label={`Oro ${fmt(valorOroPlantaUsd)} frente a nómina ${fmt(nominaTotalUsd)}`}>
                      <div
                        className="resumen-ejecutivo-page__balance-segment resumen-ejecutivo-page__balance-segment--oro"
                        style={{ width: `${oroBarPct}%` }}
                      />
                      <div
                        className="resumen-ejecutivo-page__balance-segment resumen-ejecutivo-page__balance-segment--nomina"
                        style={{ width: `${nominaBarPct}%` }}
                      />
                    </div>
                    <div className="resumen-ejecutivo-page__balance-legend">
                      <span>
                        <i className="resumen-ejecutivo-page__balance-dot resumen-ejecutivo-page__balance-dot--oro" aria-hidden />
                        Oro molino {fmt(valorOroPlantaUsd)}
                      </span>
                      <span>
                        <i className="resumen-ejecutivo-page__balance-dot resumen-ejecutivo-page__balance-dot--nomina" aria-hidden />
                        Nómina {fmt(nominaTotalUsd)}
                      </span>
                      <span className="resumen-ejecutivo-page__balance-coverage">
                        {fmtNum(coberturaTotalPct, 0)}% cobertura
                      </span>
                    </div>
                  </div>
                </div>

                <div className="resumen-ejecutivo-page__hero-ref resumen-ejecutivo-page__precio-oro--accent">
                  <span className="resumen-ejecutivo-page__hero-ref-label">Precio referencia</span>
                  <p className="resumen-ejecutivo-page__hero-ref-oz">
                    {fmtFull(rent.precio_usd_gramo * 31.1)}
                    <span className="resumen-ejecutivo-page__hero-ref-unit">/oz</span>
                  </p>
                  <p className="resumen-ejecutivo-page__hero-ref-g">{fmtFull(rent.precio_usd_gramo)}/g</p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* KPIs agrupados | gráfico + gastos */}
          <div className="resumen-ejecutivo-page__split min-h-0">
            <StaggerGrid delay={0.18} className="resumen-ejecutivo-page__kpis grid h-full min-h-0">
              <StaggerItem className="resumen-ejecutivo-page__kpi-section-head">
                <h3 className="resumen-ejecutivo-page__kpi-section-title">
                  <Gem className="h-3 w-3" aria-hidden />
                  Metal del molino
                </h3>
              </StaggerItem>
              {metalKpis.map((m, i) => renderKpi(m, `metal-${i}`))}
              <StaggerItem className="resumen-ejecutivo-page__kpi-section-head">
                <h3 className="resumen-ejecutivo-page__kpi-section-title">
                  <Scale className="h-3 w-3" aria-hidden />
                  Economía operativa
                </h3>
              </StaggerItem>
              {economiaKpis.map((m, i) => renderKpi(m, `econ-${i}`))}
            </StaggerGrid>

            <FadeInSection delay={0.5} className="resumen-ejecutivo-page__charts-col min-h-0 h-full">
              <div className="resumen-ejecutivo-page__chart card-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl p-3 sm:p-3.5">
                <div className="resumen-ejecutivo-page__panel-head">
                  <h3 className="resumen-ejecutivo-page__panel-title">
                    <TrendingUp className="h-4 w-4 text-[var(--mineos-general-bright)]" aria-hidden />
                    Ritmo diario de oro
                  </h3>
                  <span className="resumen-ejecutivo-page__panel-meta">Gramos recuperados por día</span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  {chartNode ?? (
                    <p className="resumen-ejecutivo-page__empty">Sin datos de producción en el período</p>
                  )}
                </div>
              </div>

              <div className="resumen-ejecutivo-page__gastos card-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl p-3 sm:p-3.5">
                <div className="resumen-ejecutivo-page__panel-head">
                  <h3 className="resumen-ejecutivo-page__panel-title">
                    <DollarSign className="h-4 w-4 text-[var(--mineos-benefit)]" aria-hidden />
                    Gastos por categoría
                  </h3>
                  <span className="resumen-ejecutivo-page__panel-meta">{gastosCat.length} categorías</span>
                </div>
                {gastosCat.length > 0 ? (
                  <>
                    <div
                      className="resumen-ejecutivo-page__gastos-scroll min-h-0 flex-1"
                      role="region"
                      aria-label="Listado de gastos por categoría"
                      title="Desplaza para ver más categorías"
                    >
                      <div className="resumen-ejecutivo-page__gastos-list space-y-2.5 pr-0.5">
                        {gastosCat.map((cat, i) => {
                          const tone = GASTO_BAR_TONES[i % GASTO_BAR_TONES.length];
                          return (
                            <div key={cat.categoria}>
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="resumen-ejecutivo-page__gasto-name truncate">{cat.categoria}</span>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="resumen-ejecutivo-page__gasto-amount">{fmt(cat.total_usd)}</span>
                                  <span className="resumen-ejecutivo-page__gasto-pct">{cat.pct}%</span>
                                </div>
                              </div>
                              <div className="resumen-ejecutivo-page__gasto-track">
                                <div
                                  className={`resumen-ejecutivo-page__gasto-fill resumen-ejecutivo-page__gasto-fill--${tone}`}
                                  style={{ width: `${cat.pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="resumen-ejecutivo-page__gastos-total">
                      <span>Total operativo</span>
                      <span>{fmt(rent.gastos_total_usd)}</span>
                    </div>
                  </>
                ) : (
                  <p className="resumen-ejecutivo-page__empty">Sin gastos registrados</p>
                )}
              </div>
            </FadeInSection>
          </div>
        </div>

        {/* Módulos operativos — acceso rápido */}
        <StaggerGrid delay={0.72} className="resumen-ejecutivo-page__summary-row shrink-0">
          {bottomCards.map((card) => (
            <StaggerItem
              key={card.title}
              className={`resumen-ejecutivo-page__summary-card resumen-ejecutivo-page__summary-card--${card.accent} card-glass group min-h-0 overflow-hidden rounded-xl p-0`}
            >
              <Link href={card.href} className="resumen-ejecutivo-page__summary-link">
                <div className="resumen-ejecutivo-page__summary-header">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`resumen-ejecutivo-page__summary-accent resumen-ejecutivo-page__summary-accent--${card.accent}`} aria-hidden />
                    <span className="resumen-ejecutivo-page__summary-title truncate">{card.title}</span>
                  </div>
                  <ArrowRight className="resumen-ejecutivo-page__summary-arrow h-4 w-4 shrink-0" aria-hidden />
                </div>
                <div className="resumen-ejecutivo-page__summary-body">
                  <div className="resumen-ejecutivo-page__summary-feature">
                    <span className="resumen-ejecutivo-page__summary-feature-value">{String(card.rows[0].value)}</span>
                    <span className="resumen-ejecutivo-page__summary-feature-label">{card.rows[0].label}</span>
                  </div>
                  <div className="resumen-ejecutivo-page__summary-metrics">
                    {card.rows.slice(1).map((row) => (
                      <div key={row.label} className="min-w-0">
                        <span className="resumen-ejecutivo-page__summary-metric-label">{row.label}</span>
                        <span className="resumen-ejecutivo-page__summary-metric-value">{String(row.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
      </ResumenViewportShell>

      <div className="hidden pt-2 text-center text-xs text-[var(--text-muted)] print:block">
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
