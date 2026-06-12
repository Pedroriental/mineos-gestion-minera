import {
  resolveAsistenciaDesdePlantilla,
  resolveEstatusCuadrilla,
  posicionEfectivaCuadrilla,
} from '@/lib/rotacion-plantillas/projection';
import {
  calculateNominaRowPay,
  calculateExplicitAsistenciaPay,
  defaultDiasTrabajados,
  NOMINA_DIAS_POR_SEMANA,
} from '@/lib/nomina-calculo';
import type { ManualNominaPeriod } from '@/lib/nomina/manual-period';
import { resolveManualPeriodWeekColumn } from '@/lib/nomina/manual-period';
import { getGrupoNominaKey } from '@/lib/personal-master';
import {
  asignacionMatchesCuadrilla,
  cuadrillaMatchScore,
  personalMatchesCuadrilla,
} from '@/lib/rotacion-plantillas/sandbox-state';
import type { Personal } from '@/lib/types';
import type { NominaVale } from '@/lib/types';
import type {
  RotacionCuadrilla,
  RotacionPlantillaRecord,
  RotacionSemanaColumn,
  RotacionTrabajadorFila,
} from '@/lib/rotacion-plantillas/types';
import { estatusRotacionShort } from '@/lib/rotacion-plantillas/types';

export type ManualPlantillaWorkerContext = {
  cuadrillaId: string;
  cuadrillaNombre: string;
  posicionCiclo: number;
  semanaNombre: string;
  estatus: ReturnType<typeof resolveEstatusCuadrilla>;
  estatusLabel: string;
  estadoAsistencia: ReturnType<typeof resolveAsistenciaDesdePlantilla>['estadoAsistencia'];
  diasInputBloqueado: boolean;
};

export { weekIndexInManualPeriod } from '@/lib/nomina/manual-period';

/** Columnas de rotación de referencia (cuadrilla con más semanas en el ciclo). */
export function referenceRotationSemanas(plantilla: RotacionPlantillaRecord): RotacionSemanaColumn[] {
  if (!plantilla.cuadrillas.length) return [];
  let best = plantilla.cuadrillas[0].semanas;
  for (const c of plantilla.cuadrillas) {
    if (c.semanas.length > best.length) best = c.semanas;
  }
  return best;
}

export function buildDefaultWeekColumnCuadrillas(
  plantilla: RotacionPlantillaRecord,
  columnCount: number,
): string[][] {
  const allIds = plantilla.cuadrillas.map((c) => c.id);
  return Array.from({ length: columnCount }, () => [...allIds]);
}

export function resolveActiveCuadrillaIdsForWeek(
  period: Pick<
    ManualNominaPeriod,
    'weekColumnAssignment' | 'weekColumnCuadrillas' | 'rangeStart' | 'rangeEnd'
  >,
  weekStart: string,
  plantilla: RotacionPlantillaRecord,
): string[] {
  const allIds = plantilla.cuadrillas.map((c) => c.id);
  const colIdx = resolveManualPeriodWeekColumn(
    weekStart,
    period.rangeStart,
    period.rangeEnd,
    period.weekColumnAssignment,
  );
  const picked = period.weekColumnCuadrillas?.[colIdx];
  if (picked?.length) {
    const valid = new Set(allIds);
    return picked.filter((id) => valid.has(id));
  }
  return allIds;
}

