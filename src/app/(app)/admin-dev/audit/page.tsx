'use client';

import { useEffect, useState } from 'react';
import { Activity, Clock, User, FileText } from 'lucide-react';
import { getAuditLogs } from '@/lib/actions/admin-dev';
import { mineosPanel } from '@/lib/mineos-visual';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLogs(100)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-viewport-canvas mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--mineos-general-bright)]/70">
          Desarrollo
        </p>
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Auditoría</h1>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Registro de actividad del sistema</p>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--surface-sunken)]" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className={mineosPanel('general') + ' py-16 text-center'}>
          <Activity className="mx-auto mb-3 h-8 w-8 text-[var(--mineos-neutral-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">No hay logs disponibles</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Los registros se generarán automáticamente con las acciones del sistema.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log: any, i: number) => (
            <div
              key={log.id ?? i}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 transition-colors hover:border-[var(--mineos-general-border)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--mineos-general-soft)]">
                    <FileText className="h-3 w-3 text-[var(--mineos-general-bright)]" />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {log.accion ?? log.action ?? 'Acción'}
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <Clock className="h-3 w-3" />
                  {log.created_at ? new Date(log.created_at).toLocaleString('es-PE') : ''}
                </span>
              </div>
              {log.detalle && (
                <p className="mt-1.5 ml-8 text-[11px] text-[var(--text-secondary)]">{log.detalle}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
