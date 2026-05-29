import { format, parseISO } from 'date-fns';
import type { MacroSummary } from '@/lib/reconciliation/types';

function fechaCacheLegible(fecha: string): string {
  try {
    return format(parseISO(fecha), 'dd/MM/yyyy');
  } catch {
    return fecha;
  }
}

/** Precio + origen real + fecha en una sola línea (tarjetas KPI, etc.). */
export function formatPrecioOroConFuente(macro: MacroSummary): string {
  const parts = [`$${macro.precioOroUsd.toFixed(2)}/g`, macro.precioOroOrigenUi];
  if (macro.precioOroModo === 'cache' && macro.precioOroFechaCache) {
    parts.push(fechaCacheLegible(macro.precioOroFechaCache));
  }
  return parts.join(' · ');
}
