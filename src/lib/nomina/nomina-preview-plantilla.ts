import type { Personal } from '@/lib/types';
import type { PersonalSnapshot } from '@/lib/nomina/types';
import { manualPeriodWeekStarts } from '@/lib/nomina/manual-period';
import {
  manualPlantillaCuadrillaOrder,
  manualPlantillaCuadrillaOrderForWeek,
  nominaRowBelongsToCuadrilla,
  resolveActiveCuadrillaIdsForWeek,
} from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { NominaPreviewImportSection, NominaRegistroCerrado } from '@/lib/nomina-preview';
import { getGrupoNominaKey } from '@/lib/personal-master';

export type ManualPeriodPlantillaContext = {
  rangeStart: string;
  rangeEnd: string;
  weekColumnAssignment?: string[];
  weekColumnCuadrillas?: string[][];
};

function previewTitlePrefix(plantilla: RotacionPlantillaRecord): string {
  return plantilla.area === 'planta' ? 'Semanas Molinos — ' : 'Semanas Mina Belén — ';
}

function summaryTitlePrefix(plantilla: RotacionPlantillaRecord): string {
  return plantilla.area === 'planta' ? 'Nómina ' : 'Nóminas ';
}

function manualPeriodWeekStartsForContext(manualPeriod: ManualPeriodPlantillaContext): string[] {
  if (manualPeriod.weekColumnAssignment?.length) {
    return manualPeriod.weekColumnAssignment;
  }
  return manualPeriodWeekStarts(manualPeriod.rangeStart, manualPeriod.rangeEnd);
}

/** Cuadrillas activas en al menos una semana del periodo manual (unión del ciclo). */
export function manualPeriodCuadrillaUnionOrder(
  manualPeriod: ManualPeriodPlantillaContext,
  plantilla: RotacionPlantillaRecord,
): string[] {
  const activeIdSet = new Set<string>();
  for (const weekStart of manualPeriodWeekStartsForContext(manualPeriod)) {
    for (const id of resolveActiveCuadrillaIdsForWeek(manualPeriod, weekStart, plantilla)) {
      activeIdSet.add(id);
    }
  }
  return manualPlantillaCuadrillaOrder(plantilla).filter((nombre) => {
    const cuadrilla = plantilla.cuadrillas.find((c) => c.nombre === nombre);
    return cuadrilla && activeIdSet.has(cuadrilla.id);
  });
}

export function plantillaSectionIdForCuadrillaNombre(
  plantilla: RotacionPlantillaRecord,
  cuadrillaNombre: string,
): string {
  const cuadrilla = plantilla.cuadrillas.find((c) => c.nombre === cuadrillaNombre);
  return cuadrilla ? `plantilla__${cuadrilla.id}` : `plantilla__${cuadrillaNombre}`;
}

/** Orden de secciones alineado con cuadrillas de la plantilla del periodo. */
export function buildPlantillaPreviewSectionOrder(
  plantilla: RotacionPlantillaRecord,
): NominaPreviewImportSection[] {
  const prefix = previewTitlePrefix(plantilla);
  return manualPlantillaCuadrillaOrder(plantilla).map((nombre) => {
    const id = plantillaSectionIdForCuadrillaNombre(plantilla, nombre);
    return { id, title: `${prefix}${nombre}` };
  });
}

/** Secciones del periodo manual: solo cuadrillas activas en alguna semana del ciclo. */
export function buildPlantillaPreviewSectionOrderForPeriod(
  plantilla: RotacionPlantillaRecord,
  manualPeriod: ManualPeriodPlantillaContext,
): NominaPreviewImportSection[] {
  const prefix = previewTitlePrefix(plantilla);
  return manualPeriodCuadrillaUnionOrder(manualPeriod, plantilla).map((nombre) => ({
    id: plantillaSectionIdForCuadrillaNombre(plantilla, nombre),
    title: `${prefix}${nombre}`,
  }));
}

/** Misma regla que Vista Semanal: primera cuadrilla activa en la semana que coincide. */
export function resolveCuadrillaNombreForWorkerWeek(
  p: Personal,
  plantilla: RotacionPlantillaRecord,
  manualPeriod: ManualPeriodPlantillaContext,
  weekStart: string,
): string | null {
  const activeIds = resolveActiveCuadrillaIdsForWeek(manualPeriod, weekStart, plantilla);
  const order = manualPlantillaCuadrillaOrderForWeek(plantilla, activeIds);
  const row = { personal: p, cuadrillaNombre: undefined as string | undefined };
  for (const nombre of order) {
    if (nominaRowBelongsToCuadrilla(row, nombre, plantilla)) {
      return nombre;
    }
  }
  return null;
}

