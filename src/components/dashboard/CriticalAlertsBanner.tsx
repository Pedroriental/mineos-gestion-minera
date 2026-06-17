'use client';

import { memo } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { safeMap } from '@/lib/safe-map';

type AlertItem = { id: string; title: string };

type CriticalAlertsBannerProps = {
  alerts: AlertItem[];
  /** compact = franja de una línea bajo el topbar (sin scroll extra) */
  variant?: 'default' | 'compact';
};

/** Indicador de alertas del sistema: rojo con eventos activos, verde si está nominal. */
export const CriticalAlertsBanner = memo(function CriticalAlertsBanner({ alerts, variant = 'default' }: CriticalAlertsBannerProps) {
  const isCompact = variant === 'compact';
  const hasAlerts = alerts.length > 0;

  if (isCompact) {
    return (
      <section
        className={cn(
          'dashboard-alerts-compact',
          hasAlerts ? 'dashboard-alerts-compact--critical' : 'dashboard-alerts-compact--nominal',
        )}
        aria-live="polite"
      >
        <div className="dashboard-alerts-compact__icon" aria-hidden>
          {hasAlerts ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </div>
        <p className="dashboard-alerts-compact__text">
          {hasAlerts ? safeMap(alerts, (a) => a.title).join(' · ') : 'Estado operacional nominal — sin alertas críticas'}
        </p>
        {hasAlerts ? (
          <Link href="/mina/voladuras" className="dashboard-alerts-compact__cta">
            Ver detalle
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </section>
    );
  }

  if (!hasAlerts) {
    return (
      <section
        className="dashboard-card dashboard-alerts dashboard-alerts--nominal"
        aria-live="polite"
      >
        <div className="dashboard-alerts__icon dashboard-alerts__icon--ok" aria-hidden>
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <p className="dashboard-alerts__title">Estado operacional nominal</p>
          <p className="dashboard-alerts__desc">Sin alertas críticas activas.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="dashboard-card dashboard-alerts dashboard-alerts--critical"
      aria-live="polite"
    >
      <div className="dashboard-alerts__icon" aria-hidden>
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="dashboard-alerts__body">
        <p className="dashboard-alerts__title">Alertas críticas del sistema</p>
        <ul className="dashboard-alerts__list">
          {safeMap(alerts, (a) => (
            <li key={a.id}>{a.title}</li>
          ))}
        </ul>
      </div>
      <Link href="/mina/voladuras" className="dashboard-alerts__cta">
        Ver detalle
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
});
