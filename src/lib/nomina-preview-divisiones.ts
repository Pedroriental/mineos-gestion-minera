/** Divisiones informativas del 100% en vista previa (sin beneficiarios fijos). */

export type PreviewDivision = {
  id: string;
  porcentaje: number;
};

export const PREVIEW_DIVISIONES_STORAGE_KEY = 'mineos-nomina-preview-divisiones-v2';

export function createPreviewDivision(porcentaje = 0): PreviewDivision {
  return {
    id: `div_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    porcentaje,
  };
}

export function sumDivisionesPct(divisiones: PreviewDivision[]): number {
  return parseFloat(
    divisiones.reduce((s, d) => s + (Number(d.porcentaje) || 0), 0).toFixed(2),
  );
}

/** Reparte 100% en partes iguales (última parte absorbe redondeo). */
export function rebalanceDivisionesIgual(divisiones: PreviewDivision[]): PreviewDivision[] {
  if (!divisiones.length) return divisiones;
  const n = divisiones.length;
  const base = Math.floor(10000 / n) / 100;
  let rest = 100;
  return divisiones.map((d, i) => {
    const pct = i === n - 1 ? parseFloat(rest.toFixed(2)) : base;
    rest = parseFloat((rest - pct).toFixed(2));
    return { ...d, porcentaje: pct };
  });
}

/**
 * Al editar un %, el resto se completa en otra columna para sumar 100.
 * Con 1 columna → siempre 100%. Con 2+ → la última distinta a la editada absorbe el resto.
 */
export function applyDivisionPorcentaje(
  divisiones: PreviewDivision[],
  id: string,
  porcentaje: number,
): PreviewDivision[] {
  if (!divisiones.length) return divisiones;

  const n = divisiones.length;
  const pct = parseFloat(Math.min(100, Math.max(0, Number(porcentaje) || 0)).toFixed(2));

  if (n === 1) {
    return [{ ...divisiones[0], porcentaje: 100 }];
  }

  const idx = divisiones.findIndex((d) => d.id === id);
  if (idx < 0) return divisiones;

  const absorbIdx = idx === n - 1 ? n - 2 : n - 1;
  const updated = divisiones.map((d, i) => (i === idx ? { ...d, porcentaje: pct } : d));
  const othersExceptAbsorb = updated.reduce(
    (s, d, i) => (i === absorbIdx ? s : s + d.porcentaje),
    0,
  );
  const remainder = parseFloat((100 - othersExceptAbsorb).toFixed(2));
  const absorbed = parseFloat(Math.min(100, Math.max(0, remainder)).toFixed(2));

  return updated.map((d, i) => (i === absorbIdx ? { ...d, porcentaje: absorbed } : d));
}

export function splitByDivisiones(amount: number, divisiones: PreviewDivision[]): number[] {
  const total = Math.max(0, Number(amount) || 0);
  return divisiones.map((d) =>
    parseFloat(((total * (Number(d.porcentaje) || 0)) / 100).toFixed(2)),
  );
}

export function loadPreviewDivisionesFromStorage(): PreviewDivision[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PREVIEW_DIVISIONES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PreviewDivision[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((d) => ({
      id: String(d.id),
      porcentaje: Number(d.porcentaje) || 0,
    }));
  } catch {
    return [];
  }
}

export function savePreviewDivisionesToStorage(divisiones: PreviewDivision[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREVIEW_DIVISIONES_STORAGE_KEY, JSON.stringify(divisiones));
}
