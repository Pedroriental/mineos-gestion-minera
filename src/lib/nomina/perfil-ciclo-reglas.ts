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

export function posicionEnCicloDesdeSemana(
  rotacionInicio: string,
  weekStart: string,
  totalSemanas: number,
): number {
  if (totalSemanas <= 1) return 0;
  const startDate = new Date(`${rotacionInicio}T00:00:00`);
  const weekDate = new Date(`${weekStart}T00:00:00`);
  const diffMs = weekDate.getTime() - startDate.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  return ((diffWeeks % totalSemanas) + totalSemanas) % totalSemanas;
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
  if (esquema === 'MOLINO_14X14') {
    if (posicion === 0) return 'libre';
    if (posicion === 1) return 'no_laborada';
    return 'trabajada';
  }

  if (esquema === 'MOLINO_15X15') {
    if (posicion <= 1) return 'trabajada';
    if (posicion === 2) return 'libre';
    return 'no_laborada';
  }

  const semanasLibres = perfil?.semanas_libres_por_ciclo ?? 1;
  if (posicion < semanasLibres) return 'libre';
  return 'trabajada';
}

export function etiquetaColumnaCiclo(esquema: EsquemaRotacion | string, posicion: number): string {
  if (esquema === 'MOLINO_14X14') {
    if (posicion === 0) return 'Libre Pagada';
    if (posicion === 1) return 'Libre $0';
    if (posicion === 2) return 'Trab 1';
    return 'Trab 2';
  }
  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') {
    if (posicion === 0) return 'Sem Libre';
    if (posicion === 1) return 'Trab 1';
    return 'Trab 2';
  }
  if (esquema === 'MOLINO_15X15') {
    if (posicion === 0) return 'Trab 1';
    if (posicion === 1) return 'Trab 2';
    if (posicion === 2) return 'Libre Pag.';
    return 'Libre $0';
  }
  return `Sem ${posicion + 1}`;
}

export function etiquetaEstadoRotacion(
  esquema: EsquemaRotacion | string,
  posicion: number,
): string | null {
  if (esquema === 'MOLINO_14X14') {
    if (posicion === 0) return 'Libre Pagada';
    if (posicion === 1) return 'Libre No Pagada';
    if (posicion === 2) return 'Labor (1)';
    return 'Labor (2)';
  }
  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') {
    if (posicion === 0) return 'Libre (pred.)';
    return 'Labor (pred.)';
  }
  return null;
}

/** Bloquea la columna Días en nómina semanal (posiciones libres / no laboradas del ciclo). */
export function inputsDiasBloqueados(
  esquema: EsquemaRotacion | string,
  posicion: number | null,
): boolean {
  if (posicion === null) return false;
  if (esquema === 'MOLINO_14X14') return posicion <= 1;
  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') return posicion === 0;
  if (esquema === 'MOLINO_15X15') return posicion >= 2;
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

export function calcularSalarioPorPosicionCiclo(
  esquema: EsquemaRotacion | string,
  personal: Pick<Personal, 'salario_base' | 'salario_libre'>,
  posicion: number,
  estadoAsistencia: EstadoAsistenciaNomina,
  diasTrabajados: number,
): number {
  const base = Number(personal.salario_base) || 0;

  if (esquema === 'MOLINO_14X14') {
    if (posicion === 0) return base;
    if (posicion === 1) return 0;
    if (estadoAsistencia === 'no_laborado') return 0;
    return applyProportionalWeeklyPay(base, diasTrabajados);
  }

  if (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G') {
    if (posicion === 0) return base;
    if (estadoAsistencia === 'no_laborado') return 0;
    return applyProportionalWeeklyPay(base, diasTrabajados);
  }

  if (esquema === 'MOLINO_15X15') {
    if (posicion <= 1) {
      if (estadoAsistencia === 'no_laborado') return 0;
      return applyProportionalWeeklyPay(base, diasTrabajados);
    }
    if (posicion === 2) {
      return Number(personal.salario_libre) || base;
    }
    return 0;
  }

  if (estadoAsistencia === 'no_laborado') return 0;
  if (estadoAsistencia === 'libre') {
    return Number(personal.salario_libre) || base;
  }
  return applyProportionalWeeklyPay(base, diasTrabajados);
}

export function calcularBonoTransportePorPosicion(
  esquema: EsquemaRotacion | string,
  personal: Pick<Personal, 'bono_transporte'>,
  posicion: number,
  estadoAsistencia: EstadoAsistenciaNomina,
  diasTrabajados: number,
  override?: number,
): number {
  if (override !== undefined) return override;

  if (esquema === 'MOLINO_14X14') {
    if (posicion <= 1 || estadoAsistencia !== 'trabajada') return 0;
    const bono = Number(personal.bono_transporte) || 0;
    return applyProportionalWeeklyPay(bono, diasTrabajados);
  }

  if (esquema === 'MOLINO_15X15') {
    if (posicion !== 1 || estadoAsistencia !== 'trabajada') return 0;
    const bono = Number(personal.bono_transporte) || 0;
    return applyProportionalWeeklyPay(bono, diasTrabajados);
  }

  if (posicion === 0 && (esquema === 'MINA_2X1' || esquema === 'MINA_ROTATIVA_3G')) {
    return 0;
  }

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
