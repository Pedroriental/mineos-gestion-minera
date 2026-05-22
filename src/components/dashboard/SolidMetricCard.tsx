'use client';

import type { ReactNode } from 'react';
import { SimpleSparkline } from './SimpleSparkline';

type SolidMetricCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  alert?: boolean;
  trend?: number[];
  footer?: string;
  /** rail = tarjeta alargada para la columna lateral del dashboard */
  layout?: 'grid' | 'rail';
};

/** Tarjeta KPI con fondo sólido y borde del sistema de diseño global. */
export function SolidMetricCard({
  label,
  value,
  unit,
  icon,
  alert,
  trend,
  footer,
  layout = 'grid',
}: SolidMetricCardProps) {
  const isRail = layout === 'rail';

  if (isRail) {
    return (
      <article
        className={[
          'dashboard-card dashboard-metric-card dashboard-metric-card--rail',
          alert ? 'dashboard-metric-card--alert' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="dashboard-metric-card__rail-row">
          <div className="dashboard-metric-card__icon" aria-hidden>
            {icon}
          </div>
          <div className="dashboard-metric-card__body">
            <div className="dashboard-metric-card__rail-main">
              <p className="dashboard-metric-card__label">{label}</p>
              <p className="dashboard-metric-card__value">
                {value}
                {unit ? <span className="dashboard-metric-card__unit">{unit}</span> : null}
              </p>
            </div>
            {footer ? <p className="dashboard-metric-card__footer">{footer}</p> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={[
        'dashboard-card dashboard-metric-card',
        alert ? 'dashboard-metric-card--alert' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="dashboard-metric-card__head">
        <div className="dashboard-metric-card__icon" aria-hidden>
          {icon}
        </div>
        <div className="dashboard-metric-card__body">
          <p className="dashboard-metric-card__label">{label}</p>
          <p className="dashboard-metric-card__value">
            {value}
            {unit ? <span className="dashboard-metric-card__unit">{unit}</span> : null}
          </p>
          {footer ? <p className="dashboard-metric-card__footer">{footer}</p> : null}
        </div>
      </div>
      {trend && trend.length > 1 ? (
        <div className="dashboard-metric-card__chart">
          <SimpleSparkline values={trend} variant={alert ? 'danger' : 'accent'} />
        </div>
      ) : null}
    </article>
  );
}
