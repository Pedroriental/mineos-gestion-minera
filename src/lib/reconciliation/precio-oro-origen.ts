import type { PrecioOroModo } from '@/lib/reconciliation/types';

/**
 * Texto de origen del precio para la UI (no el tag interno `fuente` de la fila).
 * - goldapi → cotización web GoldAPI.io
 * - fallback → último valor en tabla Supabase, sin pasar por la API ese día
 * - manual → biblioteca de variables
 */
export function buildPrecioOroOrigenUi(
  modo: PrecioOroModo,
  fuenteCruda: string,
): string {
  if (modo === 'manual') return 'Biblioteca';

  const f = fuenteCruda.trim().toLowerCase();
  if (f === 'goldapi' || f === 'api') return 'goldapi.io';
  if (f === 'fallback') return 'Supabase';
  if (f && f !== '—') return `Supabase · ${fuenteCruda.trim()}`;
  return 'Supabase';
}
