import type { Gasto } from '@/lib/types';

export const PRECIO_ORO_FALLBACK_USD = 99.68;

export type PrecioOroGasto = {
  usdPorGramo: number;
  fechaReferencia: string | null;
  fuente: string;
};

export function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

export function convertGramosToUsd(gramos: number, usdPorGramo: number): number {
  return roundUsd(gramos * usdPorGramo);
}

export function isGastoPagoOro(gasto: Pick<Gasto, 'monto_gramos_oro'>): boolean {
  return gasto.monto_gramos_oro != null && Number(gasto.monto_gramos_oro) > 0;
}

export function formatGastoOroResumen(gasto: Pick<Gasto, 'monto' | 'monto_gramos_oro' | 'precio_oro_usd_gramo'>): string {
  if (!isGastoPagoOro(gasto)) return '';
  const gramos = Number(gasto.monto_gramos_oro);
  const precio = Number(gasto.precio_oro_usd_gramo ?? 0);
  return `${gramos} g × $${precio.toFixed(2)}/g`;
}

/** Detecta registros legacy con gramos guardados en monto y nota de oro. */
export function isLegacyGastoOroNota(notas?: string | null): boolean {
  return (notas ?? '').toLowerCase().includes('pago en oro');
}
