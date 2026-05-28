'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, ChevronRight, Gem, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardAlert, GlobalData } from './types';

type DashboardCommandHeaderProps = {
  globalData: GlobalData;
  activeNodes: number;
  totalNodes: number;
  alerts: DashboardAlert[];
};

export function DashboardCommandHeader({
  globalData,
  activeNodes,
  totalNodes,
  alerts,
}: DashboardCommandHeaderProps) {
  const hasAlerts = alerts.length > 0;

  const primaryHref = alerts[0]?.href ?? '/dashboard';

  return (
    <header
      className={cn(
        'dashboard-command-header',
        !hasAlerts && 'dashboard-command-header--no-alerts',
      )}
    >
      <div className="dashboard-command-header__brand">
        <p className="dashboard-command-header__eyebrow">Complejo operativo La Fe</p>
        <h1 className="dashboard-command-header__title">Command Center</h1>
        <p className="dashboard-command-header__subtitle">
          Vista en tiempo real de molinos, producción y recursos
        </p>
      </div>

      {hasAlerts ? (
        <div
          className="dashboard-command-header__status dashboard-command-header__status--critical"
          aria-live="polite"
          role="alert"
        >
          <span className="dashboard-command-header__status-icon" aria-hidden>
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="dashboard-command-header__status-copy">
            <p className="dashboard-command-header__status-label">Atención requerida</p>
            <p className="dashboard-command-header__status-text">
              {alerts.map((a) => a.title).join(' · ')}
            </p>
          </div>
          <Link href={primaryHref} className="dashboard-command-header__status-cta">
            Ver detalle
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}

      <div className="dashboard-command-stat dashboard-command-stat--hero" role="listitem">
        <span className="dashboard-command-stat__icon" aria-hidden>
          <Gem className="h-4 w-4" />
        </span>
        <div className="dashboard-command-stat__body">
          <span className="dashboard-command-stat__label">Oro recuperado</span>
          <span className="dashboard-command-stat__value">
            {globalData.totalGrams.toLocaleString('en-US', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
            <span className="dashboard-command-stat__unit">g Au</span>
          </span>
        </div>
      </div>

      <div className="dashboard-command-stat dashboard-command-stat--nodes" role="listitem">
        <span className="dashboard-command-stat__icon" aria-hidden>
          <Zap className="h-4 w-4" />
        </span>
        <div className="dashboard-command-stat__body">
          <span className="dashboard-command-stat__label">Nodos activos</span>
          <span className="dashboard-command-stat__value">
            {activeNodes}
            <span className="dashboard-command-stat__unit">/ {totalNodes}</span>
          </span>
        </div>
      </div>

      <div
        className="dashboard-command-stat dashboard-command-stat--personnel"
        role="listitem"
      >
        <span className="dashboard-command-stat__icon" aria-hidden>
          <Users className="h-4 w-4" />
        </span>
        <div className="dashboard-command-stat__body">
          <span className="dashboard-command-stat__label">Personal en turno</span>
          <span className="dashboard-command-stat__value">
            {globalData.activePersonnel}
            <span className="dashboard-command-stat__unit">operarios</span>
          </span>
        </div>
      </div>

      <div className="dashboard-command-stat dashboard-command-stat--expenses" role="listitem">
        <span className="dashboard-command-stat__icon" aria-hidden>
          <Activity className="h-4 w-4" />
        </span>
        <div className="dashboard-command-stat__body">
          <span className="dashboard-command-stat__label">Gastos del mes</span>
          <span className="dashboard-command-stat__value">
            ${globalData.monthlyExpenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </header>
  );
}
