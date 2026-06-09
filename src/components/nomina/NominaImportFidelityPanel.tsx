'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, TrendingUp } from 'lucide-react';
import {
  buildImportFidelityReport,
  formatFidelityDelta,
  type ImportFidelityReport,
} from '@/lib/nomina/import-fidelity';
import type { InferredWorkerProfile, ParsedNominaPeriod } from '@/lib/nomina/types';
import type { WorkerMatchRecord } from '@/lib/nomina/worker-match';
import { cn } from '@/lib/utils';

function fmtUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('es', { minimumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: ImportFidelityReport['status'] }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Cuadra
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
        <AlertTriangle className="h-3 w-3" />
        Revisar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300">
      <AlertTriangle className="h-3 w-3" />
      Brecha
    </span>
  );
}

type FidelityRow = {
  label: string;
  value: number | null;
  delta: number | null;
  detail?: string;
};

function FidelityTable({ rows }: { rows: FidelityRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/5">
      {/* Cabecera */}
      <div className="grid grid-cols-[1fr_auto_auto] border-b border-white/5 bg-zinc-950/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <span>Etapa</span>
        <span className="w-28 text-right">Total USD</span>
        <span className="w-20 text-right">Δ vs anterior</span>
      </div>
      {/* Filas */}
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={cn(
            'grid grid-cols-[1fr_auto_auto] items-center px-4 py-3 text-xs transition hover:bg-white/2',
            i > 0 && 'border-t border-white/4',
          )}
        >
          {/* Etapa + detalle */}
          <div className="min-w-0 pr-4">
            <p className="font-medium text-zinc-200">{row.label}</p>
            {row.detail && (
              <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">{row.detail}</p>
            )}
          </div>
          {/* Total */}
          <div className="w-28 text-right tabular-nums font-semibold text-zinc-100">
            {fmtUsd(row.value)}
          </div>
          {/* Delta */}
          <div
            className={cn(
              'w-20 text-right tabular-nums text-[11px]',
              row.delta != null && Math.abs(row.delta) > 0.05 && 'font-semibold text-amber-300',
              row.delta != null && Math.abs(row.delta) <= 0.05 && 'text-zinc-500',
              row.delta == null && 'text-zinc-600',
            )}
          >
            {formatFidelityDelta(row.delta)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NominaImportFidelityPanel({
  period,
  profiles,
  savedReport = null,
  compact = false,
  existingPersonal,
  workersBase,
}: {
  period: ParsedNominaPeriod;
  profiles: InferredWorkerProfile[];
  savedReport?: ImportFidelityReport | null;
  compact?: boolean;
  existingPersonal?: Map<string, any>;
  workersBase?: WorkerMatchRecord[];
}) {
  const [showDropped, setShowDropped] = useState(false);
  const report = useMemo(
    () =>
      savedReport ??
      buildImportFidelityReport(period, profiles, { existingPersonal, workersBase }),
    [savedReport, period, profiles, existingPersonal, workersBase],
  );

  const rows: FidelityRow[] = [
    ...(report.sourceDeclaredTotal != null
      ? [
          {
            label: 'Archivo (impreso)',
            value: report.sourceDeclaredTotal,
            delta: null,
            detail: period.source === 'pdf' ? 'Cabecera del PDF' : undefined,
          },
        ]
      : []),
    {
      label: 'Extraído (parser)',
      value: report.parsedTotal,
      delta: report.deltas.sourceToParsed,
      detail: `${report.workerCountParsed} trabajadores detectados`,
    },
    ...(savedReport && report.commitTotal !== report.savedTotal
      ? [
          {
            label: 'Plan de importación',
            value: report.commitTotal,
            delta: report.deltas.parsedToCommit,
            detail: `${report.workerCountCommit} trabajadores · ${report.registrosCommit} registros`,
          },
        ]
      : []),
    {
      label: savedReport ? 'Guardado en BD' : 'A importar',
      value: savedReport ? report.savedTotal : report.commitTotal,
      delta: savedReport ? report.deltas.commitToSaved : report.deltas.parsedToCommit,
      detail: savedReport
        ? `${report.workerCountSaved ?? 0} trabajadores · ${report.registrosSaved ?? 0} registros`
        : `${report.workerCountCommit} trabajadores · ${report.registrosCommit} registros`,
    },
  ];

  const borderTone =
    report.status === 'ok'
      ? 'border-emerald-500/15 bg-emerald-500/4'
      : report.status === 'warn'
        ? 'border-amber-500/15 bg-amber-500/4'
        : 'border-red-500/15 bg-red-500/4';

  return (
    <div className={cn('rounded-2xl border', borderTone, compact ? 'p-3' : 'p-4')}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
              report.status === 'ok' && 'bg-emerald-500/15 text-emerald-400',
              report.status === 'warn' && 'bg-amber-500/15 text-amber-400',
              report.status === 'error' && 'bg-red-500/15 text-red-400',
            )}
          >
            {report.status === 'ok' ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <Info className="h-3.5 w-3.5" />
            )}
          </div>
          <p className="text-xs font-semibold text-zinc-200">Verificación de fidelidad</p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {/* Tabla */}
      <FidelityTable rows={rows} />

      {/* Issues o mensaje OK */}
      {report.issues.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-zinc-400">
          {report.issues.map((issue) => (
            <li key={issue} className="flex gap-2">
              <span className="mt-0.5 text-zinc-600">•</span>
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[11px] text-emerald-300/80">
          Los totales cuadran entre etapas. La vista previa usará estos registros importados.
        </p>
      )}

      {/* Trabajadores excluidos */}
      {report.droppedWorkers.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={() => setShowDropped((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-medium text-zinc-300 transition hover:text-white"
          >
            <span>{report.droppedWorkers.length} trabajador(es) excluido(s) del import</span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform', showDropped && 'rotate-180')}
            />
          </button>
          {showDropped && (
            <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto text-[11px]">
              {report.droppedWorkers.map((w) => (
                <li
                  key={`${w.cedula}-${w.nombre}`}
                  className="flex items-start justify-between gap-3 rounded-lg bg-zinc-950/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-zinc-200">{w.nombre}</p>
                    <p className="text-zinc-500">
                      {w.cedula} · {w.reason}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-zinc-400">{fmtUsd(w.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export { buildImportFidelityReport, type ImportFidelityReport };
