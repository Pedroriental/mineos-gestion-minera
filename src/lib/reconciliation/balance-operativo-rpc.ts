import type { ReconciliationRawInputs } from '@/lib/reconciliation/types';

export type BalanceOperativoRpc = {
  fecha_inicio: string;
  fecha_fin: string;
  oro_planta_g: number;
  oro_quemado_g: number;
  sacos_extraccion: number;
  sacos_produccion: number;
  ton_procesadas: number;
  gastos_usd: number;
  nomina_registros_usd: number;
  nomina_semanas_usd: number;
  ventas_arenas_usd: number;
  precio_oro_usd: number;
  ingreso_oro_usd: number;
};

export type BalanceOperativoDivergence = {
  ingresoOroDiffUsd: number;
  nominaDiffUsd: number;
  gastosDiffUsd: number;
  flagged: boolean;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseBalanceOperativoRpc(
  data: Record<string, unknown> | null,
): BalanceOperativoRpc | null {
  if (!data) return null;
  return {
    fecha_inicio: String(data.fecha_inicio ?? ''),
    fecha_fin: String(data.fecha_fin ?? ''),
    oro_planta_g: num(data.oro_planta_g),
    oro_quemado_g: num(data.oro_quemado_g),
    sacos_extraccion: num(data.sacos_extraccion),
    sacos_produccion: num(data.sacos_produccion),
    ton_procesadas: num(data.ton_procesadas),
    gastos_usd: num(data.gastos_usd),
    nomina_registros_usd: num(data.nomina_registros_usd),
    nomina_semanas_usd: num(data.nomina_semanas_usd),
    ventas_arenas_usd: num(data.ventas_arenas_usd),
    precio_oro_usd: num(data.precio_oro_usd),
    ingreso_oro_usd: num(data.ingreso_oro_usd),
  };
}

export function buildBalanceOperativoDivergence(
  inputs: ReconciliationRawInputs,
  rpc: BalanceOperativoRpc | null,
  tolerancePct = 3,
): BalanceOperativoDivergence | null {
  if (!rpc) return null;

  const ingresoOroDiffUsd = inputs.ingresoOroUsd - rpc.ingreso_oro_usd;
  const nominaDiffUsd = inputs.gastoNominaUsd - rpc.nomina_semanas_usd;
  const gastosDiffUsd = inputs.gastoOperativoUsd - rpc.gastos_usd;
  const base = Math.max(inputs.ingresoOroUsd, 1);

  return {
    ingresoOroDiffUsd,
    nominaDiffUsd,
    gastosDiffUsd,
    flagged:
      Math.abs(ingresoOroDiffUsd) > base * (tolerancePct / 100) ||
      Math.abs(nominaDiffUsd) > Math.max(inputs.gastoNominaUsd, 1) * (tolerancePct / 100),
  };
}
