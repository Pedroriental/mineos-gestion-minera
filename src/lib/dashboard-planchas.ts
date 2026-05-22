import type { SupabaseClient } from '@supabase/supabase-js';

/** Respaldo si la tabla lineas_plancha aún no existe o está vacía */
const FALLBACK_LINES: Omit<PlanchaLineConfig, 'id'>[] = [
  {
    number: 1,
    label: 'Balance plancha 1',
    molinos: new Set([
      'molino 1',
      'molino 2',
      'molino 3',
      'molino 1-2',
      'molino 1-3',
      'molino 2-3',
      'molino 1-2-3',
    ]),
  },
  {
    number: 2,
    label: 'Balance plancha 2',
    molinos: new Set(['molino continuo']),
  },
  {
    number: 3,
    label: 'Balance plancha 3',
    molinos: new Set(['molino coco']),
  },
];

export type PlanchaLineConfig = {
  id: string;
  number: number;
  label: string;
  molinos: Set<string>;
};

export type PlanchaBalance = {
  id: string;
  number: number;
  label: string;
  grams: number;
};

export function normalizeMolinoKey(raw: string): string {
  const t = raw.trim();
  if (/^Molino\s+\d[-\d]+$/i.test(t)) return t.replace(/\s+/, ' ').toLowerCase();
  if (/^Molino\s+(continuo|coco|1|2|3)$/i.test(t)) return t.replace(/\s+/, ' ').toLowerCase();
  if (/^mantenimiento$/i.test(t)) return 'mantenimiento';
  return t.toLowerCase();
}

function formatMolinoLabel(key: string): string {
  if (!key.startsWith('molino ')) return key;
  const rest = key.slice(7);
  return `Molino ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}

/** Carga líneas activas desde Supabase; si falla o está vacío, usa respaldo en código */
export async function resolvePlanchaLines(supabase: SupabaseClient): Promise<PlanchaLineConfig[]> {
  const { data, error } = await supabase
    .from('lineas_plancha')
    .select('id, numero, nombre, molinos, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('numero', { ascending: true });

  if (!error && data && data.length > 0) {
    return data.map((row) => ({
      id: String(row.id),
      number: Number(row.numero),
      label: String(row.nombre),
      molinos: new Set(
        (Array.isArray(row.molinos) ? row.molinos : []).map((m) => normalizeMolinoKey(String(m))),
      ),
    }));
  }

  return FALLBACK_LINES.map((line) => ({
    ...line,
    id: `fallback-${line.number}`,
  }));
}

type ProduccionRow = { molino?: string | null; oro_recuperado_g?: number | null };

/**
 * Calcula balances por cada línea configurada.
 * Molinos con producción en el periodo que no pertenecen a ninguna línea
 * generan una tarjeta extra automáticamente.
 */
export function computePlanchaBalances(
  reportes: ProduccionRow[],
  lines: PlanchaLineConfig[],
): PlanchaBalance[] {
  const coveredMolinos = new Set<string>();
  for (const line of lines) {
    for (const m of line.molinos) coveredMolinos.add(m);
  }

  const balances: PlanchaBalance[] = lines.map((line) => {
    const grams = reportes
      .filter((r) => line.molinos.has(normalizeMolinoKey(String(r.molino ?? ''))))
      .reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);

    for (const m of line.molinos) coveredMolinos.add(m);

    return {
      id: line.id,
      number: line.number,
      label: line.label,
      grams: Math.round(grams * 100) / 100,
    };
  });

  const orphanGrams = new Map<string, number>();
  const orphanSeen = new Set<string>();

  for (const r of reportes) {
    const key = normalizeMolinoKey(String(r.molino ?? ''));
    if (!key || key === 'mantenimiento' || key === 'varios') continue;
    orphanSeen.add(key);
    if (coveredMolinos.has(key)) continue;
    orphanGrams.set(key, (orphanGrams.get(key) ?? 0) + Number(r.oro_recuperado_g ?? 0));
  }

  let orphanOrder = 9000;
  for (const key of [...orphanSeen].sort()) {
    if (coveredMolinos.has(key)) continue;
    balances.push({
      id: `molino-${key}`,
      number: orphanOrder++,
      label: `Balance ${formatMolinoLabel(key)}`,
      grams: Math.round((orphanGrams.get(key) ?? 0) * 100) / 100,
    });
  }

  return balances.sort((a, b) => a.number - b.number);
}

/** @deprecated Usar resolvePlanchaLines + computePlanchaBalances */
export function computeProductionPlanchaBalances(reportes: ProduccionRow[]): PlanchaBalance[] {
  const lines = FALLBACK_LINES.map((line) => ({ ...line, id: `fallback-${line.number}` }));
  return computePlanchaBalances(reportes, lines);
}
