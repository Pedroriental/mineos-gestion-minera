import type { ReconciliationRuleResult, RuleStatus } from '@/lib/reconciliation/types';

export const STATUS_CONFIG: Record<
  RuleStatus,
  {
    label: string;
    pill: string;
    row: string;
    iconBg: string;
    bar: string;
  }
> = {
  ok: {
    label: 'Cuadra',
    pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    row: 'border-l-emerald-500/80 bg-emerald-500/[0.04]',
    iconBg: 'bg-emerald-500/20',
    bar: 'bg-emerald-400',
  },
  warning: {
    label: 'Revisar',
    pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    row: 'border-l-amber-500/80 bg-amber-500/[0.04]',
    iconBg: 'bg-amber-500/20',
    bar: 'bg-amber-400',
  },
  error: {
    label: 'No cuadra',
    pill: 'bg-red-500/15 text-red-300 border-red-500/30',
    row: 'border-l-red-500/80 bg-red-500/[0.04]',
    iconBg: 'bg-red-500/20',
    bar: 'bg-red-400',
  },
  insufficient_data: {
    label: 'Sin datos',
    pill: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
    row: 'border-l-zinc-600 bg-zinc-900/30',
    iconBg: 'bg-zinc-700/40',
    bar: 'bg-zinc-600',
  },
};

export function formatNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('es-VE', { maximumFractionDigits: decimals });
}

export function countByStatus(rules: ReconciliationRuleResult[]) {
  return rules.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { ok: 0, warning: 0, error: 0, insufficient_data: 0 } as Record<RuleStatus, number>,
  );
}

export function deviationBarPct(rule: ReconciliationRuleResult): number {
  if (rule.deviationPct != null) return Math.min(100, rule.deviationPct);
  if (rule.tolerancePct != null && rule.tolerancePct > 0 && rule.deviationPct != null) {
    return Math.min(100, (rule.deviationPct / rule.tolerancePct) * 100);
  }
  return rule.status === 'ok' ? 8 : rule.status === 'warning' ? 55 : 92;
}
