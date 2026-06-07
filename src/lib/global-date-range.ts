export type GlobalDateSearchParams = {
  desde?: string;
  hasta?: string;
};

export function hasGlobalDateRange(params: GlobalDateSearchParams): boolean {
  return Boolean(params.desde && params.hasta);
}

export function isFechaInGlobalRange(fecha: string, params: GlobalDateSearchParams): boolean {
  if (!hasGlobalDateRange(params)) return true;
  return fecha >= params.desde! && fecha <= params.hasta!;
}

export function clampFechaToGlobalRange(fecha: string, params: GlobalDateSearchParams): string {
  if (!hasGlobalDateRange(params)) return fecha;
  if (fecha < params.desde!) return params.desde!;
  if (fecha > params.hasta!) return params.hasta!;
  return fecha;
}
