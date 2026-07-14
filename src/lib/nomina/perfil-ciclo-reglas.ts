import {
  applyProportionalWeeklyPay,
  defaultDiasTrabajados,
  type EstadoAsistenciaNomina,
} from '@/lib/nomina-calculo';
import type { EsquemaRotacion, PerfilCompensacion, Personal, RolSemana } from '@/lib/types';

/** Total de semanas en un ciclo cerrado (trabajadas + libres). */
export function totalSemanasPerfil(
  perfil: Pick<PerfilCompensacion, 'semanas_trabajadas_por_ciclo' | 'semanas_libres_por_ciclo'>,
): number {
  return perfil.semanas_trabajadas_por_ciclo + perfil.semanas_libres_por_ciclo;
}

/** Longitud de ciclo cuando solo se conoce el esquema (fallback sin perfil cargado). */
export function totalSemanasEsquema(esquema: EsquemaRotacion | string): number {
  switch (esquema) {
    case 'MINA_2X1':
    case 'MINA_ROTATIVA_3G':
      return 3;
    case 'MOLINO_ROTATIVO':
      return 2;
    case 'MOLINO_15X15':
    case 'MOLINO_14X14':
      return 4;
    default:
      return 1;
  }
}

/** Semanas calendario transcurridas entre dos fechas (puede ser negativo). */
export function semanasTranscurridas(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export function posicionEnCicloDesdeSemana(
  rotacionInicio: string,
  weekStart: string,
  totalSemanas: number,
): number {
  if (totalSemanas <= 1) return 0;
  const diffWeeks = semanasTranscurridas(rotacionInicio, weekStart);
  return ((diffWeeks % totalSemanas) + totalSemanas) % totalSemanas;
}

/** Fecha de inicio del ciclo que deja a `weekStart` en la posición indicada. */
export function fechaInicioCicloParaPosicion(weekStart: string, posicion: number): string {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() - posicion * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type EstadoObservadoRotacion = {
  posicion: number;
  label: string;
  estadoAsistencia: EstadoAsistenciaNomina;
};

export function estadoObservadoOpcionesPorEsquema(
  esquema: EsquemaRotacion | string,
): EstadoObservadoRotacion[] {
  const total = totalSemanasEsquema(esquema);
  if (total <= 1) return [];
  return Array.from({ length: total }, (_, posicion) => ({
    posicion,
    label: etiquetaEstadoRotacion(esquema, posicion) ?? etiquetaColumnaCiclo(esquema, posicion),
    estadoAsistencia: asistenciaEsperadaPorPosicion(esquema, posicion),
  }));
}

export function fechaInicioRotacionDesdeEstadoObservado(
  weekStart: string,
  esquema: EsquemaRotacion | string,
  posicionObservada: number,
): string | null {
  const total = totalSemanasEsquema(esquema);
  if (total <= 1) return null;
  const posicion = ((posicionObservada % total) + total) % total;
  return fechaInicioCicloParaPosicion(weekStart, posicion);
}

/**
 * Posición de ciclo de un grupo/vertical para una semana, derivada del
 * CALENDARIO de rotación de sus trabajadores (moda de las posiciones
 * individuales). Devuelve null si ningún trabajador tiene fecha de rotación.
 */
export function posicionGrupoDesdeTrabajadores(
  rotaciones: Array<string | null | undefined>,
  weekStart: string,
  totalSemanas: number,
): number | null {
  const conteo = new Map<number, number>();
  for (const rotacion of rotaciones) {
    if (!rotacion) continue;
    const pos = posicionEnCicloDesdeSemana(rotacion, weekStart, totalSemanas);
    conteo.set(pos, (conteo.get(pos) ?? 0) + 1);
  }
  let mejor: number | null = null;
  let mejorConteo = 0;
  for (const [pos, c] of conteo) {
    if (c > mejorConteo) {
      mejor = pos;
      mejorConteo = c;
    }
  }
  return mejor;
}

export type PlanVinculoCiclo =
  | { accion: 'usar_ciclo'; posicion: number }
  | { accion: 'cerrar_y_crear'; posicion: number; fechaInicio: string }
  | { accion: 'crear'; posicion: number; fechaInicio: string };

/**
 * Decide cómo vincular una semana cerrada a un ciclo (D1 — fuente única:
 * CALENDARIO, nunca el orden de cierres). Invariante que garantiza:
 * dentro de un ciclo, `posicion_en_ciclo === semanasTranscurridas(ciclo.fecha_inicio, semana)`,
 * que es la misma posición con la que el motor calcula el pago.
 */
export function planificarVinculoCiclo(input: {
  semanaInicio: string;
  totalSemanas: number;
  /** Posición según la rotación de los trabajadores (null si no hay datos). */
  posicionCalendario: number | null;
  cicloAbierto: { fechaInicio: string; posicionesOcupadas: number[] } | null;
}): PlanVinculoCiclo {
  const { semanaInicio, totalSemanas, posicionCalendario, cicloAbierto } = input;

  // Sin datos de rotación: usar la ventana del ciclo abierto como fallback.
  if (posicionCalendario === null) {
    if (cicloAbierto) {
      const offset = semanasTranscurridas(cicloAbierto.fechaInicio, semanaInicio);
      if (offset >= 0 && offset < totalSemanas && !cicloAbierto.posicionesOcupadas.includes(offset)) {
        return { accion: 'usar_ciclo', posicion: offset };
      }
      const pos = ((offset % totalSemanas) + totalSemanas) % totalSemanas;
      return {
        accion: 'cerrar_y_crear',
        posicion: pos,
        fechaInicio: fechaInicioCicloParaPosicion(semanaInicio, pos),
      };
    }
    return { accion: 'crear', posicion: 0, fechaInicio: semanaInicio };
  }

  const posicion = posicionCalendario;
  const fechaInicio = fechaInicioCicloParaPosicion(semanaInicio, posicion);

  if (!cicloAbierto) {
    return { accion: 'crear', posicion, fechaInicio };
  }

  const offset = semanasTranscurridas(cicloAbierto.fechaInicio, semanaInicio);
  const dentroDeVentana = offset >= 0 && offset < totalSemanas;
  const alineada = dentroDeVentana && offset === posicion;
  const ocupada = cicloAbierto.posicionesOcupadas.includes(posicion);

  if (alineada && !ocupada) {
    return { accion: 'usar_ciclo', posicion };
  }
  // Ciclo completo, desalineado o posición duplicada → abrir ciclo alineado.
  return { accion: 'cerrar_y_crear', posicion, fechaInicio };
}

export function posicionEsquemaPersonal(
  personal: Pick<Personal, 'esquema_rotacion' | 'rotacion_inicio_fecha'>,
  weekStart: string,
): number | null {
  const total = totalSemanasEsquema(personal.esquema_rotacion);
  if (!personal.rotacion_inicio_fecha || total <= 1) return null;
  return posicionEnCicloDesdeSemana(personal.rotacion_inicio_fecha, weekStart, total);
}

export function rolSemanaPorPosicion(
  esquema: EsquemaRotacion | string,
  posicion: number,
  perfil?: Pick<PerfilCompensacion, 'semanas_libres_por_ciclo'>,
): RolSemana {
  // MOLINO_14X14 es alias histórico de MOLINO_15X15: misma logica de ciclo.
  if (esquema === 'MOLINO_14X14' || esquema === 'MOLINO_15X15') {
    if (posicion <= 1) return 'trabajada';
    if (posicion === 2) return 'libre';
    return 'no_laborada';
  }

  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') {
    return posicion === 2 ? 'libre' : 'trabajada';
  }

  const semanasLibres = perfil?.semanas_libres_por_ciclo ?? 1;
  if (posicion < semanasLibres) return 'libre';
  return 'trabajada';
}

export function etiquetaColumnaCiclo(esquema: EsquemaRotacion | string, posicion: number): string {
  if (esquema === 'MOLINO_14X14' || esquema === 'MOLINO_15X15') {
    if (posicion === 0) return 'Trab 1';
    if (posicion === 1) return 'Trab 2';
    if (posicion === 2) return 'Libre Pag.';
    return 'Libre $0';
  }
  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') {
    if (posicion === 0) return 'Trab Día';
    if (posicion === 1) return 'Trab Noche';
    return 'Libre Pag.';
  }
  return `Sem ${posicion + 1}`;
}

