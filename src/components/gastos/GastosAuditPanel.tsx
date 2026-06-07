'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldCheck } from 'lucide-react';
import { auditGastosRegistros, type AuditGastosResult } from '@/lib/actions/gastos-audit';
import type { GastoAuditFinding } from '@/lib/gastos-audit';

function severityIcon(severity: GastoAuditFinding['severity']) {
  if (severity === 'error') return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
  if (severity === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  return <Info className="h-3.5 w-3.5 text-sky-400" />;
}

export function GastosAuditPanel() {
  const [result, setResult] = useState<AuditGastosResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const runAudit = useCallback(() => {
    startTransition(async () => {
      const audit = await auditGastosRegistros();
      setResult(audit);
    });
  }, []);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  const summary = result && result.ok ? result.summary : null;
  const findings = result && result.ok ? result.findings.slice(0, 8) : [];
  const hasIssues = summary ? summary.total > 0 : false;

  return (
    <div className="gastos-page__audit app-surface-card flex min-h-0 flex-col p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--dashboard-accent)]" aria-hidden />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
            Auditoría
          </span>
        </div>
        <button
          type="button"
          onClick={runAudit}
          disabled={isPending}
          className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/80 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Revisar'}
        </button>
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
        {summary && summary.total > findings.length ? (
          <p className="text-center text-[10px] text-white/35">
            +{summary.total - findings.length} hallazgo(s) más
          </p>
        ) : null}
      </div>
    </div>
  );
}
