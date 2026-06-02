import { predictWeekPay } from '@/lib/nomina-calculo';
import type { EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';
import type { ResolvedNominaCell } from '@/lib/nomina/types';

export function archiveKey(personalId: string, weekStart: string, area: string): string {
  return `${personalId}|${weekStart}|${area}`;
}

export function buildArchiveMap(
  registros: NominaRegistroCerrado[],
): Map<string, NominaRegistroCerrado> {
  const map = new Map<string, NominaRegistroCerrado>();
  for (const r of registros) {
    map.set(archiveKey(r.personal_id, r.semana_inicio, r.area), r);
  }
  return map;
}

export function resolveNominaCell(input: {
  personal: Personal;
  weekStart: string;
  area: string;
  archive: Map<string, NominaRegistroCerrado>;
  valesDeduccion?: number;
  /** Si false, no proyectar — solo archivo */
  allowProjection?: boolean;
  /** Si la semana está cerrada para esta área */
  isWeekClosed?: boolean;
}): ResolvedNominaCell {
  const { personal, weekStart, area, archive, valesDeduccion = 0, allowProjection = true, isWeekClosed = false } = input;
  const closed = archive.get(archiveKey(personal.id, weekStart, area));

  if (closed) {
    const estado =
      (closed.estado_asistencia as EstadoAsistenciaNomina | undefined) ??
      (closed.es_semana_libre ? 'libre' : 'trabajada');
    return {
      amount: Number(closed.monto_pagado),
      estado,
      source: 'archivo',
      diasTrabajados: closed.dias_trabajados ?? undefined,
    };
  }

  if (isWeekClosed || !allowProjection) {
    return { amount: 0, estado: 'no_laborado', source: 'proyeccion' };
  }

  const pred = predictWeekPay(personal, weekStart, valesDeduccion);
  return {
    amount: pred.amount,
    estado: pred.estado,
    source: 'proyeccion',
    diasTrabajados: pred.diasTrabajados,
  };
}

export function isWeekFullyArchived(
  weekStart: string,
  area: string,
  rosterIds: string[],
  archive: Map<string, NominaRegistroCerrado>,
): boolean {
  if (!rosterIds.length) return false;
  return rosterIds.every((id) => archive.has(archiveKey(id, weekStart, area)));
}
