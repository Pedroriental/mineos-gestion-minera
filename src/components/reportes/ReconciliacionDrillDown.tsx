'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { DrillDownRow } from '@/lib/reconciliation/types';
import { buildPeriodDeepLink, formatCell } from '@/lib/reconciliation/drill-down';

export function ReconciliacionDrillDown({
  ruleId,
  ruleLabel,
  rows,
  isLoading,
  dateFrom,
  dateTo,
  onClose,
}: {
  ruleId: string;
  ruleLabel: string;
  rows: DrillDownRow[];
  isLoading?: boolean;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
}) {
  const colA = rows[0]?.columnA ?? 'Fuente A';
  const colB = rows[0]?.columnB ?? 'Fuente B';
  const unitA = rows[0]?.unitA;
  const unitB = rows[0]?.unitB;
  const periodLink = buildPeriodDeepLink(ruleId, dateFrom, dateTo);

  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950/25 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">Detalle: {ruleLabel}</h3>
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-200">
          Cerrar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 justify-center text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando desglose…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-2 py-4 text-center">
          <p className="text-sm text-zinc-500">No hay filas de detalle para este periodo.</p>
          <Link href={periodLink} className="text-xs font-medium text-zinc-400 hover:text-zinc-200">
            Abrir módulo relacionado →
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-white/5">
                  <th className="py-2 pr-3 font-semibold">Periodo</th>
                  <th className="py-2 pr-3 font-semibold text-right">{colA}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{colB}</th>
                  <th className="py-2 pr-3 font-semibold text-right">Desvío</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 pr-3 text-zinc-200">{r.label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">
                      {formatCell(r.valueA, r.unitA ?? unitA)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">
                      {formatCell(r.valueB, r.unitB ?? unitB)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">
                      {r.deviationPct != null ? `${r.deviationPct}%` : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {r.deepLink ? (
                        <Link
                          href={r.deepLink}
                          className="text-zinc-400 hover:text-zinc-200 font-medium whitespace-nowrap"
                        >
                          Abrir
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-zinc-600 text-right">
            {rows.length} fila{rows.length !== 1 ? 's' : ''}
            {' · '}
            <Link href={periodLink} className="hover:text-zinc-400">
              Ver en operaciones
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
