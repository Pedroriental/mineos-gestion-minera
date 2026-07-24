'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  RotateCcw,
  User,
} from 'lucide-react';
import { formatManualWeekLabel } from '@/lib/nomina/manual-period';
import {
  buildProximosPagosForecast,
  type ProximosPagosConfianza,
  type ProximosPagosWeekForecast,
  type ProximosPagosWorkerProjection,
} from '@/lib/nomina/proximos-pagos';
import {
  deserializeInstanciaSnapshot,
  type InstanciaActivaSerialized,
} from '@/lib/rotacion-plantillas/instancia-serialize';
import { mineosKpiValue, mineosPanel } from '@/lib/mineos-visual';
import type { Personal } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  personal: Personal[];
  area: string;
  /** Lunes de la semana operativa abierta; la proyección arranca aquí. */
  workingWeekStart: string;
  instanciaActiva?: InstanciaActivaSerialized | null;
  valesPorPersonal?: Record<string, number>;
  weeksAhead?: number;
};

function fmtUsd(value: number): string {
  return `$${value.toLocaleString('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function confidenceMeta(confianza: ProximosPagosConfianza) {
  if (confianza === 'alta') {
    return {
      label: 'Alta confianza',
      icon: CheckCircle2,
      className:
        'border-[var(--mineos-benefit-border)]/50 bg-[var(--mineos-benefit-soft)]/15 text-[var(--mineos-benefit-bright)]',
    };
  }
  if (confianza === 'media') {
    return {
      label: 'Confianza media',
      icon: LayoutGrid,
      className:
        'border-[var(--mineos-general-border)]/50 bg-[var(--mineos-general-soft)]/15 text-[var(--mineos-general-bright)]',
    };
  }
  return {
    label: 'Revisar configuración',
    icon: AlertTriangle,
    className:
      'border-[var(--mineos-expense-border)]/50 bg-[var(--mineos-expense-soft)]/15 text-[var(--mineos-expense-bright)]',
  };
}

function WorkerRow({ worker }: { worker: ProximosPagosWorkerProjection }) {
  const isWorked = worker.estado === 'trabajada';
  const isFree = worker.estado === 'libre';
  
  return (
    <div className="flex items-center justify-between gap-1.5 py-1 text-[10px] border-b border-[var(--card-border)]/30 last:border-b-0">
      <div className="min-w-0 flex-1 flex items-center gap-1.5">
        <User className="size-3 shrink-0 text-[var(--text-muted)]" />
        <span className="truncate font-medium text-[var(--text-primary)]" title={worker.nombre}>
          {worker.nombre}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider',
            isWorked && 'bg-[var(--mineos-benefit-soft)]/20 text-[var(--mineos-benefit-bright)] border border-[var(--mineos-benefit-border)]/30',
            isFree && 'bg-[var(--mineos-general-soft)]/20 text-[var(--mineos-general-bright)] border border-[var(--mineos-general-border)]/30',
            !isWorked && !isFree && 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--card-border)]'
          )}
        >
          {isWorked ? `${worker.diasTrabajados}d turno` : isFree ? 'Libre' : 'Sin pago'}
        </span>

        {worker.fuente === 'plantilla' ? (
          <span title="Origen: Plantilla activa">
            <LayoutGrid className="size-3 text-[var(--mineos-general-bright)]" />
          </span>
        ) : worker.fuente === 'rotacion' ? (
          <span title="Origen: Rotación base">
            <RotateCcw className="size-3 text-[var(--text-muted)]" />
          </span>
        ) : (
          <span title="Origen: Configuración incompleta">
            <AlertTriangle className="size-3 text-[var(--mineos-expense-bright)]" />
          </span>
        )}

        <span className="font-semibold tabular-nums text-[var(--text-primary)] w-14 text-right">
          {fmtUsd(worker.amount)}
        </span>
      </div>
    </div>
  );
}

function ForecastCard({
  forecast,
  isFirst,
  isExpanded,
  onToggleExpand,
}: {
  forecast: ProximosPagosWeekForecast;
  isFirst: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const meta = confidenceMeta(forecast.confianza);
  const Icon = meta.icon;

  return (
    <div className="min-w-0 rounded-md border border-[var(--card-border)] bg-[var(--surface-elevated)]/40 px-2.5 py-2 transition-all">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-bold uppercase text-[var(--text-muted)]">
            {formatManualWeekLabel(forecast.weekStart)}
          </p>
          {isFirst ? (
            <p className="mt-0.5 text-[9px] font-semibold text-[var(--mineos-general-bright)]">
              Semana operativa abierta
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold',
            meta.className,
          )}
        >
          <Icon className="size-2.5" />
          {meta.label}
        </span>
      </div>

      <p
        className={cn(
          mineosKpiValue(forecast.confianza === 'baja' ? 'expense' : 'general'),
          'mt-1 overflow-x-auto text-base font-bold tabular-nums whitespace-nowrap',
        )}
      >
        {fmtUsd(forecast.totalUsd)}
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1">
        <span className="rounded border border-[var(--mineos-benefit-border)]/35 bg-[var(--mineos-benefit-soft)]/10 px-1.5 py-px text-[8px] font-semibold text-[var(--mineos-benefit-bright)]">
          {forecast.enTurno} en turno
        </span>
        <span className="rounded border border-[var(--mineos-general-border)]/35 bg-[var(--mineos-general-soft)]/10 px-1.5 py-px text-[8px] font-semibold text-[var(--mineos-general-bright)]">
          {forecast.libresPagadas} libre pagada
        </span>
        {forecast.sinPago > 0 ? (
          <span className="rounded border border-[var(--card-border)] bg-[var(--card-bg)]/55 px-1.5 py-px text-[8px] font-semibold text-[var(--text-muted)]">
            {forecast.sinPago} sin pago
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[8px] font-semibold text-[var(--text-muted)]">
        <div className="flex flex-wrap gap-1 items-center">
          {forecast.porPlantilla > 0 ? (
            <span className="inline-flex items-center gap-1">
              <LayoutGrid className="size-2.5" />
              {forecast.porPlantilla} plantilla
            </span>
          ) : null}
          {forecast.porRotacion > 0 ? (
            <span className="inline-flex items-center gap-1">
              <RotateCcw className="size-2.5" />
              {forecast.porRotacion} rotación
            </span>
          ) : null}
          {forecast.valesAplicados > 0 ? (
            <span className="text-[var(--mineos-expense-bright)]">
              -{fmtUsd(forecast.valesAplicados)} vales
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[var(--mineos-general-bright)] hover:underline focus:outline-none"
        >
          {isExpanded ? 'Ocultar' : `Ver personal (${forecast.workers.length})`}
          {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      </div>

      {isExpanded && forecast.workers.length > 0 ? (
        <div className="mt-2 border-t border-[var(--card-border)]/50 pt-1.5 max-h-48 overflow-y-auto pr-0.5">
          {forecast.workers.map((w) => (
            <WorkerRow key={w.personalId} worker={w} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NominaProximosPagos({
  personal,
  area,
  workingWeekStart,
  instanciaActiva = null,
  valesPorPersonal = {},
  weeksAhead = 4,
}: Props) {
  const instanciaSnapshot = useMemo(
    () => deserializeInstanciaSnapshot(instanciaActiva),
    [instanciaActiva],
  );
  const forecast = useMemo(
    () =>
      buildProximosPagosForecast({
        personal,
        area,
        fromWeekStart: workingWeekStart,
        weeksAhead,
        instanciaActiva: instanciaSnapshot,
        valesPorPersonal,
      }),
    [personal, area, workingWeekStart, weeksAhead, instanciaSnapshot, valesPorPersonal],
  );

  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>(() => ({
    [workingWeekStart]: true,
  }));

  const toggleExpand = (weekStart: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekStart]: !prev[weekStart],
    }));
  };

  const hasRoster = forecast.some((f) => f.enTurno + f.libresPagadas + f.sinPago > 0);
  if (!hasRoster) return null;

  const firstWeek = forecast[0];
  const riskyWeeks = forecast.filter((f) => f.confianza === 'baja');

  return (
    <section className={cn(mineosPanel('general'), 'w-full min-w-0 !p-2.5 lg:!p-3')}>
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <CalendarClock className="h-4 w-4 shrink-0 text-[var(--mineos-general-bright)]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Próximos pagos</h3>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
              Motor determinista alineado con nómina semanal: plantilla operativa, rotación base y
              vales pendientes en la primera semana.
            </p>
          </div>
        </div>
        {firstWeek ? (
          <div className="shrink-0 rounded-lg border border-[var(--mineos-general-border)]/40 bg-[var(--mineos-general-soft)]/10 px-2 py-1 text-right">
            <p className="text-[8px] font-bold uppercase text-[var(--text-muted)]">Siguiente pago</p>
            <p className={cn(mineosKpiValue('general'), 'text-sm font-bold tabular-nums')}>
              {fmtUsd(firstWeek.totalUsd)}
            </p>
          </div>
        ) : null}
      </header>

      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {forecast.map((f, idx) => (
          <ForecastCard
            key={f.weekStart}
            forecast={f}
            isFirst={idx === 0}
            isExpanded={Boolean(expandedWeeks[f.weekStart])}
            onToggleExpand={() => toggleExpand(f.weekStart)}
          />
        ))}
      </div>

      {riskyWeeks.length > 0 ? (
        <div className="mt-2 rounded-md border border-[var(--mineos-expense-border)]/40 bg-[var(--mineos-expense-soft)]/10 px-2.5 py-2 text-[10px] leading-snug text-[var(--mineos-expense-bright)]">
          Hay trabajadores rotativos sin fecha de inicio de rotación. El sistema conserva la regla
          actual, pero marca la predicción como revisable para evitar una falsa certeza.
        </div>
      ) : null}
    </section>
  );
}
