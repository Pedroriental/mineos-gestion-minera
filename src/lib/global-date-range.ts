export type GlobalDateSearchParams = {
  desde?: string;
  hasta?: string;
};

export function hasGlobalDateRange(params?: GlobalDateSearchParams | null): boolean {
  return Boolean(params?.desde && params?.hasta);
}

export function isFechaInGlobalRange(fecha?: string | null, params?: GlobalDateSearchParams | null): boolean {
  if (!fecha) return false;
  if (!hasGlobalDateRange(params) || !params?.desde || !params?.hasta) return true;
  return fecha >= params.desde && fecha <= params.hasta;
}

export function clampFechaToGlobalRange(fecha: string, params?: GlobalDateSearchParams | null): string {
  if (!hasGlobalDateRange(params) || !params?.desde || !params?.hasta) return fecha;
  if (fecha < params.desde) return params.desde;
  if (fecha > params.hasta) return params.hasta;
  return fecha;
}