export function etiquetaEstadoRotacion(
  esquema: EsquemaRotacion | string,
  posicion: number,
): string | null {
  if (esquema === 'MOLINO_14X14' || esquema === 'MOLINO_15X15') {
    if (posicion === 0) return 'Labor (1)';
    if (posicion === 1) return 'Labor (2)';
    if (posicion === 2) return 'Libre Pagada';
    return 'Libre $0';
  }
  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') {
    if (posicion === 0) return 'Labor Día';
    if (posicion === 1) return 'Labor Noche';
    return 'Libre Pagada';
  }
  return null;
}

/** Bloquea la columna Días en nómina semanal (posiciones libres / no laboradas del ciclo). */
export function inputsDiasBloqueados(
  esquema: EsquemaRotacion | string,
  posicion: number | null,
): boolean {
  if (posicion === null) return false;
  if (esquema === 'MOLINO_14X14' || esquema === 'MOLINO_15X15') return posicion >= 2;
  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') return posicion === 2;
  return posicion === 0;
}

export function asistenciaEsperadaPorPosicion(
  esquema: EsquemaRotacion | string,
  posicion: number,
): EstadoAsistenciaNomina {
  const rol = rolSemanaPorPosicion(esquema, posicion);
  if (rol === 'libre') return 'libre';
  if (rol === 'no_laborada') return 'no_laborado';
  return 'trabajada';
}

/**
 * Tarifa Plana de semana libre — ÚNICA fuente de verdad (D2):
 * si el trabajador tiene tarifa libre propia (`salario_libre`) se usa esa;
 * si no, aplica el salario base completo. Misma regla que la política
 * TARIFA_PLANA de los perfiles de compensación.
 */
