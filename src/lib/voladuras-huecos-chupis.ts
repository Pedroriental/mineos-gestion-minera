import type { ReporteVoladura } from '@/lib/types';

export const TIPOS_HUECO = [
  { value: 'hueco', label: 'Hueco' },
  { value: 'hueco_salida', label: 'Hueco de Salida' },
] as const;

export type TipoHuecoVoladura = (typeof TIPOS_HUECO)[number]['value'];

export interface LineaHuecoVoladura {
  tipo: TipoHuecoVoladura;
  cantidad: number;
  pies: number;
}

export interface LineaChupiVoladura {
  cantidad: number;
  pies: number;
}

export type HuecoLineaForm = {
  tipo: TipoHuecoVoladura;
  cantidad: string;
  pies: string;
};

export type ChupiLineaForm = {
  cantidad: string;
  pies: string;
};

export function labelTipoHueco(tipo: TipoHuecoVoladura): string {
  return TIPOS_HUECO.find((t) => t.value === tipo)?.label ?? tipo;
}

export function emptyHuecoLinea(): HuecoLineaForm {
  return { tipo: 'hueco', cantidad: '', pies: '' };
}

export function emptyChupiLinea(): ChupiLineaForm {
  return { cantidad: '', pies: '' };
}

export function aggregateHuecosLineas(lineas: LineaHuecoVoladura[]): { cantidad: number; pies: number } {
  const cantidad = lineas.reduce((sum, linea) => sum + linea.cantidad, 0);
  if (cantidad <= 0) return { cantidad: 0, pies: 0 };
  const piesPonderado = lineas.reduce((sum, linea) => sum + linea.cantidad * linea.pies, 0) / cantidad;
  return { cantidad, pies: Math.round(piesPonderado) };
}

export function aggregateChupisLineas(lineas: LineaChupiVoladura[]): { cantidad: number; pies: number } {
  const cantidad = lineas.reduce((sum, linea) => sum + linea.cantidad, 0);
  if (cantidad <= 0) return { cantidad: 0, pies: 0 };
  const piesPonderado = lineas.reduce((sum, linea) => sum + linea.cantidad * linea.pies, 0) / cantidad;
  return { cantidad, pies: Math.round(piesPonderado) };
}

export function normalizeHuecosLineas(raw: HuecoLineaForm[]): LineaHuecoVoladura[] {
  return raw
    .map((linea) => ({
      tipo: linea.tipo,
      cantidad: Math.max(0, Number.parseInt(linea.cantidad, 10) || 0),
      pies: Math.max(0, Number.parseInt(linea.pies, 10) || 0),
    }))
    .filter((linea) => linea.cantidad > 0);
}

export function normalizeChupisLineas(raw: ChupiLineaForm[]): LineaChupiVoladura[] {
  return raw
    .map((linea) => ({
      cantidad: Math.max(0, Number.parseInt(linea.cantidad, 10) || 0),
      pies: Math.max(0, Number.parseInt(linea.pies, 10) || 0),
    }))
    .filter((linea) => linea.cantidad > 0);
}

export function huecosLineasFromRecord(record: ReporteVoladura): HuecoLineaForm[] {
  if (record.huecos_lineas?.length) {
    return record.huecos_lineas.map((linea) => ({
      tipo: linea.tipo,
      cantidad: String(linea.cantidad),
      pies: String(linea.pies),
    }));
  }
  if (record.huecos_cantidad > 0 || record.huecos_pies > 0) {
    return [{
      tipo: 'hueco',
      cantidad: String(record.huecos_cantidad),
      pies: String(record.huecos_pies),
    }];
  }
  return [emptyHuecoLinea()];
}

export function chupisLineasFromRecord(record: ReporteVoladura): ChupiLineaForm[] {
  if (record.chupis_lineas?.length) {
    return record.chupis_lineas.map((linea) => ({
      cantidad: String(linea.cantidad),
      pies: String(linea.pies),
    }));
  }
  if (record.chupis_cantidad > 0 || record.chupis_pies > 0) {
    return [{
      cantidad: String(record.chupis_cantidad),
      pies: String(record.chupis_pies),
    }];
  }
  return [emptyChupiLinea()];
}

export function resolveHuecosLineas(record: ReporteVoladura): LineaHuecoVoladura[] {
  if (record.huecos_lineas?.length) return record.huecos_lineas;
  if (record.huecos_cantidad > 0) {
    return [{ tipo: 'hueco', cantidad: record.huecos_cantidad, pies: record.huecos_pies }];
  }
  return [];
}

export function resolveChupisLineas(record: ReporteVoladura): LineaChupiVoladura[] {
  if (record.chupis_lineas?.length) return record.chupis_lineas;
  if (record.chupis_cantidad > 0) {
    return [{ cantidad: record.chupis_cantidad, pies: record.chupis_pies }];
  }
  return [];
}
