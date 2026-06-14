import type { Personal } from '@/lib/types';
import type { PersonalSnapshot } from '@/lib/nomina/types';
import {
  manualPlantillaCuadrillaOrder,
  nominaRowBelongsToCuadrilla,
  resolveCuadrillaForPersonal,
  resolveActiveCuadrillaIdsForWeek,
} from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { NominaPreviewImportSection } from '@/lib/nomina-preview';
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

/** Orden de secciones alineado con cuadrillas de la plantilla del periodo. */
export function buildPlantillaPreviewSectionOrder(
  plantilla: RotacionPlantillaRecord,
): NominaPreviewImportSection[] {
  const prefix = previewTitlePrefix(plantilla);
  return manualPlantillaCuadrillaOrder(plantilla).map((nombre) => {
    const cuadrilla = plantilla.cuadrillas.find((c) => c.nombre === nombre);
    const id = cuadrilla ? `plantilla__${cuadrilla.id}` : `plantilla__${nombre}`;
    return { id, title: `${prefix}${nombre}` };
  });
}

function resolveCuadrillaNombreForWorker(
  p: Personal,
  plantilla: RotacionPlantillaRecord,
  manualPeriod?: ManualPeriodPlantillaContext,
): string | null {
  const refWeek = manualPeriod?.rangeStart ?? '';
  const activeIds = manualPeriod
    ? resolveActiveCuadrillaIdsForWeek(manualPeriod, refWeek, plantilla)
    : plantilla.cuadrillas.map((c) => c.id);

  const fromResolver = resolveCuadrillaForPersonal(plantilla, p, activeIds);
  if (fromResolver) return fromResolver.nombre;

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
    const cuadrilla = plantilla.cuadrillas.find((c) => c.nombre === cuadrillaNombre);
    const prefix = previewTitlePrefix(plantilla);
    return {
      id: cuadrilla ? `plantilla__${cuadrilla.id}` : `plantilla__${cuadrillaNombre}`,
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
