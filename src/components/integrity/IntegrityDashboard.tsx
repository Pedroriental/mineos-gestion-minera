'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { verifyFinancialIntegrityAction } from '@/lib/actions/verify-integrity';
import type { VerificationResult, IntegrityDiscrepancy } from '@/lib/validations/integrity';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  ChevronDown,
} from 'lucide-react';

function DiscrepancyRow({
  d,
  defaultOpen,
}: {
  d: IntegrityDiscrepancy;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isCritical = d.severidad === 'CRITICO';

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isCritical
          ? 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20'
          : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
      >
        {isCritical ? (
          <XCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
        )}
        <span className="flex-1 text-[13px] font-medium text-[var(--dashboard-text)] leading-snug">
          {d.mensaje}
        </span>
        <span
          className={cn(
            'shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
            isCritical
              ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
              : 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
          )}
        >
          {d.severidad}
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-[var(--dashboard-text-muted)] transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="border-t border-inherit px-3.5 py-3 space-y-1.5">
          {d.diferencia !== 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[var(--dashboard-text-muted)] w-24">Esperado:</span>
              <span className="font-mono font-medium text-[var(--dashboard-text)]">
                ${d.valor_esper?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '—'}
              </span>
            </div>
          )}
          {d.diferencia !== 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[var(--dashboard-text-muted)] w-24">Real:</span>
              <span className="font-mono font-medium text-[var(--dashboard-text)]">
                ${d.valor_real?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '—'}
              </span>
            </div>
          )}
          {d.diferencia !== 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[var(--dashboard-text-muted)] w-24">Diferencia:</span>
              <span
                className={cn(
                  'font-mono font-bold',
                  d.diferencia < 0 ? 'text-red-500' : 'text-amber-500',
                )}
              >
                {d.diferencia > 0 ? '+' : ''}${d.diferencia.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {d.fecha_ref && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[var(--dashboard-text-muted)] w-24">Fecha:</span>
              <span className="text-[var(--dashboard-text)]">{d.fecha_ref}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const moduleLabels: Record<string, string> = {
  nomina: 'Nómina',
  gastos: 'Gastos',
  produccion: 'Producción',
  balance: 'Balance Diario',
};

const moduleIcons: Record<string, string> = {
  nomina: '💰',
  gastos: '🧾',
  produccion: '⛏️',
  balance: '📊',
};

export default function IntegrityDashboard({
  initialData,
}: {
  initialData: VerificationResult;
}) {
  const [data, setData] = useState<VerificationResult>(initialData);
  const [loading, setLoading] = useState(false);

  const recheck = useCallback(async () => {
    setLoading(true);
    const res = await verifyFinancialIntegrityAction();
    if (res.ok) setData(res.data);
    setLoading(false);
  }, []);

  const grouped = data.discrepancias.reduce(
    (acc, d) => {
      if (!acc[d.modulo]) acc[d.modulo] = [];
      acc[d.modulo].push(d);
      return acc;
    },
    {} as Record<string, IntegrityDiscrepancy[]>,
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div
        className={cn(
          'rounded-xl border p-5 transition-colors',
          data.ok
            ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20'
            : 'border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20',
        )}
      >
        <div className="flex items-center gap-3">
          {data.ok ? (
            <ShieldCheck className="w-7 h-7 text-emerald-500 flex-shrink-0" />
          ) : (
            <ShieldAlert className="w-7 h-7 text-red-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-[var(--dashboard-text)]">
              {data.ok
                ? 'Todos los sistemas financieros sincronizados'
                : `${data.criticas} discrepancia${data.criticas !== 1 ? 's' : ''} crítica${data.criticas !== 1 ? 's' : ''} detectada${data.criticas !== 1 ? 's' : ''}`}
            </p>
            <p className="text-[12px] text-[var(--dashboard-text-muted)] mt-0.5">
              {data.totalDiscrepancias === 0
                ? 'No hay errores de cuadre entre módulos'
                : `${data.totalDiscrepancias} discrepancia${data.totalDiscrepancias !== 1 ? 's' : ''} en total · ${data.advertencias} advertencia${data.advertencias !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--dashboard-text-muted)]">
              <Clock className="w-3.5 h-3.5" />
              {new Date(data.verificadoEn).toLocaleString('es-VE', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <button
              type="button"
              onClick={recheck}
              disabled={loading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                'bg-[var(--dashboard-card-muted)] border border-[var(--dashboard-border)]',
                'text-[var(--dashboard-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
                loading && 'opacity-50 pointer-events-none',
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              Re-verificar
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(moduleLabels).map(([key, label]) => {
          const disc = grouped[key] ?? [];
          const crit = disc.filter((d) => d.severidad === 'CRITICO').length;
          const warn = disc.filter((d) => d.severidad === 'ADVERTENCIA').length;
          const clean = crit === 0 && warn === 0;
          return (
            <div
              key={key}
              className={cn(
                'rounded-xl border p-3.5',
                clean
                  ? 'border-emerald-200 dark:border-emerald-900/30'
                  : crit > 0
                    ? 'border-red-200 dark:border-red-900/30'
                    : 'border-amber-200 dark:border-amber-900/30',
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)] mb-1">
                {label}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-lg">{moduleIcons[key]}</span>
                <span
                  className={cn(
                    'text-[20px] font-bold',
                    clean
                      ? 'text-emerald-500'
                      : crit > 0
                        ? 'text-red-500'
                        : 'text-amber-500',
                  )}
                >
                  {disc.length}
                </span>
                {clean && (
                  <span className="text-[11px] text-emerald-500 font-medium">Sincronizado</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Discrepancy log */}
      {data.discrepancias.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--dashboard-text-muted)] px-0.5">
            Registro de discrepancias
          </h3>
          {data.discrepancias.map((d, i) => (
            <DiscrepancyRow key={`${d.modulo}-${d.fecha_ref}-${i}`} d={d} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
