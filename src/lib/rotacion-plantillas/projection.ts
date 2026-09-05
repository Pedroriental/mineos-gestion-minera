import type { EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import { getGrupoNominaKey } from '@/lib/personal-master';
import type { Personal } from '@/lib/types';
import { asignacionMatchesCuadrilla, resolveCeldaEstatus } from '@/lib/rotacion-plantillas/sandbox-state';
import { semanaEnPeriodoOperativo } from '@/lib/rotacion-plantillas/period-scope';
import {
  coerceEstatusPlantillaParaEsquema,
  diasInputBloqueadosPorPlantilla,
  estatusPlantillaToAsistencia,
} from '@/lib/rotacion-plantillas/semana-cierre';
import type {
  EstatusRotacionPlantilla,
  RotacionCuadrilla,
  RotacionPlantillaRecord,
  RotacionSemanaColumn,
  RotacionTrabajadorFila,
} from '@/lib/rotacion-plantillas/types';
import { estatusRotacionShort } from '@/lib/rotacion-plantillas/types';

export type InstanciaCuadrillaSnapshot = {
  id: string;
  cuadrillaId: string;
  cuadrillaNombre: string;
  asignacionKey: string;
  posicionActiva: number;
  estado: 'ACTIVA' | 'COMPLETADA' | 'PAUSADA';
  ciclosCompletados: number;
  desfaseInicial: number;
  semanas: RotacionSemanaColumn[];
  filas: RotacionTrabajadorFila[];
  modoRepeticion: 'continua' | 'pausa';
};

export type PeriodoOperativoSnapshot = {
  label: string;
  inicio: string;
  fin: string;
} | null;

export type InstanciaActivaSnapshot = {
  id: string;
  plantillaId: string;
  plantillaNombre: string;
  area: string;
  fechaInicioCiclo: string;
  periodoOperativo: PeriodoOperativoSnapshot;
  estado: 'ACTIVA' | 'COMPLETADA' | 'CANCELADA';
  cuadrillas: InstanciaCuadrillaSnapshot[];
  /** personalId → cuadrillaId */
  personalCuadrillaMap: Map<string, string>;
};

export type WorkerRotacionContext = {
  fuente: 'plantilla';
  cuadrillaId: string;
  cuadrillaNombre: string;
  posicionCiclo: number;
  semanaNombre: string;
  estatus: EstatusRotacionPlantilla;
  estatusLabel: string;
  estadoAsistencia: EstadoAsistenciaNomina;
  diasInputBloqueado: boolean;
};

export function posicionEfectivaCuadrilla(
  totalSemanas: number,
  posicionActiva: number,
): number {
  if (totalSemanas <= 0) return 0;
  return ((posicionActiva % totalSemanas) + totalSemanas) % totalSemanas;
}

export function resolveEstatusCuadrilla(
  cuadrilla: Pick<RotacionCuadrilla, 'semanas'>,
  posicion: number,
  fila?: RotacionTrabajadorFila,
): EstatusRotacionPlantilla | null {
  const idx = posicionEfectivaCuadrilla(cuadrilla.semanas.length, posicion);
  const semana = cuadrilla.semanas[idx];
  if (!semana) return null;
  if (fila) return resolveCeldaEstatus(fila, semana);
  return semana.estatusDefault;
}

export function resolveAsistenciaDesdePlantilla(estatus: EstatusRotacionPlantilla): {
  estadoAsistencia: EstadoAsistenciaNomina;
  diasInputBloqueado: boolean;
} {
  return {
    estadoAsistencia: estatusPlantillaToAsistencia(estatus),
    diasInputBloqueado: diasInputBloqueadosPorPlantilla(estatus),
  };
}

export function buildInstanciaSnapshot(
  instancia: {
    id: string;
    plantilla_id: string;
    fecha_inicio_ciclo: string;
    estado: string;
    periodo_operativo_label?: string | null;
    periodo_operativo_inicio?: string | null;
    periodo_operativo_fin?: string | null;
  },
  plantilla: RotacionPlantillaRecord,
  instanciaCuadrillas: Array<{
    id: string;
    cuadrilla_id: string;
    posicion_activa: number;
    estado: string;
    ciclos_completados: number;
  }>,
  cuadrillasDb: Array<{
    id: string;
    nombre: string;
    asignacion_key: string | null;
    desfase_inicial?: number;
    modo_repeticion?: string;
  }>,
): InstanciaActivaSnapshot {
  const cuadrillaMeta = new Map((cuadrillasDb ?? []).map((c) => [c.id, c]));
  const plantillaCuadrillaMap = new Map((plantilla?.cuadrillas ?? []).map((c) => [c.id, c]));

  const personalCuadrillaMap = new Map<string, string>();
  (plantilla?.cuadrillas ?? []).forEach((c) => {
    (c?.filas ?? []).forEach((f) => {
      if (f?.personalId && c?.id) {
        personalCuadrillaMap.set(f.personalId, c.id);
      }
    });
  });

  const cuadrillas: InstanciaCuadrillaSnapshot[] = (instanciaCuadrillas ?? []).map((ic) => {
    const meta = cuadrillaMeta.get(ic.cuadrilla_id);
    const cuadrilla = plantillaCuadrillaMap.get(ic.cuadrilla_id);
    return {
      id: ic.id,
      cuadrillaId: ic.cuadrilla_id,
      cuadrillaNombre: meta?.nombre ?? cuadrilla?.nombre ?? 'Cuadrilla',
      asignacionKey: meta?.asignacion_key ?? cuadrilla?.asignacionKey ?? '',
      posicionActiva: ic.posicion_activa,
      estado: (ic.estado as InstanciaCuadrillaSnapshot['estado']) || 'ACTIVA',
      ciclosCompletados: ic.ciclos_completados ?? 0,
      desfaseInicial: meta?.desfase_inicial ?? 0,
      modoRepeticion: (meta?.modo_repeticion as 'continua' | 'pausa') ?? 'continua',
      semanas: cuadrilla?.semanas ?? [],
      filas: cuadrilla?.filas ?? [],
    };
  });

  return {
    id: instancia.id,
    plantillaId: instancia.plantilla_id,
    plantillaNombre: plantilla.nombre,
    area: plantilla.area,
    fechaInicioCiclo: instancia.fecha_inicio_ciclo,
    periodoOperativo: instancia.periodo_operativo_inicio
      ? {
          label: instancia.periodo_operativo_label ?? '',
          inicio: instancia.periodo_operativo_inicio,
          fin: instancia.periodo_operativo_fin ?? instancia.periodo_operativo_inicio,
        }
      : null,
    estado: instancia.estado as InstanciaActivaSnapshot['estado'],
    cuadrillas,
    personalCuadrillaMap,
  };
}

/** La proyección por plantilla aplica a cualquier semana desde el inicio de ciclo mientras la instancia esté activa. */
export function semanaAplicaInstanciaRotacion(
  weekStart: string,
  instancia: InstanciaActivaSnapshot,
): boolean {
  return weekStart >= instancia.fechaInicioCiclo;
}

export function findCuadrillaForPersonal(
  snapshot: InstanciaActivaSnapshot,
  personalId: string,
): InstanciaCuadrillaSnapshot | null {
  const cuadrillaId = snapshot.personalCuadrillaMap.get(personalId);
  if (!cuadrillaId) return null;
  return snapshot.cuadrillas.find((c) => c.cuadrillaId === cuadrillaId) ?? null;
}

export function resolveWorkerRotacionContext(
  personal: Pick<Personal, 'id' | 'area_detalle' | 'area' | 'cargo'> &
    Partial<Pick<Personal, 'esquema_rotacion'>>,
  instancia: InstanciaActivaSnapshot | null | undefined,
  weekStart?: string,
): WorkerRotacionContext | null {
  if (!instancia || instancia.estado !== 'ACTIVA') return null;
  if (weekStart && !semanaAplicaInstanciaRotacion(weekStart, instancia)) return null;

  const cuadrilla = findCuadrillaForPersonal(instancia, personal.id);
  if (!cuadrilla || cuadrilla.estado !== 'ACTIVA') return null;
  if (!cuadrilla.semanas.length) return null;

  const asignacion = getGrupoNominaKey(personal);
  if (
    asignacion &&
    !asignacionMatchesCuadrilla(asignacion, {
      nombre: cuadrilla.cuadrillaNombre,
      asignacionKey: cuadrilla.asignacionKey,
    })
  ) {
    return null;
  }

  const fila = cuadrilla.filas.find((f) => f.personalId === personal.id);
  const posicion = posicionEfectivaCuadrilla(cuadrilla.semanas.length, cuadrilla.posicionActiva);
  const estatusBase = resolveEstatusCuadrilla(cuadrilla, cuadrilla.posicionActiva, fila);
  if (!estatusBase) return null;

  const semana = cuadrilla.semanas[posicion];
  // Fijo semanal (Perfil A) nunca hereda «libre» del default de la columna.
  const tieneOverrideExplicito = Boolean(semana && fila?.celdas[semana.id] != null);
  const estatus = coerceEstatusPlantillaParaEsquema(
    estatusBase,
    personal.esquema_rotacion,
    tieneOverrideExplicito,
  );
  const { estadoAsistencia, diasInputBloqueado } = resolveAsistenciaDesdePlantilla(estatus);

  return {
    fuente: 'plantilla',
    cuadrillaId: cuadrilla.cuadrillaId,
    cuadrillaNombre: cuadrilla.cuadrillaNombre,
    posicionCiclo: posicion,
    semanaNombre: semana?.nombre ?? `Semana ${posicion + 1}`,
    estatus,
    estatusLabel: estatusRotacionShort(estatus),
    estadoAsistencia,
    diasInputBloqueado,
  };
}

/** Posición inicial al crear instancia (aplica desfase_inicial) */
export function posicionInicialCuadrilla(desfaseInicial: number, totalSemanas: number): number {
  if (totalSemanas <= 0) return 0;
  return desfaseInicial % totalSemanas;
}

/** Tras cierre auditado, avanza posición; retorna si completó vuelta */
export function avanzarPosicionCuadrilla(
  posicionActual: number,
  totalSemanas: number,
): { nextPosicion: number; cicloCompletado: boolean } {
  if (totalSemanas <= 0) return { nextPosicion: 0, cicloCompletado: false };
  const next = (posicionActual + 1) % totalSemanas;
  return { nextPosicion: next, cicloCompletado: next === 0 };
}

export function retrocederPosicionCuadrilla(posicionActual: number, totalSemanas: number): number {
  if (totalSemanas <= 0) return 0;
  return posicionActual <= 0 ? 0 : posicionActual - 1;
}
