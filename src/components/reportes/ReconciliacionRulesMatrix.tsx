'use client';

import { AlertTriangle, CheckCircle2, HelpCircle, MinusCircle } from 'lucide-react';
import type { ReconciliationRuleResult } from '@/lib/reconciliation/types';
import type { NominaDivisionParam } from '@/lib/reconciliation/nomina-divisiones';
import { splitNominaByDivisiones } from '@/lib/reconciliation/nomina-divisiones';
import { cn } from '@/lib/utils';

function StatusIcon({ status }: { status: ReconciliationRuleResult['status'] }) {
  if (status === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  if (status === 'error') return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
  return <HelpCircle className="w-4 h-4 text-zinc-500 shrink-0" />;
}

function statusLabel(status: ReconciliationRuleResult['status']) {
  if (status === 'insufficient_data') return 'Sin datos';
  if (status === 'ok') return 'Cuadra';
  if (status === 'warning') return 'Revisar';
  return 'No cuadra';
}

function formatValor(value: number | null, unidad?: string): string {
  if (value == null) return '—';
  const n = value.toLocaleString('es', { maximumFractionDigits: 2 });
  return unidad ? `${n} ${unidad}` : n;
}

function FuenteCelda({
  metricLabel,
  value,
  origen,
  unidad,
}: {
  metricLabel: string;
  value: number | null;
  origen: string;
  unidad?: string;
}) {
  return (
    <div className="max-w-[9rem] space-y-0.5">
      <p className="text-[9px] font-semibold text-zinc-400 leading-tight line-clamp-2">{metricLabel}</p>
      <p className="text-xs font-bold tabular-nums text-white/90">{formatValor(value, unidad)}</p>
      <p className="text-[8px] leading-snug text-zinc-600 line-clamp-2" title={origen}>
        {origen}
      </p>
    </div>
  );
}

function DesvioCelda({ rule }: { rule: ReconciliationRuleResult }) {
  const { deviationPct, deviation, tolerancePct } = rule;
  return (
    <div className="space-y-0.5 max-w-[5.5rem]">
      <p className="text-xs font-bold tabular-nums text-white/85">
        {deviationPct != null
          ? `${deviationPct > 0 ? '+' : ''}${deviationPct}%`
          : deviation != null
            ? deviation.toLocaleString('es', { maximumFractionDigits: 2 })
            : '—'}
      </p>
      {tolerancePct != null && (
        <p className="text-[9px] text-zinc-600">Tol. ±{tolerancePct}%</p>
      )}
    </div>
  );
}

function ReglaFila({
  rule,
  nominaDivisiones,
  onDrillDown,
}: {
  rule: ReconciliationRuleResult;
  nominaDivisiones: NominaDivisionParam[];
  onDrillDown: (ruleId: string) => void;
}) {
  const refNomina =
    rule.id === 'nomina_registros_semanas'
      ? Math.max(rule.valueA ?? 0, rule.valueB ?? 0)
      : 0;
  const splits =
    rule.id === 'nomina_registros_semanas' &&
    nominaDivisiones.length > 0 &&
    refNomina > 0
      ? splitNominaByDivisiones(refNomina, nominaDivisiones)
      : [];

  return (
    <>
      <tr className="border-b border-white/5 hover:bg-white/[0.02] align-top">
        <td className="px-3 py-2.5">
          <div className="flex items-start gap-2 min-w-0">
            <StatusIcon status={rule.status} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">{rule.label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{rule.description}</p>
              {rule.message && rule.status !== 'ok' && (
                <p className="text-[9px] text-zinc-600 mt-1 line-clamp-2">{rule.message}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-2 py-2.5">
          <FuenteCelda
            metricLabel={rule.labelA}
            value={rule.valueA}
            origen={rule.origenA}
            unidad={rule.unidadA}
          />
        </td>
        <td className="px-2 py-2.5">
          <FuenteCelda
            metricLabel={rule.labelB}
            value={rule.valueB}
            origen={rule.origenB}
            unidad={rule.unidadB}
          />
        </td>
        <td className="px-2 py-2.5">
          <DesvioCelda rule={rule} />
        </td>
        <td className="px-2 py-2.5">
          <span
            className={cn(
              'text-xs font-semibold block',
              rule.status === 'ok'
                ? 'text-emerald-400'
                : rule.status === 'warning'
                  ? 'text-amber-400'
                  : rule.status === 'error'
                    ? 'text-red-400'
                    : 'text-zinc-500',
            )}
          >
            {statusLabel(rule.status)}
          </span>
        </td>
        <td className="px-2 py-2.5">
          {rule.drillDown.length > 0 && rule.status !== 'insufficient_data' ? (
            <button
              type="button"
              onClick={() => onDrillDown(rule.id)}
              className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 whitespace-nowrap"
            >
              Ver detalle
            </button>
          ) : (
            <MinusCircle className="w-4 h-4 text-zinc-600" />
          )}
        </td>
      </tr>
      {splits.length > 0 && (
        <tr className="border-b border-white/5 bg-zinc-900/15">
          <td colSpan={6} className="px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">
              Reparto del total (${refNomina.toLocaleString('es')})
            </p>
            <p className="text-[10px] text-zinc-400 tabular-nums leading-relaxed">
              {splits.map((s, i) => (
                <span key={s.id}>
                  {i > 0 ? ' · ' : ''}
                  {s.nombre} {s.porcentaje}% (${s.montoUsd.toLocaleString('es')})
                </span>
              ))}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

export function ReconciliacionRulesMatrix({
  rules,
  nominaDivisiones = [],
  onDrillDown,
}: {
  rules: ReconciliationRuleResult[];
  nominaDivisiones?: NominaDivisionParam[];
  onDrillDown: (ruleId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-zinc-950/25 pt-1">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[17%]" />
          <col className="w-[17%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 pt-3 pb-2">Regla</th>
            <th className="px-2 pt-3 pb-2">Fuente A</th>
            <th className="px-2 pt-3 pb-2">Fuente B</th>
            <th className="px-2 pt-3 pb-2">Desvío</th>
            <th className="px-2 pt-3 pb-2">Estado</th>
            <th className="px-2 pt-3 pb-2" />
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <ReglaFila
              key={r.id}
              rule={r}
              nominaDivisiones={nominaDivisiones}
              onDrillDown={onDrillDown}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
