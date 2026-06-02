'use client';

import { memo } from 'react';
import {
  BatteryCharging,
  Flame,
  Gem,
  Package,
  Receipt,
  Users,
} from 'lucide-react';
import { SolidMetricCard } from './SolidMetricCard';
import type { GlobalData } from './types';

type DashboardMetricsRailProps = {
  globalData: GlobalData;
  activeNodes: number;
};

/** Indicadores consolidados en columna lateral (sustituye la lista de nodos). */
export const DashboardMetricsRail = memo(function DashboardMetricsRail({ globalData, activeNodes }: DashboardMetricsRailProps) {
  return (
    <aside className="dashboard-metrics-rail" aria-labelledby="dashboard-kpi-heading">
      <div className="dashboard-metrics-rail__head">
        <h2 id="dashboard-kpi-heading" className="dashboard-metrics-rail__title">
          Panel operativo
        </h2>
        <p className="dashboard-metrics-rail__desc">Detalle financiero y de planta</p>
      </div>

      <div className="dashboard-metrics-rail__list scroll-y-fade">
        <p className="dashboard-metrics-rail__section">Producción</p>
        <SolidMetricCard
          layout="rail"
          featured
          label="Oro total período"
          value={globalData.totalGrams.toLocaleString('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          unit="g Au"
          icon={<Gem className="h-4 w-4" />}
        />

        {globalData.balancesPlanchas.length > 0 ? (
          <>
            <p className="dashboard-metrics-rail__section">Planchas</p>
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
          </>
        ) : null}

        <p className="dashboard-metrics-rail__section">Recursos</p>
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
          footer={`${activeNodes} nodos activos`}
        />
      </div>
    </aside>
  );
});