/**
 * Agrupa filas del periodo completo: unión de cuadrillas activas + primera coincidencia
 * (alineado con groupRowsByPlantillaCuadrillas en NominaClient).
 */
function resolveCuadrillaNombreForWorker(
  p: Personal,
  plantilla: RotacionPlantillaRecord,
  manualPeriod?: ManualPeriodPlantillaContext,
): string | null {
  if (manualPeriod) {
    const order = manualPeriodCuadrillaUnionOrder(manualPeriod, plantilla);
    const row = { personal: p, cuadrillaNombre: undefined as string | undefined };
    for (const nombre of order) {
      if (nominaRowBelongsToCuadrilla(row, nombre, plantilla)) {
        return nombre;
      }
    }
    return null;
  }

  for (const nombre of manualPlantillaCuadrillaOrder(plantilla)) {
    if (nominaRowBelongsToCuadrilla({ personal: p }, nombre, plantilla)) {
      return nombre;
    }
  }
  return null;
}

/** Sección de vista previa según cuadrilla de plantilla (misma lógica que Vista Semanal). */
export function resolveWorkerPlantillaPreviewSection(
  p: Personal,
  plantilla: RotacionPlantillaRecord,
  manualPeriod?: ManualPeriodPlantillaContext,
  snapshot?: PersonalSnapshot | null,
): { id: string; title: string; subtitle: string } {
  const cuadrillaNombre = resolveCuadrillaNombreForWorker(p, plantilla, manualPeriod);
  if (cuadrillaNombre) {
    const prefix = previewTitlePrefix(plantilla);
    return {
      id: plantillaSectionIdForCuadrillaNombre(plantilla, cuadrillaNombre),
      title: `${prefix}${cuadrillaNombre}`,
      subtitle: plantilla.nombre,
    };
  }

  if (snapshot?.section_id && snapshot.section_title) {
    return { id: snapshot.section_id, title: snapshot.section_title, subtitle: '' };
  }

  const grupo = getGrupoNominaKey(p) || p.cargo || 'Sin asignación';
  const prefix = previewTitlePrefix(plantilla);
  return {
    id: `plantilla__orphan__${grupo}`,
    title: `${prefix}${grupo}`,
    subtitle: '',
  };
}

/** Totales por sección/cuadrilla atribuyendo cada pago a la semana en que se cerró. */
export function aggregatePlantillaSectionTotalsFromRegistros(input: {
  plantilla: RotacionPlantillaRecord;
  manualPeriod: ManualPeriodPlantillaContext;
  registros: NominaRegistroCerrado[];
  personalById: Map<string, Personal>;
  weekSet: Set<string>;
  filterArea?: string;
}): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of input.registros) {
    if (!input.weekSet.has(r.semana_inicio)) continue;
    if (input.filterArea && r.area !== input.filterArea) continue;
    const p = input.personalById.get(r.personal_id);
    if (!p) continue;

    const cuadrillaNombre = resolveCuadrillaNombreForWorkerWeek(
      p,
      input.plantilla,
      input.manualPeriod,
      r.semana_inicio,
    );
    const sectionId = cuadrillaNombre
      ? plantillaSectionIdForCuadrillaNombre(input.plantilla, cuadrillaNombre)
      : resolveWorkerPlantillaPreviewSection(p, input.plantilla, input.manualPeriod).id;

    totals.set(
      sectionId,
      parseFloat(((totals.get(sectionId) ?? 0) + Number(r.monto_pagado)).toFixed(2)),
    );
  }
  return totals;
}

export function plantillaSummaryLabel(title: string, plantilla?: RotacionPlantillaRecord): string {
  if (!plantilla) {
    return title.replace(/^Semanas Mina Belén — /, 'Nóminas ').replace(/^Semanas Molinos — /, 'Nómina ');
  }
  const previewPrefix = previewTitlePrefix(plantilla);
  const summaryPrefix = summaryTitlePrefix(plantilla);
  if (title.startsWith(previewPrefix)) {
    return summaryPrefix + title.slice(previewPrefix.length);
  }
  return title.replace(/^Semanas Mina Belén — /, 'Nóminas ').replace(/^Semanas Molinos — /, 'Nómina ');
}
