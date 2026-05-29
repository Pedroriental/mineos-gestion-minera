import type { ReconciliationSnapshot } from '@/lib/reconciliation/types';

export function downloadReconciliationCSV(snapshot: ReconciliationSnapshot) {
  const header = [
    'Regla',
    'Métrica A',
    'Origen A',
    'Valor A',
    'Métrica B',
    'Origen B',
    'Valor B',
    'Desvío %',
    'Tolerancia %',
    'Estado',
    'Mensaje',
  ];
  const lines = snapshot.rules.map((r) =>
    [
      r.label,
      r.labelA,
      r.origenA,
      r.valueA ?? '',
      r.labelB,
      r.origenB,
      r.valueB ?? '',
      r.deviationPct ?? '',
      r.tolerancePct ?? '',
      r.status,
      r.message,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  );
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reconciliacion_${snapshot.dateRange.from}_${snapshot.dateRange.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
