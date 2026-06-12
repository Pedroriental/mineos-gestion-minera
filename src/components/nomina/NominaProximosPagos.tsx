'use client';

import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { predictWeekPay } from '@/lib/nomina-calculo';
import { formatManualWeekLabel } from '@/lib/nomina/manual-period';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import { mineosKpiValue, mineosPanel } from '@/lib/mineos-visual';
import type { Personal } from '@/lib/types';
import { cn } from '@/lib/utils';

type WeekForecast = {
  weekStart: string;
  totalUsd: number;
  enTurno: number;
  libresPagadas: number;
  sinPago: number;
};

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Proyección de desembolsos de las próximas semanas según el esquema de rotación de cada trabajador. */
export function buildProximosPagosForecast(
  personal: Personal[],
  area: string,
  fromWeekStart: string,
  weeksAhead = 4,
): WeekForecast[] {
  const roster = personal.filter((p) => isPersonalVisibleInNomina(p, area));
  const out: WeekForecast[] = [];
  for (let i = 0; i < weeksAhead; i++) {
    const weekStart = addDaysIso(fromWeekStart, i * 7);
    let totalUsd = 0;
    let enTurno = 0;
    let libresPagadas = 0;
    let sinPago = 0;
    for (const p of roster) {
      const pred = predictWeekPay(p, weekStart);
      totalUsd += pred.amount;
      if (pred.estado === 'trabajada') enTurno += 1;
      else if (pred.estado === 'libre' && pred.amount > 0) libresPagadas += 1;
      else sinPago += 1;
    }
    out.push({
      weekStart,
      totalUsd: parseFloat(totalUsd.toFixed(2)),
      enTurno,
      libresPagadas,
      sinPago,
    });
  }
  return out;
}

type Props = {
  personal: Personal[];
  area: string;
  /** Lunes de la semana de trabajo actual; la proyección arranca en la siguiente. */
  workingWeekStart: string;
  weeksAhead?: number;
};

export function NominaProximosPagos({ personal, area, workingWeekStart, weeksAhead = 4 }: Props) {
  const forecast = useMemo(
    () =>
      buildProximosPagosForecast(personal, area, addDaysIso(workingWeekStart, 7), weeksAhead),
    [personal, area, workingWeekStart, weeksAhead],
  );

  const hasRoster = forecast.some((f) => f.enTurno + f.libresPagadas + f.sinPago > 0);
  if (!hasRoster) return null;

  return (
    <section className={cn(mineosPanel('general'), 'w-full min-w-0 !p-2.5 lg:!p-3')}>
      <header className="mb-2 flex items-start gap-2">
        <CalendarClock className="h-4 w-4 shrink-0 text-[var(--mineos-general-bright)]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Próximos pagos</h3>
          <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
            Proyección por esquema de rotación de cada trabajador. No incluye vales, bonos manuales
            ni ajustes de plantilla del periodo manual.
          </p>
        </div>
      </header>

      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {forecast.map((f) => (
          <div
            key={f.weekStart}
            className="rounded-md border border-[var(--card-border)] bg-[var(--surface-elevated)]/40 px-2.5 py-2"
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {formatManualWeekLabel(f.weekStart)}
            </p>
            <p className={cn(mineosKpiValue('general'), 'mt-0.5 text-sm font-bold tabular-nums')}>
              ${f.totalUsd.toLocaleString('es', { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="rounded bg-emerald-500/10 px-1.5 py-px text-[8px] font-semibold text-emerald-400">
                {f.enTurno} en turno
              </span>
              <span className="rounded bg-amber-500/10 px-1.5 py-px text-[8px] font-semibold text-amber-400">
                {f.libresPagadas} libre pagada
              </span>
              {f.sinPago > 0 ? (
                <span className="rounded bg-zinc-500/10 px-1.5 py-px text-[8px] font-semibold text-[var(--text-muted)]">
                  {f.sinPago} sin pago
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
