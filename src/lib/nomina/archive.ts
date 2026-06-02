import type { NominaPeriodoSummary } from '@/lib/nomina/types';

export function mapPeriodoRow(row: {
  id: string;
  label: string;
  range_start: string;
  range_end: string;
  total_usd: number;
  origen: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  semana_count?: number;
}): NominaPeriodoSummary {
  return {
    id: row.id,
    label: row.label,
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    totalUsd: Number(row.total_usd),
    origen: row.origen,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    semanaCount: row.semana_count ?? 0,
  };
}

export function aggregateSectionTotals(
  sections: Array<{ id: string; title: string; sectionTotal: number }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sections) {
    out[s.id] = (out[s.id] ?? 0) + s.sectionTotal;
  }
  return out;
}

export function validateImportTotals(
  expectedGrandTotal: number,
  computedGrandTotal: number,
  tolerance = 0.05,
): { ok: boolean; delta: number; message?: string } {
  const delta = parseFloat((computedGrandTotal - expectedGrandTotal).toFixed(2));
  if (Math.abs(delta) <= tolerance) return { ok: true, delta };
  return {
    ok: false,
    delta,
    message: `Total calculado ($${computedGrandTotal.toFixed(2)}) difiere del esperado ($${expectedGrandTotal.toFixed(2)}) en $${Math.abs(delta).toFixed(2)}`,
  };
}