export function tarifaPlanaSemanaLibre(
  personal: Pick<Personal, 'salario_base' | 'salario_libre'>,
): number {
  return Number(personal.salario_libre) || Number(personal.salario_base) || 0;
}

export function calcularSalarioPorPosicionCiclo(
  esquema: EsquemaRotacion | string,
  personal: Pick<Personal, 'salario_base' | 'salario_libre'>,
  posicion: number,
  estadoAsistencia: EstadoAsistenciaNomina,
  diasTrabajados: number,
): number {
  const base = Number(personal.salario_base) || 0;

  // MOLINO_14X14 es alias histórico de MOLINO_15X15: misma logica de calculo.
  if (esquema === 'MOLINO_14X14' || esquema === 'MOLINO_15X15') {
    if (posicion <= 1) {
      if (estadoAsistencia === 'no_laborado') return 0;
      return applyProportionalWeeklyPay(base, diasTrabajados);
    }
    if (posicion === 2) {
      return tarifaPlanaSemanaLibre(personal);
    }
    return 0;
  }

  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') {
    if (posicion === 2) return tarifaPlanaSemanaLibre(personal);
    if (estadoAsistencia === 'no_laborado') return 0;
    return applyProportionalWeeklyPay(base, diasTrabajados);
  }

  if (estadoAsistencia === 'no_laborado') return 0;
  if (estadoAsistencia === 'libre') {
    return tarifaPlanaSemanaLibre(personal);
  }
  return applyProportionalWeeklyPay(base, diasTrabajados);
}

/**
 * El bono de transporte es un componente SEPARADO del sueldo semanal.
 * Se paga cuando el trabajador se va libre a su casa, NO es una semana
 * ni un día extra. El cálculo automático siempre retorna 0; el bono se
 * paga solo cuando el usuario lo captura manualmente con un override
 * (campo 'bonoTransporte' en el input o ajuste con motivo en el cierre).
 *
 * Esto aplica a TODOS los esquemas (MINA_2X1, MOLINO_14X14, MOLINO_15X15, etc).
 */
export function calcularBonoTransportePorPosicion(
  esquema: EsquemaRotacion | string,
  personal: Pick<Personal, 'bono_transporte'>,
  posicion: number,
  estadoAsistencia: EstadoAsistenciaNomina,
  diasTrabajados: number,
  override?: number,
): number {
  if (override !== undefined) return override;
  return 0;
}

export function calcularPagoSemanalConCiclo(input: {
  personal: Pick<
    Personal,
    'esquema_rotacion' | 'rotacion_inicio_fecha' | 'salario_base' | 'salario_libre' | 'bono_transporte'
  >;
  weekStart: string;
  estadoAsistencia: EstadoAsistenciaNomina;
  diasTrabajados: number;
  bonoTransporte?: number;
}): {
  salarioBaseCalculado: number;
  bonoTransporte: number;
  esSemanaLibre: boolean;
  cicloPosicion: number | null;
  diasInputBloqueado: boolean;
} {
  const posicion = posicionEsquemaPersonal(input.personal, input.weekStart);
  const total = totalSemanasEsquema(input.personal.esquema_rotacion);

  if (posicion !== null && total > 1) {
    const salarioBaseCalculado = calcularSalarioPorPosicionCiclo(
      input.personal.esquema_rotacion,
      input.personal,
      posicion,
      input.estadoAsistencia,
      input.diasTrabajados,
    );
    const bonoTransporte = calcularBonoTransportePorPosicion(
      input.personal.esquema_rotacion,
      input.personal,
      posicion,
      input.estadoAsistencia,
      input.diasTrabajados,
      input.bonoTransporte,
    );
    return {
      salarioBaseCalculado,
      bonoTransporte,
      esSemanaLibre: input.estadoAsistencia === 'libre',
      cicloPosicion: posicion,
      diasInputBloqueado: inputsDiasBloqueados(input.personal.esquema_rotacion, posicion),
    };
  }

  return {
    salarioBaseCalculado: 0,
    bonoTransporte: 0,
    esSemanaLibre: input.estadoAsistencia === 'libre',
    cicloPosicion: null,
    diasInputBloqueado: false,
  };
}

export function asistenciaPredichaPorEsquema(
  esquema: EsquemaRotacion | string,
  rotacionInicio: string | null | undefined,
  weekStart: string,
): EstadoAsistenciaNomina {
  if (!rotacionInicio || esquema === 'FIJO_SEMANAL' || esquema === 'MOLINO_FIJO') {
    return 'trabajada';
  }
  const total = totalSemanasEsquema(esquema);
  if (total <= 1) return 'trabajada';
  const posicion = posicionEnCicloDesdeSemana(rotacionInicio, weekStart, total);
  return asistenciaEsperadaPorPosicion(esquema, posicion);
}

export function diasTrabajadosPorDefectoCiclo(
  esquema: EsquemaRotacion | string,
  posicion: number | null,
  estado: EstadoAsistenciaNomina,
): number {
  if (posicion !== null && inputsDiasBloqueados(esquema, posicion)) {
    return 0;
  }
  return defaultDiasTrabajados(estado);
}
