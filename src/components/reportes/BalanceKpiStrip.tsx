'use client';

import { memo } from 'react';
import type { BalanceSummary } from '@/lib/reconciliation/aggregate-balance';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { cn } from '@/lib/utils';

type Props = {
  kpis: BalanceSummary['kpis'];
  compact?: boolean;
};

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={ui.kpiCard}>
      <p className={ui.kpiLabel}>{label}</p>
      <p className={accent ? ui.kpiValueAccent : ui.kpiValue}>{value}</p>
    </div>
  );
}

export const BalanceKpiStrip = memo(function BalanceKpiStrip({ kpis, compact }: Props) {
  const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const gridClass = compact
    ? 'grid grid-cols-2 gap-2'
    : 'reportes-ui__kpi-grid grid shrink-0 grid-cols-2 gap-2 md:grid-cols-4';

  return (
    <div className={gridClass}>
      <KpiCard label="Ingreso total" value={fmt(kpis.ingresoTotalUsd)} accent />
      <KpiCard label="Gasto total" value={fmt(kpis.gastoTotalUsd)} />
      <KpiCard
        label="Rentabilidad"
        value={fmt(kpis.rentabilidadUsd)}
        accent={kpis.rentabilidadUsd >= 0}
      />
      <KpiCard label="Margen" value={`${kpis.margenRentabilidadPct.toFixed(1)}%`} />
      {!compact ? (
        <>
          <KpiCard label="Ingreso oro" value={fmt(kpis.ingresoOroUsd)} />
          <KpiCard label="Ingreso arenas" value={fmt(kpis.ingresoArenasUsd)} />
          <KpiCard label="Nómina" value={fmt(kpis.gastoNominaUsd)} />
          <KpiCard label="Costo / g oro" value={`$${kpis.costoPorGramoOro.toFixed(2)}`} />
        </>
      ) : null}
    </div>
  );
});

export const BalanceKpiStripSidebar = memo(function BalanceKpiStripSidebar({ kpis }: Props) {
  return (
    <div className="space-y-2">
      <BalanceKpiStrip kpis={kpis} compact />
    </div>
  );
});
