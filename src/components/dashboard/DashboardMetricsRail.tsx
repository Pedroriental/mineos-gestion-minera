'use client';

import {
  BatteryCharging,
  Flame,
  Package,
  Receipt,
  Server,
  Users,
} from 'lucide-react';
import { SolidMetricCard } from './SolidMetricCard';
import type { GlobalData } from './types';

type DashboardMetricsRailProps = {
  globalData: GlobalData;
  activeNodes: number;
};

/** Indicadores consolidados en columna lateral (sustituye la lista de nodos). */
export function DashboardMetricsRail({ globalData, activeNodes }: DashboardMetricsRailProps) {
  const kpiRowCount = 1 + globalData.balancesPlanchas.length + 4;

  return (
    <aside className="dashboard-metrics-rail" aria-labelledby="dashboard-kpi-heading">
      <div className="dashboard-metrics-rail__head">
        <h2 id="dashboard-kpi-heading" className="dashboard-metrics-rail__title">
          Indicadores consolidados
        </h2>
      </div>

      <div
        className="dashboard-metrics-rail__list"
        style={{ gridTemplateRows: `repeat(${kpiRowCount}, minmax(0, 1fr))` }}
      >
        <SolidMetricCard
          layout="rail"
          label="Oro total"
          value={globalData.totalGrams.toLocaleString('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          unit="g Au"
          icon={<Server className="h-3.5 w-3.5" />}
        />

        {globalData.balancesPlanchas.map((plancha) => (
          <SolidMetricCard
            key={plancha.id}
            layout="rail"
            label={plancha.label}
            value={plancha.grams.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            unit="g Au"
            icon={<Flame className="h-3.5 w-3.5" />}
          />
        ))}

        <SolidMetricCard
          layout="rail"
          label="Consumo diario"
          value={`$${globalData.todayExpenses.toLocaleString()}`}
          icon={<BatteryCharging className="h-3.5 w-3.5" />}
        />
        <SolidMetricCard
          layout="rail"
          label="Inventario crítico"
          value={globalData.criticalInventory}
          unit="ítems"
          icon={<Package className="h-3.5 w-3.5" />}
          alert={globalData.criticalInventory > 0}
        />
        <SolidMetricCard
          layout="rail"
          label="Gastos del mes"
          value={`$${globalData.monthlyExpenses.toLocaleString()}`}
          icon={<Receipt className="h-3.5 w-3.5" />}
        />
        <SolidMetricCard
          layout="rail"
          label="Personal en turno"
          value={globalData.activePersonnel}
          unit="operarios"
          icon={<Users className="h-3.5 w-3.5" />}
          footer={`${activeNodes} nodos`}
        />
      </div>
    </aside>
  );
}
