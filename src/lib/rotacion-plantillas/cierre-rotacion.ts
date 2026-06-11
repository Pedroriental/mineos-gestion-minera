import type { RotacionInstanciaSemana } from '@/lib/rotacion-plantillas/types';
import {
  buildBalanceExport,
  puedeAvanzarASiguienteSemana,
  validarCierreSemanal,
} from '@/lib/rotacion-plantillas/semana-cierre';
import {
  avanzarPosicionCuadrilla,
  posicionEfectivaCuadrilla,
  semanaAplicaInstanciaRotacion,
  type InstanciaActivaSnapshot,
  type InstanciaCuadrillaSnapshot,
} from '@/lib/rotacion-plantillas/projection';

export type CierreRotacionRow = {
  personalId: string;
  total: number;
  bonoTransporte: number;
  diasTrabajados: number;
};

export type ValidacionCierreRotacion =
  | { ok: true }
  | { ok: false; message: string; cuadrillaNombre?: string };

function historialCuadrilla(
  instanciaId: string,
  cuadrillaId: string,
  historial: Array<{
    instancia_id: string;
    cuadrilla_id: string;
    orden: number;
    estado: string;
    semana_inicio: string;
    semana_fin: string;
  }>,
): Pick<RotacionInstanciaSemana, 'orden' | 'estado'>[] {
  return historial
    .filter((h) => h.instancia_id === instanciaId && h.cuadrilla_id === cuadrillaId)
    .map((h) => ({ orden: h.orden, estado: h.estado as RotacionInstanciaSemana['estado'] }));
}

export function validarCierreRotacionParaSemana(input: {
  instancia: InstanciaActivaSnapshot;
  cuadrilla: InstanciaCuadrillaSnapshot;
  semanaInicio: string;
  semanaFin: string;
  hoy: string;
  historialInstancia: Array<{
    instancia_id: string;
    cuadrilla_id: string;
    orden: number;
    estado: string;
    semana_inicio: string;
    semana_fin: string;
  }>;
}): ValidacionCierreRotacion {
  const { instancia, cuadrilla, semanaInicio, semanaFin, hoy, historialInstancia } = input;

  if (cuadrilla.estado !== 'ACTIVA') {
    return { ok: false, message: `La cuadrilla "${cuadrilla.cuadrillaNombre}" no está activa.`, cuadrillaNombre: cuadrilla.cuadrillaNombre };
  }

  const posicion = posicionEfectivaCuadrilla(cuadrilla.semanas.length, cuadrilla.posicionActiva);
  const hist = historialCuadrilla(instancia.id, cuadrilla.cuadrillaId, historialInstancia);

  const avance = puedeAvanzarASiguienteSemana(hist, posicion);
  if (!avance.ok) {
    return { ok: false, message: `${cuadrilla.cuadrillaNombre}: ${avance.message}`, cuadrillaNombre: cuadrilla.cuadrillaNombre };
  }

  const cierre = validarCierreSemanal(
    {
      orden: posicion,
      estado: 'ABIERTA',
      semanaInicio,
      semanaFin,
    },
    hist,
    hoy,
  );
  if (!cierre.ok) {
    return { ok: false, message: `${cuadrilla.cuadrillaNombre}: ${cierre.message}`, cuadrillaNombre: cuadrilla.cuadrillaNombre };
  }

  return { ok: true };
}

export function validarCierreRotacionInstancia(input: {
  instancia: InstanciaActivaSnapshot;
  rows: CierreRotacionRow[];
  semanaInicio: string;
  semanaFin: string;
  hoy: string;
  historialInstancia: Array<{
    instancia_id: string;
    cuadrilla_id: string;
    orden: number;
    estado: string;
    semana_inicio: string;
    semana_fin: string;
  }>;
}): ValidacionCierreRotacion {
  const { instancia, rows, semanaInicio, semanaFin, hoy, historialInstancia } = input;

  if (!semanaAplicaInstanciaRotacion(semanaInicio, instancia)) {
    return { ok: true };
  }

  const personalIds = new Set(rows.map((r) => r.personalId));

  const cuadrillasConTrabajadores = instancia.cuadrillas.filter((c) =>
    c.filas.some((f) => personalIds.has(f.personalId)),
  );

  for (const cuadrilla of cuadrillasConTrabajadores) {
    const v = validarCierreRotacionParaSemana({
      instancia,
      cuadrilla,
      semanaInicio,
      semanaFin,
      hoy,
      historialInstancia,
    });
    if (!v.ok) return v;
  }

  return { ok: true };
}

export function calcularSubtotalesCuadrilla(
  cuadrilla: InstanciaCuadrillaSnapshot,
  rows: CierreRotacionRow[],
): { subtotalUsd: number; subtotalDias: number; subtotalBonos: number; trabajadoresCount: number } {
  const ids = new Set(cuadrilla.filas.map((f) => f.personalId));
  const filtered = rows.filter((r) => ids.has(r.personalId));
  return {
    subtotalUsd: filtered.reduce((s, r) => s + r.total, 0),
    subtotalDias: filtered.reduce((s, r) => s + r.diasTrabajados, 0),
    subtotalBonos: filtered.reduce((s, r) => s + r.bonoTransporte, 0),
    trabajadoresCount: filtered.length,
  };
}

export function buildBalanceExportCuadrilla(input: {
  plantillaId: string;
  plantillaNombre: string;
  area: string;
  cuadrillaNombre: string;
  semanasCerradas: RotacionInstanciaSemana[];
}) {
  return buildBalanceExport({
    plantillaId: input.plantillaId,
    plantillaNombre: `${input.plantillaNombre} — ${input.cuadrillaNombre}`,
    area: input.area,
    semanasCerradas: input.semanasCerradas,
  });
}

export { avanzarPosicionCuadrilla, retrocederPosicionCuadrilla } from '@/lib/rotacion-plantillas/projection';
