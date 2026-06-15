import type { Gasto } from '@/lib/types';

const INSUMO_NAME_PATTERN =
  /insumo|explosiv|combustible|lubric|herramient|epp|cemento|material|detonante|dinamita|alimentaci|harina|gasoil|diesel|gasolina/i;

/** Clasifica un gasto como insumo (materiales) u operativo general. */
export function isGastoInsumo(gasto: Gasto): boolean {
  const nombre = gasto.categorias_gasto?.nombre ?? '';
  const descripcion = gasto.descripcion ?? '';
  return INSUMO_NAME_PATTERN.test(nombre) || INSUMO_NAME_PATTERN.test(descripcion);
}

export function splitGastoMonto(gasto: Gasto): { insumos: number; operativo: number } {
  const monto = Number(gasto.monto ?? 0);
  return isGastoInsumo(gasto) ? { insumos: monto, operativo: 0 } : { insumos: 0, operativo: monto };
}
