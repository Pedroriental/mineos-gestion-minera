'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Gem, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GlobalData } from './types';

type AlertItem = { id: string; title: string };

type DashboardCommandHeaderProps = {
  globalData: GlobalData;
  activeNodes: number;
  totalNodes: number;
  alerts: AlertItem[];
};

export function DashboardCommandHeader({
  globalData,
  activeNodes,
  totalNodes,
  alerts,
}: DashboardCommandHeaderProps) {
  const hasAlerts = alerts.length > 0;

  return (
    <header className="dashboard-command-header">
      <div className="dashboard-command-header__brand">
        <p className="dashboard-command-header__eyebrow">Complejo operativo La Fe</p>
        <h1 className="dashboard-command-header__title">Command Center</h1>
        <p className="dashboard-command-header__subtitle">
          Vista en tiempo real de molinos, producción y recursos
        </p>
      </div>

      <div
        className={cn(
          'dashboard-command-header__status',
          hasAlerts
            ? 'dashboard-command-header__status--critical'
            : 'dashboard-command-header__status--nominal',
        )}
        aria-live="polite"
      >
        <span className="dashboard-command-header__status-icon" aria-hidden>
          {hasAlerts ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </span>
        <div className="dashboard-command-header__status-copy">
          <p className="dashboard-command-header__status-label">
            {hasAlerts ? 'Atención requerida' : 'Operación nominal'}
          </p>
          <p className="dashboard-command-header__status-text">
            {hasAlerts
              ? alerts.map((a) => a.title).join(' · ')
              : 'Sin alertas críticas activas en el complejo'}
          </p>
        </div>
        {hasAlerts ? (
          <Link href="/mina/voladuras" className="dashboard-command-header__status-cta">
            Ver detalle
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

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