export function resolveCuadrillaForPersonal(
  plantilla: RotacionPlantillaRecord,
  personal: Personal,
  activeCuadrillaIds: string[],
): RotacionCuadrilla | null {
  const active = plantilla.cuadrillas.filter((c) => activeCuadrillaIds.includes(c.id));
  const asignacion = getGrupoNominaKey(personal);

  if (asignacion) {
    const scored = active
      .map((c) => ({ cuadrilla: c, score: cuadrillaMatchScore(asignacion, c) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length) return scored[0].cuadrilla;
    return null;
  }

  const fromFila = active.find((c) => c.filas.some((f) => f.personalId === personal.id));
  if (fromFila) return fromFila;

  return active.find((c) => personalMatchesCuadrilla(personal, c)) ?? null;
}

export function resolveManualPlantillaWorkerForCuadrilla(
  cuadrilla: RotacionCuadrilla,
  weekStart: string,
  periodStart: string,
  periodEnd: string,
  weekColumnAssignment?: string[],
  fila?: RotacionTrabajadorFila,
): Omit<ManualPlantillaWorkerContext, 'cuadrillaId' | 'cuadrillaNombre'> | null {
  if (!cuadrilla.semanas.length) return null;

  const weekIdx = resolveManualPeriodWeekColumn(
    weekStart,
    periodStart,
    periodEnd,
    weekColumnAssignment,
  );
  const posicion = posicionEfectivaCuadrilla(cuadrilla.semanas.length, weekIdx);
  const estatus = resolveEstatusCuadrilla(cuadrilla, weekIdx, fila);
  if (!estatus) return null;

  const semana = cuadrilla.semanas[posicion];
  const { estadoAsistencia, diasInputBloqueado } = resolveAsistenciaDesdePlantilla(estatus);

  return {
    posicionCiclo: posicion,
    semanaNombre: semana?.nombre ?? `Semana ${posicion + 1}`,
    estatus,
    estatusLabel: estatusRotacionShort(estatus),
    estadoAsistencia,
    diasInputBloqueado,
  };
}

export function resolveManualPlantillaWorker(
  plantilla: RotacionPlantillaRecord,
  personal: Personal,
  weekStart: string,
  periodStart: string,
  periodEnd: string,
  weekColumnAssignment?: string[],
  weekColumnCuadrillas?: string[][],
): ManualPlantillaWorkerContext | null {
  const activeIds = resolveActiveCuadrillaIdsForWeek(
    {
      rangeStart: periodStart,
      rangeEnd: periodEnd,
      weekColumnAssignment,
      weekColumnCuadrillas,
    },
    weekStart,
    plantilla,
  );
  const cuadrilla = resolveCuadrillaForPersonal(plantilla, personal, activeIds);
  if (!cuadrilla) return null;

  const fila = cuadrilla.filas.find((f) => f.personalId === personal.id);
  const ctx = resolveManualPlantillaWorkerForCuadrilla(
    cuadrilla,
    weekStart,
    periodStart,
    periodEnd,
    weekColumnAssignment,
    fila,
  );
  if (!ctx) return null;

  return {
    cuadrillaId: cuadrilla.id,
    cuadrillaNombre: cuadrilla.nombre,
    ...ctx,
  };
}

/** IDs de personal en plantilla + cuadrillas vacías para UI */
export function manualPlantillaStructure(plantilla: RotacionPlantillaRecord) {
  const personalIds = [...new Set(plantilla.cuadrillas.flatMap((c) => c.filas.map((f) => f.personalId)))];
  const cuadrillasVacias = plantilla.cuadrillas.filter((c) => c.filas.length === 0);
  return { personalIds, cuadrillasVacias };
}

export function findCuadrillaForPersonal(
  plantilla: RotacionPlantillaRecord,
  personalId: string,
): RotacionCuadrilla | null {
  return plantilla.cuadrillas.find((c) => c.filas.some((f) => f.personalId === personalId)) ?? null;
}

export type ManualPlantillaNominaRow = {
  personal: Personal;
  esSemanaLibre: boolean;
  bonoTransporte: number;
  bonificaciones: number;
  deducciones: number;
  total: number;
  estadoAsistencia: ReturnType<typeof resolveAsistenciaDesdePlantilla>['estadoAsistencia'];
  diasTrabajados: number;
  salarioBaseCalculado: number;
  valesPendientes: NominaVale[];
  totalVales: number;
  novedadTurno: 'ACTIVO';
  novedadTurnoObs: string;
  cicloPosicion: number;
  diasInputBloqueado: boolean;
  rotacionFuente: 'plantilla' | 'legacy';
  cuadrillaNombre: string;
  posicionCiclo: number;
  estatusPlantillaLabel: string;
};

/** ¿La fila pertenece a esta cuadrilla de plantilla (por nombre o asignación)? */
export function nominaRowBelongsToCuadrilla(
  row: { personal: Personal; cuadrillaNombre?: string },
  cuadrillaNombre: string,
  plantilla: RotacionPlantillaRecord,
): boolean {
  // Cuadrilla ya resuelta en proyección / asignación manual: manda sobre filas de plantilla o fuzzy parcial.
  if (row.cuadrillaNombre?.trim()) {
    return row.cuadrillaNombre === cuadrillaNombre;
  }

  const cuadrilla = plantilla.cuadrillas.find((c) => c.nombre === cuadrillaNombre);
  if (!cuadrilla) return false;

  const asignacion = getGrupoNominaKey(row.personal);
  if (asignacion) {
    return asignacionMatchesCuadrilla(asignacion, cuadrilla);
  }

  if (cuadrilla.filas.some((f) => f.personalId === row.personal.id)) return true;
  return personalMatchesCuadrilla(row.personal, cuadrilla);
}

/** Fila para trabajador cargado manualmente sin coincidencia en plantilla de rotación. */
export function buildManualExplicitNominaRow(
  personal: Personal,
  weekStart: string,
  valesMap: Record<string, NominaVale[]>,
  cuadrillaNombreOverride?: string,
): ManualPlantillaNominaRow {
  const workerVales = valesMap[personal.id] ?? [];
  const totalVales = workerVales.reduce((s, v) => s + Number(v.monto), 0);
  const predicted = 'trabajada' as const;
  const pay = calculateExplicitAsistenciaPay({
    personal,
    estadoAsistencia: predicted,
    diasTrabajados: NOMINA_DIAS_POR_SEMANA,
    bonificaciones: 0,
    totalVales,
  });

  return {
    personal,
    esSemanaLibre: pay.esSemanaLibre,
    bonoTransporte: pay.bonoTransporte,
    bonificaciones: 0,
    deducciones: totalVales,
    total: pay.total,
    estadoAsistencia: predicted,
    diasTrabajados: NOMINA_DIAS_POR_SEMANA,
    salarioBaseCalculado: pay.salarioBaseCalculado,
    valesPendientes: workerVales,
    totalVales,
    novedadTurno: 'ACTIVO',
    novedadTurnoObs: '',
    cicloPosicion: 0,
    diasInputBloqueado: false,
    rotacionFuente: 'legacy',
    cuadrillaNombre: cuadrillaNombreOverride ?? getGrupoNominaKey(personal),
    posicionCiclo: 0,
    estatusPlantillaLabel: 'Carga manual',
  };
}

/** Filas de nómina para periodo manual: solo personal explícito (filas de plantilla + carga manual). */
export function buildManualPlantillaNominaRows(input: {
  plantilla: RotacionPlantillaRecord;
  personalCatalog: Personal[];
  personalIds: string[];
  weekStart: string;
  periodStart: string;
  periodEnd: string;
  weekColumnAssignment?: string[];
  weekColumnCuadrillas?: string[][];
  valesMap: Record<string, NominaVale[]>;
  weekEnd?: string;
  /** IDs cargados manualmente: no excluir por fecha de ingreso posterior a la semana. */
  forceIncludeIds?: string[];
}): ManualPlantillaNominaRow[] {
  const {
    plantilla,
    personalCatalog,
    personalIds,
    weekStart,
    periodStart,
    periodEnd,
    weekColumnAssignment,
    weekColumnCuadrillas,
    valesMap,
    weekEnd,
    forceIncludeIds,
  } = input;
  const forceInclude = new Set(forceIncludeIds ?? []);
  const catalogById = new Map(personalCatalog.map((p) => [p.id, p]));
  const activeCuadrillaIds = resolveActiveCuadrillaIdsForWeek(
    {
      rangeStart: periodStart,
      rangeEnd: periodEnd,
      weekColumnAssignment,
      weekColumnCuadrillas,
    },
    weekStart,
    plantilla,
  );
  const rows: ManualPlantillaNominaRow[] = [];

  for (const personalId of [...new Set(personalIds)]) {
    const p = catalogById.get(personalId);
    if (!p) continue;
    if (p.estatus && p.estatus !== 'ACTIVO') continue;
    if (
      weekEnd &&
      p.fecha_ingreso &&
      p.fecha_ingreso > weekEnd &&
      !forceInclude.has(personalId)
    ) {
      continue;
    }

    const rotacion = resolveManualPlantillaWorker(
      plantilla,
      p,
      weekStart,
      periodStart,
      periodEnd,
      weekColumnAssignment,
      weekColumnCuadrillas,
    );
    if (!rotacion) {
      const cuadrilla = resolveCuadrillaForPersonal(plantilla, p, activeCuadrillaIds);
      rows.push(buildManualExplicitNominaRow(p, weekStart, valesMap, cuadrilla?.nombre));
      continue;
    }

    const workerVales = valesMap[p.id] ?? [];
    const totalVales = workerVales.reduce((s, v) => s + Number(v.monto), 0);
    const predicted = rotacion.estadoAsistencia;
    const diasTrabajados = rotacion.diasInputBloqueado
      ? predicted === 'trabajada'
        ? NOMINA_DIAS_POR_SEMANA
        : predicted === 'no_laborado'
          ? 0
          : defaultDiasTrabajados(predicted)
      : defaultDiasTrabajados(predicted);

    const pay = calculateExplicitAsistenciaPay({
      personal: p,
      estadoAsistencia: predicted,
      diasTrabajados,
      bonificaciones: 0,
      totalVales,
      bonoTransporte: rotacion.diasInputBloqueado ? 0 : undefined,
    });

    rows.push({
      personal: p,
      esSemanaLibre: pay.esSemanaLibre,
      bonoTransporte: pay.bonoTransporte,
      bonificaciones: 0,
      deducciones: totalVales,
      total: pay.total,
      estadoAsistencia: predicted,
      diasTrabajados,
      salarioBaseCalculado: pay.salarioBaseCalculado,
      valesPendientes: workerVales,
      totalVales,
      novedadTurno: 'ACTIVO',
      novedadTurnoObs: '',
      cicloPosicion: rotacion.posicionCiclo,
      diasInputBloqueado: rotacion.diasInputBloqueado,
      rotacionFuente: 'plantilla',
      cuadrillaNombre: rotacion.cuadrillaNombre,
      posicionCiclo: rotacion.posicionCiclo,
      estatusPlantillaLabel: rotacion.estatusLabel,
    });
  }

  return rows.sort((a, b) => {
    const ca = plantilla.cuadrillas.find((c) => c.nombre === a.cuadrillaNombre)?.orden ?? 0;
    const cb = plantilla.cuadrillas.find((c) => c.nombre === b.cuadrillaNombre)?.orden ?? 0;
    if (ca !== cb) return ca - cb;
    return a.personal.nombre_completo.localeCompare(b.personal.nombre_completo, 'es');
  });
}

/** Orden de cuadrillas para agrupar la vista (incluye cuadrillas vacías). */
export function manualPlantillaCuadrillaOrder(plantilla: RotacionPlantillaRecord): string[] {
  return [...plantilla.cuadrillas].sort((a, b) => a.orden - b.orden).map((c) => c.nombre);
}

export function manualPlantillaCuadrillaOrderForWeek(
  plantilla: RotacionPlantillaRecord,
  activeCuadrillaIds: string[],
): string[] {
  const active = new Set(activeCuadrillaIds);
  return manualPlantillaCuadrillaOrder(plantilla).filter((nombre) => {
    const c = plantilla.cuadrillas.find((x) => x.nombre === nombre);
    return c && active.has(c.id);
  });
}
