/** Reparto de totales de nómina entre beneficiarios (socios, cuentas, etc.). */

import {
  formatNominaDivisionLabel,
} from '@/lib/reconciliation/nomina-divisiones';

export type DistribucionParte = {
  id: string;
  nombre: string;
  porcentaje: number;
  pagoDirecto: number;
};

export type DistribucionLinea = DistribucionParte & {
  bruto: number;
  neto: number;
};

export const DISTRIBUCION_STORAGE_KEY = 'mineos-nomina-distribucion-v1';

export const DEFAULT_DISTRIBUCION_PARTES: DistribucionParte[] = [
  { id: 'pedro', nombre: '33,33%', porcentaje: 33.33, pagoDirecto: 0 },
  { id: 'darinel', nombre: '33,33%', porcentaje: 33.33, pagoDirecto: 0 },
  { id: 'la_fe', nombre: '33,34%', porcentaje: 33.34, pagoDirecto: 0 },
];

export function createDistribucionParte(porcentaje = 0): DistribucionParte {
  return {
    id: `parte_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nombre: formatNominaDivisionLabel(porcentaje),
    porcentaje,
    pagoDirecto: 0,
  };
}

export function sumPorcentajes(partes: DistribucionParte[]): number {
  return parseFloat(
    partes.reduce((s, p) => s + (Number(p.porcentaje) || 0), 0).toFixed(2),
  );
}

export function validateDistribucion(partes: DistribucionParte[]): {
  ok: boolean;
  sum: number;
  message?: string;
} {
  if (!partes.length) {
    return { ok: false, sum: 0, message: 'Agrega al menos un beneficiario.' };
  }
  for (const p of partes) {
    if (!p.nombre.trim()) {
      return { ok: false, sum: sumPorcentajes(partes), message: 'Todos los beneficiarios deben tener nombre.' };
    }
    if (p.porcentaje < 0) {
      return { ok: false, sum: sumPorcentajes(partes), message: 'Los porcentajes no pueden ser negativos.' };
    }
  }
  const sum = sumPorcentajes(partes);
  if (Math.abs(sum - 100) > 0.05) {
    return {
      ok: false,
      sum,
      message: `Los porcentajes deben sumar 100% (actual: ${sum.toFixed(2)}%).`,
    };
  }
  return { ok: true, sum };
}

/** Reparte 100% en partes iguales (última parte absorbe redondeo). */
export function rebalancePorcentajesIgual(partes: DistribucionParte[]): DistribucionParte[] {
  if (!partes.length) return partes;
  const n = partes.length;
  const base = Math.floor((10000 / n)) / 100;
  let rest = 100;
  return partes.map((p, i) => {
    const pct = i === n - 1 ? parseFloat(rest.toFixed(2)) : base;
    rest = parseFloat((rest - pct).toFixed(2));
    return { ...p, porcentaje: pct };
  });
}

export function computeDistribucion(
  totalNomina: number,
  partes: DistribucionParte[],
): DistribucionLinea[] {
  const total = Math.max(0, Number(totalNomina) || 0);
  return partes.map((p) => {
    const bruto = parseFloat(((total * (Number(p.porcentaje) || 0)) / 100).toFixed(2));
    const directo = Math.max(0, Number(p.pagoDirecto) || 0);
    const neto = parseFloat(Math.max(0, bruto - directo).toFixed(2));
    return { ...p, bruto, neto };
  });
}

export function loadDistribucionFromStorage(): DistribucionParte[] {
  if (typeof window === 'undefined') return [...DEFAULT_DISTRIBUCION_PARTES];
  try {
    const raw = localStorage.getItem(DISTRIBUCION_STORAGE_KEY);
    if (!raw) return [...DEFAULT_DISTRIBUCION_PARTES];
    const parsed = JSON.parse(raw) as DistribucionParte[];
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_DISTRIBUCION_PARTES];
    return parsed.map((p) => {
      const porcentaje = Number(p.porcentaje) || 0;
      return {
        id: String(p.id),
        nombre: formatNominaDivisionLabel(porcentaje),
        porcentaje,
        pagoDirecto: Number(p.pagoDirecto) || 0,
      };
    });
  } catch {
    return [...DEFAULT_DISTRIBUCION_PARTES];
  }
}

export function saveDistribucionToStorage(partes: DistribucionParte[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISTRIBUCION_STORAGE_KEY, JSON.stringify(partes));
}

/** Convierte cierre legacy (3 socios) a plantilla editable. */
export function distribucionFromCierreLegacy(cierre: {
  pct_pedro?: number;
  pct_darinel?: number;
  pct_la_fe?: number;
  monto_pedro?: number;
  monto_darinel?: number;
  monto_la_fe?: number;
  total_nomina_usd?: number;
  distribucion?: DistribucionParte[] | null;
}): DistribucionParte[] {
  if (cierre.distribucion?.length) {
    return cierre.distribucion.map((p) => ({
      id: String(p.id),
      nombre: String(p.nombre),
      porcentaje: Number(p.porcentaje) || 0,
      pagoDirecto: Number(p.pagoDirecto) || 0,
    }));
  }

  const total = Number(cierre.total_nomina_usd) || 0;
  const partes = [...DEFAULT_DISTRIBUCION_PARTES];
  const pcts = [
    Number(cierre.pct_pedro) || partes[0].porcentaje,
    Number(cierre.pct_darinel) || partes[1].porcentaje,
    Number(cierre.pct_la_fe) || partes[2].porcentaje,
  ];
  const montos = [
    Number(cierre.monto_pedro) || 0,
    Number(cierre.monto_darinel) || 0,
    Number(cierre.monto_la_fe) || 0,
  ];

  return partes.map((p, i) => {
    const brutoFromPct = total > 0 ? (total * pcts[i]) / 100 : 0;
    const pagoDirecto =
      brutoFromPct > 0 && montos[i] < brutoFromPct
        ? parseFloat((brutoFromPct - montos[i]).toFixed(2))
        : 0;
    return {
      ...p,
      porcentaje: pcts[i],
      pagoDirecto,
    };
  });
}

/** Para persistir en nomina_cierres (columnas legacy + JSON). */
export function distribucionToCierrePayload(
  totalNomina: number,
  partes: DistribucionParte[],
): {
  lineas: DistribucionLinea[];
  distribucion: DistribucionParte[];
  pct_pedro: number;
  pct_darinel: number;
  pct_la_fe: number;
  monto_pedro: number;
  monto_darinel: number;
  monto_la_fe: number;
} {
  const lineas = computeDistribucion(totalNomina, partes);
  const byId = Object.fromEntries(lineas.map((l) => [l.id, l]));

  const pedro = byId.pedro ?? lineas[0];
  const darinel = byId.darinel ?? lineas[1];
  const laFe = byId.la_fe ?? lineas[2];

  return {
    lineas,
    distribucion: partes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      porcentaje: p.porcentaje,
      pagoDirecto: p.pagoDirecto,
    })),
    pct_pedro: pedro?.porcentaje ?? 0,
    pct_darinel: darinel?.porcentaje ?? 0,
    pct_la_fe: laFe?.porcentaje ?? 0,
    monto_pedro: pedro?.neto ?? 0,
    monto_darinel: darinel?.neto ?? 0,
    monto_la_fe: laFe?.neto ?? 0,
  };
}
