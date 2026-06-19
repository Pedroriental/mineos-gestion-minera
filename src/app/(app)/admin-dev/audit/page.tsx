'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { getAuditLogs } from '@/lib/actions/admin-dev';

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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <Activity className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--dashboard-text)]">Auditoría</h1>
            <p className="text-sm text-[var(--dashboard-text-muted)]">Logs de actividad del sistema</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--dashboard-card-muted)]" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--dashboard-border)] p-12 text-center">
          <Activity className="mx-auto mb-3 h-8 w-8 text-[var(--dashboard-text-muted)]" />
          <p className="text-sm text-[var(--dashboard-text-muted)]">No hay logs de auditoría disponibles</p>
          <p className="mt-1 text-xs text-[var(--dashboard-text-muted)]">
            Los registros de auditoría se generarán automáticamente cuando se realicen acciones en el sistema.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log: any, i: number) => (
            <div
              key={log.id ?? i}
              className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] px-4 py-2.5 text-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-[var(--dashboard-text)]">
                  {log.accion ?? log.action ?? 'Acción'}
                </span>
                <span className="shrink-0 text-xs text-[var(--dashboard-text-muted)]">
                  {log.created_at ? new Date(log.created_at).toLocaleString('es-PE') : ''}
                </span>
              </div>
              {log.detalle && (
                <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">{log.detalle}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
