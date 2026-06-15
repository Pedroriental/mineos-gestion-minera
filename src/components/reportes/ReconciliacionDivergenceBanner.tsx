'use client';

import { memo } from 'react';
import type { ReconciliationSnapshot } from '@/lib/reconciliation/types';
import { AlertTriangle } from 'lucide-react';

type Props = {
  snapshot: ReconciliationSnapshot;
  onDrillRpc?: () => void;
};

export const ReconciliacionDivergenceBanner = memo(function ReconciliacionDivergenceBanner({
  snapshot,
  onDrillRpc,
}: Props) {
  const rpc = snapshot.rpcDivergence;
  const operativo = snapshot.balanceOperativoDivergence;
  if (!rpc?.flagged && !operativo?.flagged) return null;

  return (
    <div className="shrink-0 space-y-2">
      {rpc?.flagged ? (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300/95">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Divergencia con Resumen financiero</p>
            <p className="mt-0.5 text-amber-400/80">
              Ingreso Δ ${rpc.ingresoDiffUsd.toFixed(2)} — revisa producción y precio oro del periodo.
            </p>
          </div>
          {onDrillRpc ? (
            <button
              type="button"
              onClick={onDrillRpc}
              className="shrink-0 rounded-md border border-amber-500/30 px-2 py-1 text-[10px] font-semibold hover:bg-amber-500/10"
            >
              Ver detalle
            </button>
          ) : null}
        </div>
      ) : null}
      {operativo?.flagged ? (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300/95">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Divergencia RPC balance operativo</p>
            <p className="mt-0.5 text-amber-400/80">
              Nómina Δ ${operativo.nominaDiffUsd.toFixed(2)} · Ingreso oro Δ ${operativo.ingresoOroDiffUsd.toFixed(2)}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">
              El motor en vivo y el RPC pueden diferir si hay filtros molino/mina activos o datos pendientes de cierre.
            </p>
          </div>
          {onDrillRpc ? (
            <button
              type="button"
              onClick={() => onDrillRpc()}
              className="shrink-0 rounded-md border border-amber-500/30 px-2 py-1 text-[10px] font-semibold hover:bg-amber-500/10"
            >
              Ver detalle
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
