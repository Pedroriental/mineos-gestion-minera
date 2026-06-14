import type { Personal } from '@/lib/types';
import type { PersonalSnapshot } from '@/lib/nomina/types';
import { manualPeriodWeekStarts } from '@/lib/nomina/manual-period';
import {
  manualPlantillaCuadrillaOrder,
  manualPlantillaCuadrillaOrderForWeek,
  nominaRowBelongsToCuadrilla,
  resolveActiveCuadrillaIdsForWeek,
  resolveManualPlantillaWorker,
  findCuadrillaForPersonal,
  resolveCuadrillaForPersonal,
} from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { NominaPreviewImportSection, NominaRegistroCerrado } from '@/lib/nomina-preview';
import { getGrupoNominaKey } from '@/lib/personal-master';

export type ManualPeriodPlantillaContext = {
  rangeStart: string;
  rangeEnd: string;
  weekColumnAssignment?: string[];
  weekColumnCuadrillas?: string[][];
  /** Nombres por columna (persistencia si cambian UUIDs de cuadrilla). */
  weekColumnCuadrillaNombres?: string[][];
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

function collectCuadrillaIdsFromPeriodMetadata(
  manualPeriod: ManualPeriodPlantillaContext,
  plantilla: RotacionPlantillaRecord,
): Set<string> {
  const activeIdSet = new Set<string>();
  const validIds = new Set(plantilla.cuadrillas.map((c) => c.id));

  for (const weekStart of manualPeriodWeekStartsForContext(manualPeriod)) {
    for (const id of resolveActiveCuadrillaIdsForWeek(manualPeriod, weekStart, plantilla)) {
      activeIdSet.add(id);
    }
  }

  // Unión explícita de todas las columnas guardadas (incluye cuadrillas solo activas en semanas tempranas).
  if (manualPeriod.weekColumnCuadrillas?.length) {
    for (const col of manualPeriod.weekColumnCuadrillas) {
      for (const id of col ?? []) {
        if (validIds.has(id)) activeIdSet.add(id);
      }
    }
  }

  if (manualPeriod.weekColumnCuadrillaNombres?.length) {
    const byName = new Map(
      plantilla.cuadrillas.map((c) => [c.nombre.trim().toLowerCase(), c.id]),
    );
    for (const col of manualPeriod.weekColumnCuadrillaNombres) {
      for (const nombre of col ?? []) {
        const id = byName.get(nombre.trim().toLowerCase());
        if (id) activeIdSet.add(id);
      }
    }
  }

  return activeIdSet;
}

/** Cuadrillas activas en al menos una semana del periodo manual (unión del ciclo). */
export function manualPeriodCuadrillaUnionOrder(
  manualPeriod: ManualPeriodPlantillaContext,
  plantilla: RotacionPlantillaRecord,
): string[] {
  const activeIdSet = collectCuadrillaIdsFromPeriodMetadata(manualPeriod, plantilla);
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

/** Secciones del periodo manual: cuadrillas del ciclo + las que aparecen en registros cerrados. */
export function buildPlantillaPreviewSectionOrderForPeriod(
  plantilla: RotacionPlantillaRecord,
  manualPeriod: ManualPeriodPlantillaContext,
  options?: {
    registros?: NominaRegistroCerrado[];
    personalById?: Map<string, Personal>;
    weekSet?: Set<string>;
  },
): NominaPreviewImportSection[] {
  const prefix = previewTitlePrefix(plantilla);
  const idSet = collectCuadrillaIdsFromPeriodMetadata(manualPeriod, plantilla);

  if (options?.registros && options.personalById && options.weekSet) {
    for (const r of options.registros) {
      if (!options.weekSet.has(r.semana_inicio)) continue;
      const p = options.personalById.get(r.personal_id);
      if (!p) continue;
      const section = resolveRegistroPlantillaSection(r, p, plantilla, manualPeriod);
      const cuadrillaId = plantilla.cuadrillas.find(
        (c) => plantillaSectionIdForCuadrillaNombre(plantilla, c.nombre) === section.id,
      )?.id;
      if (cuadrillaId) idSet.add(cuadrillaId);
    }
  }

  return manualPlantillaCuadrillaOrder(plantilla)
    .filter((nombre) => {
      const cuadrilla = plantilla.cuadrillas.find((c) => c.nombre === nombre);
      return cuadrilla && idSet.has(cuadrilla.id);
    })
    .map((nombre) => ({
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

/** Sección derivada de cuadrilla persistida en snapshot (cierre o import enriquecido). */
export function sectionMetaFromSnapshotCuadrilla(
  snapshot: PersonalSnapshot | null | undefined,
  plantilla: RotacionPlantillaRecord,
): { id: string; title: string } | null {
  if (snapshot?.section_id && snapshot?.section_title) {
    return { id: snapshot.section_id, title: snapshot.section_title };
  }

  const cuadrillaId = snapshot?.cuadrilla_id?.trim() || null;
  const cuadrillaNombre = snapshot?.cuadrilla_nombre?.trim() || null;
  if (!cuadrillaId && !cuadrillaNombre) return null;

  const nombre =
    cuadrillaNombre ??
    plantilla.cuadrillas.find((c) => c.id === cuadrillaId)?.nombre ??
    '';
  if (!nombre) return null;

  const prefix = previewTitlePrefix(plantilla);
  return {
    id: plantillaSectionIdForCuadrillaNombre(plantilla, nombre),
    title: `${prefix}${nombre}`,
  };
}

/** Sección de un registro cerrado: snapshot > rotación por semana > heurística. */
export function resolveRegistroPlantillaSection(
  registro: NominaRegistroCerrado,
  personal: Personal,
  plantilla: RotacionPlantillaRecord,
  manualPeriod?: ManualPeriodPlantillaContext,
): { id: string; title: string } {
  const fromSnap = sectionMetaFromSnapshotCuadrilla(registro.personal_snapshot, plantilla);
  if (fromSnap) return fromSnap;

  if (manualPeriod) {
    const ctx = resolveManualPlantillaWorker(
      plantilla,
      personal,
      registro.semana_inicio,
      manualPeriod.rangeStart,
      manualPeriod.rangeEnd,
      manualPeriod.weekColumnAssignment,
      manualPeriod.weekColumnCuadrillas,
    );
    if (ctx) {
      const prefix = previewTitlePrefix(plantilla);
      return {
        id: plantillaSectionIdForCuadrillaNombre(plantilla, ctx.cuadrillaNombre),
        title: `${prefix}${ctx.cuadrillaNombre}`,
      };
    }

    const activeIds = resolveActiveCuadrillaIdsForWeek(
      manualPeriod,
      registro.semana_inicio,
      plantilla,
    );
    const filaCuadrilla = findCuadrillaForPersonal(plantilla, personal.id);
    if (filaCuadrilla && activeIds.includes(filaCuadrilla.id)) {
      const prefix = previewTitlePrefix(plantilla);
      return {
        id: plantillaSectionIdForCuadrillaNombre(plantilla, filaCuadrilla.nombre),
        title: `${prefix}${filaCuadrilla.nombre}`,
      };
    }

    const resolvedCuadrilla = resolveCuadrillaForPersonal(plantilla, personal, activeIds);
    if (resolvedCuadrilla) {
      const prefix = previewTitlePrefix(plantilla);
      return {
        id: plantillaSectionIdForCuadrillaNombre(plantilla, resolvedCuadrilla.nombre),
        title: `${prefix}${resolvedCuadrilla.nombre}`,
      };
    }
  }

  return resolveWorkerPlantillaPreviewSection(personal, plantilla, manualPeriod, registro.personal_snapshot);
}

/** Ubica al trabajador en la cuadrilla donde más pagó en el periodo (registros cerrados). */
export function resolveWorkerPlantillaPreviewSectionFromRegistros(
  p: Personal,
  registros: NominaRegistroCerrado[],
  weekSet: Set<string>,
  plantilla: RotacionPlantillaRecord,
  manualPeriod?: ManualPeriodPlantillaContext,
  snapshot?: PersonalSnapshot | null,
): { id: string; title: string; subtitle: string } {
  const workerRegs = registros.filter(
    (r) => r.personal_id === p.id && weekSet.has(r.semana_inicio),
  );

  for (const r of workerRegs) {
    const fromSnap = sectionMetaFromSnapshotCuadrilla(r.personal_snapshot, plantilla);
    if (fromSnap) {
      return { ...fromSnap, subtitle: plantilla.nombre };
    }
  }

  const bySection = new Map<string, { id: string; title: string; total: number }>();
  for (const r of workerRegs) {
    const meta = resolveRegistroPlantillaSection(r, p, plantilla, manualPeriod);
    const prev = bySection.get(meta.id);
    const add = Number(r.monto_pagado);
    bySection.set(meta.id, {
      id: meta.id,
      title: meta.title,
      total: (prev?.total ?? 0) + add,
    });
  }

  let best: { id: string; title: string; total: number } | null = null;
  for (const entry of bySection.values()) {
    if (!best || entry.total > best.total) best = entry;
  }
  if (best) {
    return { id: best.id, title: best.title, subtitle: plantilla.nombre };
  }

  return resolveWorkerPlantillaPreviewSection(p, plantilla, manualPeriod, snapshot);
}

/** Sección de vista previa según cuadrilla de plantilla (misma lógica que Vista Semanal). */
export function resolveWorkerPlantillaPreviewSection(
  p: Personal,
  plantilla: RotacionPlantillaRecord,
  manualPeriod?: ManualPeriodPlantillaContext,
  snapshot?: PersonalSnapshot | null,
): { id: string; title: string; subtitle: string } {
  const fromSnap = sectionMetaFromSnapshotCuadrilla(snapshot, plantilla);
  if (fromSnap) {
    return { ...fromSnap, subtitle: plantilla.nombre };
  }

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

    const section = resolveRegistroPlantillaSection(r, p, input.plantilla, input.manualPeriod);

    totals.set(
      section.id,
      parseFloat(((totals.get(section.id) ?? 0) + Number(r.monto_pagado)).toFixed(2)),
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
