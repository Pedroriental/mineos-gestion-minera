'use client';

import { useCallback, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calculator,
  Calendar,
  DollarSign,
  Factory,
  Pickaxe,
  Users,
  X,
  Loader2,
  Scale,
} from 'lucide-react';
import { AppMonthPicker } from '@/components/ui/AppMonthPicker';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { Tabs } from '@/components/ui/Tabs';
import CompensacionTab from './CompensacionTab';
import InversoresTab from './InversoresTab';
import BalanceProdGastosTab from './BalanceProdGastosTab';
import type {
  GastosResumenSummary,
  GastosResumenPeriod,
  GastosResumenCategoriaTotal,
  GastosResumenDiaRow,
  GastosResumenNominaSemana,
} from '@/lib/gastos-resumen';

type Props = {
  summary: GastosResumenSummary;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtShort = (n: number) => {
  return fmt(n);
};

const AREA_LABELS: Record<string, string> = {
  mina: 'Mina',
  planta: 'Molino',
  administracion: 'Administración',
};

export default function GastosResumenClient({ summary }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const { period, mina, molino, nomina, combined, daily, nominaSemanas } = summary;

  const pushFilters = useCallback(
    (nextMes: string, nextDia: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextMes) params.set('mes', nextMes);
      else params.delete('mes');
      if (nextDia) params.set('dia', nextDia);
      else params.delete('dia');
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/admin/gastos/resumen?${qs}` : '/admin/gastos/resumen');
      });
    },
    [router, searchParams],
  );

  const dayOptions = useMemo(() => {
    const [y, m] = period.mes.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => {
      const d = i + 1;
      const iso = `${period.mes}-${String(d).padStart(2, '0')}`;
      return iso;
    });
  }, [period.mes]);

  const pct = (part: number) =>
    combined.total > 0 ? Math.round((part / combined.total) * 100) : 0;

  return (
    <div className="gastos-page gastos-resumen-page flex min-h-0 w-full flex-1 flex-col">
      <Tabs
        tabs={[
          { key: 'resumen', label: 'Resumen', icon: <DollarSign className="h-3 w-3" /> },
          { key: 'compensacion', label: 'Compensación', icon: <Calculator className="h-3 w-3" /> },
          { key: 'inversores', label: 'Inversores', icon: <Users className="h-3 w-3" /> },
          { key: 'balance_prod_gastos', label: 'Balance Prod/Gastos', icon: <Scale className="h-3 w-3" /> },
        ]}
        className="gastos-resumen-page__tabs"
      >
        {(activeTab) => {
          if (activeTab === 'compensacion') {
            return <CompensacionTab initialMes={period.mes} initialDia={period.dia} />;
          }
          if (activeTab === 'inversores') {
            return <InversoresTab />;
          }
          if (activeTab === 'balance_prod_gastos') {
            return <BalanceProdGastosTab initialMes={period.mes} initialDia={period.dia} />;
          }
          return (
            <ResumenTab
              period={period}
              pushFilters={pushFilters}
              isPending={isPending}
              dayOptions={dayOptions}
              daily={daily}
              combined={combined}
              mina={mina}
              molino={molino}
              nomina={nomina}
              nominaSemanas={nominaSemanas}
              pct={pct}
              fmt={fmt}
              fmtShort={fmtShort}
            />
          );
        }}
      </Tabs>
    </div>
  );
}

type ResumenTabProps = {
  period: GastosResumenPeriod;
  pushFilters: (mes: string, dia: string | null) => void;
  isPending: boolean;
  dayOptions: string[];
  daily: GastosResumenDiaRow[];
  combined: { total: number; count: number };
  mina: GastosResumenCategoriaTotal;
  molino: GastosResumenCategoriaTotal;
  nomina: { total: number; semanas: number; trabajadores: number };
  nominaSemanas: GastosResumenNominaSemana[];
  pct: (part: number) => number;
  fmt: (n: number) => string;
  fmtShort: (n: number) => string;
};

function ResumenTab({
  period,
  pushFilters,
  isPending,
  dayOptions,
  daily,
  combined,
  mina,
  molino,
  nomina,
  nominaSemanas,
  pct,
  fmt,
  fmtShort,
}: ResumenTabProps) {
  return (
    <div className="gastos-resumen-page__grid min-h-0 flex-1 custom-scrollbar">
      <aside className="gastos-resumen-page__filters app-surface-card flex flex-col gap-3 p-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
          Período
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
            <Calendar className="h-3 w-3" aria-hidden /> Mes
          </label>
          <AppMonthPicker
            value={period.mes}
            onChange={(val) => pushFilters(val, null)}
            placeholder="Seleccionar mes..."
            className="gastos-resumen-page__month-picker w-full min-w-0"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
            <Calendar className="h-3 w-3" aria-hidden /> Día (opcional)
          </label>
          <div className="flex items-center gap-2">
            <AppDatePicker
              value={period.dia ?? ''}
              onChange={(val) => {
                if (val.startsWith(period.mes)) pushFilters(period.mes, val);
              }}
              placeholder="Todo el mes"
              className="gastos-resumen-page__day-picker min-w-0 w-full flex-1"
            />
            {period.dia ? (
              <button
                type="button"
                onClick={() => pushFilters(period.mes, null)}
                className="gastos-page-btn shrink-0 rounded-lg p-1.5"
                aria-label="Quitar filtro de día"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        <p className="text-[11px] text-[var(--dashboard-text-muted)]">
          {period.label}
          {isPending ? (
            <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin opacity-60" aria-hidden />
          ) : null}
        </p>
        <div
          className="gastos-page__filter-scroll gastos-page__filter-scroll--months"
          role="region"
          aria-label="Atajos por día del mes"
        >
          <div className="gastos-page__filter-scroll-inner gastos-page__filter-scroll-inner--months">
            <button
              type="button"
              onClick={() => pushFilters(period.mes, null)}
              className={`gastos-filter-pill rounded-md border px-2 py-[3px] text-[9px] font-bold leading-tight transition-colors ${
                !period.dia ? 'gastos-filter-pill--month' : 'gastos-filter-pill--idle'
              }`}
            >
              Mes completo
            </button>
            {dayOptions
              .filter((d) => daily.some((row) => row.fecha === d))
              .slice(-14)
              .map((d) => {
                const dayNum = d.slice(8, 10);
                const active = period.dia === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => pushFilters(period.mes, d)}
                    className={`gastos-filter-pill rounded-md border px-2 py-[3px] text-[9px] font-bold leading-tight transition-colors ${
                      active ? 'gastos-filter-pill--month' : 'gastos-filter-pill--idle'
                    }`}
                  >
                    Día {dayNum}
                  </button>
                );
              })}
          </div>
        </div>
      </aside>

      <div className="gastos-resumen-page__main flex min-w-0 flex-col gap-2">
        <div className="app-surface-card gastos-kpi-card gastos-kpi-card--total relative overflow-hidden p-4">
          <div className="gastos-kpi-glow gastos-kpi-glow--total" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Total operativo — {period.label}
              </p>
              <p className="gastos-kpi-value gastos-kpi-value--total text-3xl font-black leading-none">
                {fmtShort(combined.total)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--dashboard-text-muted)]">
                Mina + Molino + Nómina · {combined.count} gastos registrados
              </p>
            </div>
            <DollarSign className="h-8 w-8 shrink-0 text-[var(--dashboard-accent)] opacity-40" aria-hidden />
          </div>
        </div>

        <div className="gastos-resumen-page__breakdown grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="app-surface-card gastos-kpi-card gastos-kpi-card--accent relative overflow-hidden p-3">
            <div className="gastos-kpi-glow gastos-kpi-glow--accent" aria-hidden />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                  <Pickaxe className="h-3 w-3 shrink-0" aria-hidden /> Gastos de Mina
                </p>
                <p className="gastos-kpi-value gastos-kpi-value--accent text-xl font-black leading-none">
                  {fmtShort(mina.total)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--dashboard-text-muted)]">
                  {mina.count} registros · {pct(mina.total)}%
                </p>
              </div>
            </div>
          </div>

          <div className="app-surface-card gastos-kpi-card gastos-kpi-card--neutral relative overflow-hidden p-3">
            <div className="gastos-kpi-glow gastos-kpi-glow--neutral" aria-hidden />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                  <Factory className="h-3 w-3 shrink-0" aria-hidden /> Gastos Molino
                </p>
                <p className="gastos-kpi-value gastos-kpi-value--neutral text-xl font-black leading-none">
                  {fmtShort(molino.total)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--dashboard-text-muted)]">
                  {molino.count} registros · {pct(molino.total)}%
                </p>
              </div>
            </div>
          </div>

          <div className="app-surface-card gastos-kpi-card relative overflow-hidden p-3">
            <div className="gastos-kpi-glow gastos-kpi-glow--accent" aria-hidden />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                  <Users className="h-3 w-3 shrink-0" aria-hidden /> Nómina
                </p>
                <p className="gastos-kpi-value gastos-kpi-value--accent text-xl font-black leading-none">
                  {fmtShort(nomina.total)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--dashboard-text-muted)]">
                  {nomina.semanas} semanas · {pct(nomina.total)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {daily.length > 0 ? (
          <div className="gastos-resumen-page__table-card app-surface-card flex min-h-0 flex-col">
            <div className="shrink-0 border-b border-[var(--dashboard-border)] px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Desglose diario — gastos mina y molino
              </p>
            </div>
            <div className="gastos-resumen-page__table-scroll gastos-page__table-body min-h-0 custom-scrollbar">
              <table className="w-full min-w-[28rem] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--dashboard-surface)]">
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                    <th className="px-3 py-2 font-bold">Fecha</th>
                    <th className="px-3 py-2 font-bold text-right">Mina</th>
                    <th className="px-3 py-2 font-bold text-right">Molino</th>
                    <th className="px-3 py-2 font-bold text-right">Total</th>
                    <th className="px-3 py-2 font-bold text-right">Reg.</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((row) => (
                    <tr
                      key={row.fecha}
                      className="border-t border-[var(--dashboard-border)]/60 hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2 font-medium tabular-nums">
                        {new Date(`${row.fecha}T12:00:00`).toLocaleDateString('es-ES', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.mina)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.molino)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(row.total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--dashboard-text-muted)]">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {nominaSemanas.length > 0 ? (
          <div className="gastos-resumen-page__table-card app-surface-card flex min-h-0 flex-col">
            <div className="shrink-0 border-b border-[var(--dashboard-border)] px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Semanas de nómina en el período
              </p>
            </div>
            <div className="gastos-resumen-page__table-scroll gastos-page__table-body min-h-0 custom-scrollbar">
              <table className="w-full min-w-[24rem] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--dashboard-surface)]">
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                    <th className="px-3 py-2 font-bold">Semana</th>
                    <th className="px-3 py-2 font-bold">Área</th>
                    <th className="px-3 py-2 font-bold text-right">Trabajadores</th>
                    <th className="px-3 py-2 font-bold text-right">Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {nominaSemanas.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-[var(--dashboard-border)]/60 hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2 tabular-nums">
                        {s.semana_inicio.slice(5).replace('-', '/')} –{' '}
                        {s.semana_fin.slice(5).replace('-', '/')}
                      </td>
                      <td className="px-3 py-2">{AREA_LABELS[s.area] ?? s.area}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.total_trabajadores}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {fmt(s.total_pagado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
