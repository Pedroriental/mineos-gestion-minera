export type TipoNovedadManual =
  | 'PAGO_EXTRAORDINARIO'
  | 'BONO'
  | 'DIAS_ADICIONALES'
  | 'AJUSTE'
  | 'REPOSO'
  | 'OTRO';

export const TIPO_NOVEDAD_LABELS: Record<TipoNovedadManual, string> = {
  PAGO_EXTRAORDINARIO: 'Pago Extraordinario',
  BONO: 'Bono Especial',
  DIAS_ADICIONALES: 'Días Adicionales',
  AJUSTE: 'Ajuste de Sueldo',
  REPOSO: 'Reposo / Ausencia',
  OTRO: 'Otro',
};

export interface NominaNovedadManual {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  tipo: TipoNovedadManual;
  montoUsd: number;
  detalle: string;
  area: string;
  semanaInicio: string;
  createdAt: string;
}

export function getNovedadesManualesKey(area: string, weekStart: string): string {
  return `mineos-nomina-novedades-manuales:${area}:${weekStart}`;
}

export function readNovedadesManuales(area: string, weekStart: string): NominaNovedadManual[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getNovedadesManualesKey(area, weekStart));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeNovedadesManuales(
  area: string,
  weekStart: string,
  items: NominaNovedadManual[],
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getNovedadesManualesKey(area, weekStart), JSON.stringify(items));
  } catch (err) {
    console.error('Error guardando novedades manuales:', err);
  }
}

import type { NominaPreviewNovedad } from '@/lib/nomina-preview';

export function totalNovedadesManuales(items: NominaNovedadManual[]): number {
  return items.reduce((sum, item) => sum + (Number(item.montoUsd) || 0), 0);
}

export function mapNovedadManualToPreview(n: NominaNovedadManual): NominaPreviewNovedad {
  return {
    id: n.id,
    fecha: n.semanaInicio,
    nombre: n.nombre,
    cedula: n.cedula,
    area: n.area,
    tipo: TIPO_NOVEDAD_LABELS[n.tipo] || n.tipo,
    detalle: n.detalle
      ? `${n.detalle}${n.cargo ? ` · Cargo: ${n.cargo}` : ''}`
      : n.cargo ? `Cargo: ${n.cargo}` : 'Pago extraordinario',
    monto: n.montoUsd,
  };
}
