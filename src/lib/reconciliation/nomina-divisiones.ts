/** Reparto opcional del total de nómina en reconciliación (como vista previa). */

export type NominaDivisionParam = {
  id: string;
  nombre: string;
  porcentaje: number;
};

export const DEFAULT_NOMINA_DIVISIONES: NominaDivisionParam[] = [
  { id: 'pedro', nombre: 'Pedro Guajiro', porcentaje: 33.33 },
  { id: 'darinel', nombre: 'Darinel Riasco', porcentaje: 33.33 },
  { id: 'la_fe', nombre: 'Molinos La Fé', porcentaje: 33.34 },
];

export function sumNominaDivisionesPct(divisiones: NominaDivisionParam[]): number {
  return parseFloat(
    divisiones.reduce((s, d) => s + (Number(d.porcentaje) || 0), 0).toFixed(2),
  );
}

export function validateNominaDivisiones(divisiones: NominaDivisionParam[]): {
  ok: boolean;
  sum: number;
  message?: string;
} {
  if (!divisiones.length) return { ok: true, sum: 0 };
  for (const d of divisiones) {
    if (!d.nombre.trim()) {
      return { ok: false, sum: sumNominaDivisionesPct(divisiones), message: 'Cada parte debe tener nombre.' };
    }
    if (d.porcentaje < 0) {
      return { ok: false, sum: sumNominaDivisionesPct(divisiones), message: 'Los porcentajes no pueden ser negativos.' };
    }
  }
  const sum = sumNominaDivisionesPct(divisiones);
  if (Math.abs(sum - 100) > 0.05) {
    return { ok: false, sum, message: `Los porcentajes deben sumar 100% (actual: ${sum.toFixed(2)}%).` };
  }
  return { ok: true, sum };
}

export function parseNominaDivisionesJson(raw: string | null | undefined): NominaDivisionParam[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) return [];
    return parsed.map((d, i) => ({
      id: String((d as NominaDivisionParam).id || `parte_${i}`),
      nombre: String((d as NominaDivisionParam).nombre || `Parte ${i + 1}`),
      porcentaje: Number((d as NominaDivisionParam).porcentaje) || 0,
    }));
  } catch {
    return [];
  }
}

export function serializeNominaDivisionesJson(divisiones: NominaDivisionParam[]): string {
  return JSON.stringify(
    divisiones.map((d) => ({
      id: d.id,
      nombre: d.nombre.trim(),
      porcentaje: Number(d.porcentaje) || 0,
    })),
  );
}

export function splitNominaByDivisiones(
  amount: number,
  divisiones: NominaDivisionParam[],
): Array<NominaDivisionParam & { montoUsd: number }> {
  const total = Math.max(0, Number(amount) || 0);
  return divisiones.map((d) => ({
    ...d,
    montoUsd: parseFloat(((total * (Number(d.porcentaje) || 0)) / 100).toFixed(2)),
  }));
}

export function rebalanceNominaDivisionesIgual(divisiones: NominaDivisionParam[]): NominaDivisionParam[] {
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

export function applyNominaDivisionPorcentaje(
  divisiones: NominaDivisionParam[],
  id: string,
  porcentaje: number,
): NominaDivisionParam[] {
  if (!divisiones.length) return divisiones;
  const n = divisiones.length;
  const pct = parseFloat(Math.min(100, Math.max(0, Number(porcentaje) || 0)).toFixed(2));
  if (n === 1) return [{ ...divisiones[0], porcentaje: 100 }];
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

export function createNominaDivision(nombre = '', porcentaje = 0): NominaDivisionParam {
  return {
    id: `div_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nombre,
    porcentaje,
  };
}
