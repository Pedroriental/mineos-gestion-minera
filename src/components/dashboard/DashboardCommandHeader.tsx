'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, ChevronRight, Gem, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardAlert, GlobalData } from './types';

type DashboardCommandHeaderProps = {
  globalData: GlobalData;
  activeNodes: number;
  totalNodes: number;
};

export function DashboardCommandHeader({
  globalData,
  activeNodes,
  totalNodes,
}: DashboardCommandHeaderProps) {
  return (
    <header
      className="dashboard-command-header dashboard-command-header--no-alerts"
    >
      <div className="dashboard-command-header__brand">
        <p className="dashboard-command-header__eyebrow">Complejo operativo La Fe</p>
        <h1 className="dashboard-command-header__title">Centro de Comando</h1>
        <p className="dashboard-command-header__subtitle">
          Vista en tiempo real de molinos, producción y recursos
        </p>
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
