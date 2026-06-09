'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';
import { auditGastosRegistros, type AuditGastosResult } from '@/lib/actions/gastos-audit';
import type { GastoAuditFinding } from '@/lib/gastos-audit';

function severityIcon(severity: GastoAuditFinding['severity']) {
  if (severity === 'error') return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
  if (severity === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  return <Info className="h-3.5 w-3.5 text-sky-400" />;
}

function formatLastRun(date: Date) {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function GastosAuditPanel() {
  const [result, setResult] = useState<AuditGastosResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  const runAudit = useCallback(async (options?: { silent?: boolean }) => {
    setIsLoading(true);
    try {
      const audit = await auditGastosRegistros();
      setResult(audit);
      setLastRunAt(new Date());

      if (!options?.silent) {
        if (!audit.ok) {
          toastError(audit.message);
        } else if (audit.summary.total === 0) {
          toast.success('Auditoría revisada: sin hallazgos.');
        } else {
          toast.success(
            `Auditoría revisada: ${audit.summary.total} hallazgo${audit.summary.total === 1 ? '' : 's'}.`,
          );
        }
      }
    } catch {
      toastError('No se pudo ejecutar la auditoría de gastos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void runAudit({ silent: true });
  }, [runAudit]);

  const summary = result && result.ok ? result.summary : null;
  const findings = result && result.ok ? result.findings : [];
  const hasIssues = summary ? summary.total > 0 : false;

  return (
    <div className="gastos-page__audit app-surface-card flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--dashboard-accent)]" aria-hidden />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
            Auditoría
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastRunAt ? (
            <span className="hidden text-[9px] text-white/30 xl:inline">
              {formatLastRun(lastRunAt)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void runAudit()}
            disabled={isLoading}
            className="inline-flex min-w-[3.75rem] items-center justify-center rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/80 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Revisar'}
          </button>
        </div>
      </div>

      {result && !result.ok ? (
        <p className="text-[11px] text-red-400">{result.message}</p>
      ) : null}

      {summary ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {!hasIssues ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Sin hallazgos
            </span>
          ) : (
            <>
              {summary.errors > 0 ? (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                  {summary.errors} crítico{summary.errors === 1 ? '' : 's'}
                </span>
              ) : null}
              {summary.warnings > 0 ? (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  {summary.warnings} aviso{summary.warnings === 1 ? '' : 's'}
                </span>
              ) : null}
              {summary.info > 0 ? (
                <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
                  {summary.info} info
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {findings.map((finding) => (
          <div key={finding.id} className="rounded-lg border border-white/8 bg-white/[0.02] p-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{severityIcon(finding.severity)}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold leading-snug text-white/80">{finding.message}</p>
                {finding.detail ? (
                  <p className="mt-0.5 text-[10px] leading-snug text-white/45">{finding.detail}</p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
