import type { ModuleFilters } from '@/lib/reports/report-types';
import type { ReconciliationFilters } from '@/lib/reconciliation/types';

function normalizeTextList(
  raw: string[] | { in: string[] } | string | number | undefined,
): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) return raw.length ? raw.map(String) : undefined;
  if (typeof raw === 'object' && 'in' in raw) {
    const list = Array.isArray((raw as { in?: unknown }).in)
      ? (raw as { in: unknown[] }).in
      : [];
    return list.length ? list.map(String) : undefined;
  }
  const str = String(raw).trim();
  if (!str) return undefined;
  if (str.includes(',')) {
    return str.split(',').map((part) => part.trim()).filter(Boolean);
  }
  return [str];
}

/** Parsea filtros molino/mina desde ModuleFilters (constructor o hub). */
export function parseOperationalFilters(
  filters?: ModuleFilters,
): ReconciliationFilters | undefined {
  if (!filters) return undefined;

  const molinos = normalizeTextList(filters.molino ?? filters.molinos);
  const minas = normalizeTextList(filters.mina ?? filters.minas);

  if (!molinos?.length && !minas?.length) return undefined;
  const out: ReconciliationFilters = {};
  if (molinos?.length) out.molinos = molinos;
  if (minas?.length) out.minas = minas;
  return out;
}

/** Construye ReconciliationFilters desde arrays explícitos (hub). */
export function buildOperationalFilters(
  molinos?: string[],
  minas?: string[],
): ReconciliationFilters | undefined {
  if (!molinos?.length && !minas?.length) return undefined;
  const out: ReconciliationFilters = {};
  if (molinos?.length) out.molinos = molinos;
  if (minas?.length) out.minas = minas;
  return out;
}
