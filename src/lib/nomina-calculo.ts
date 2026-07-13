import {
  calcularBonoTransportePorPosicion,
  calcularSalarioPorPosicionCiclo,
  posicionEnCicloDesdeSemana,
  posicionEsquemaPersonal,
  tarifaPlanaSemanaLibre,
  totalSemanasEsquema,
} from '@/lib/nomina/perfil-ciclo-reglas';
import { calculateExpectedAttendance, getWeekStart } from '@/lib/rotacion-personal';
import type { Personal, PoliticaReposo } from '@/lib/types';
import type { EstatusRotacionPlantilla } from '@/lib/rotacion-plantillas/types';
import { esEstatusSemanaBonoTransporte } from '@/lib/rotacion-plantillas/bono-transporte-semana';

export type EstadoAsistenciaNomina = 'trabajada' | 'libre' | 'no_laborado';

export const NOMINA_DIAS_POR_SEMANA = 7;
/** Máximo de días que se pueden registrar como "trabajados" en una semana.
 *  Default: 14 (semana normal + semana extra). */
export const MAX_DIAS_TRABAJADOS = 14;

export function clampDiasTrabajados(
  dias: number,
  diasSemana: number = NOMINA_DIAS_POR_SEMANA,
): number {
  if (!Number.isFinite(dias)) return 0;
  return Math.max(0, Math.min(MAX_DIAS_TRABAJADOS, Math.round(dias)));
}

export function defaultDiasTrabajados(estado: EstadoAsistenciaNomina): number {
  if (estado === 'no_laborado' || estado === 'libre') return 0;
  return NOMINA_DIAS_POR_SEMANA;
}

/** Sueldo semanal proporcional: (salario_semanal / días_semana) × días_trabajados.
 *  Soporta días > días_semana (caso semana + extra): prorrea con la misma fórmula. */
export function applyProportionalWeeklyPay(
  salarioSemanal: number,
  diasTrabajados: number,
  diasSemana: number = NOMINA_DIAS_POR_SEMANA,
): number {
  const semanal = Number(salarioSemanal) || 0;
  const dias = clampDiasTrabajados(diasTrabajados, diasSemana);
  if (semanal <= 0 || dias <= 0) return 0;
  if (dias === diasSemana) return parseFloat(semanal.toFixed(2));
  return parseFloat(((semanal / diasSemana) * dias).toFixed(2));
}

export function formatProportionalSalarioHint(
  salarioSemanal: number,
  diasTrabajados: number,
  diasSemana: number = NOMINA_DIAS_POR_SEMANA,
): string | null {
  const dias = clampDiasTrabajados(diasTrabajados, diasSemana);
  if (dias <= 0 || dias >= diasSemana) return null;
  const semanal = Number(salarioSemanal) || 0;
  if (semanal <= 0) return null;
  const diario = parseFloat((semanal / diasSemana).toFixed(2));
  return `(${diario.toFixed(2)} × ${dias} días)`;
}

/** Sueldo semanal (antes de prorrateo por días) según estado, esquema y posición en ciclo. */
export function calculateWeeklyBaseRate(
  p: Pick<Personal, 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'salario_base' | 'salario_libre'>,
  estadoAsistencia: EstadoAsistenciaNomina,
  weekStartStr: string,
  diasTrabajados?: number,
): number {
  const posicion = posicionEsquemaPersonal(p, weekStartStr);
  const total = totalSemanasEsquema(p.esquema_rotacion);

  if (posicion !== null && total > 1) {
    const dias = clampDiasTrabajados(
      diasTrabajados ?? defaultDiasTrabajados(estadoAsistencia),
    );
    return calcularSalarioPorPosicionCiclo(
      p.esquema_rotacion,
      p,
      posicion,
      estadoAsistencia,
      dias,
    );
  }

  if (estadoAsistencia === 'no_laborado') return 0;
  if (estadoAsistencia === 'libre') {
    return tarifaPlanaSemanaLibre(p);
  }
  return Number(p.salario_base);
}

export function calculateDefaultBaseSal(
  p: Pick<Personal, 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'salario_base' | 'salario_libre'>,
  estadoAsistencia: EstadoAsistenciaNomina,
  weekStartStr: string,
  diasTrabajados?: number,
): number {
  const dias = clampDiasTrabajados(
    diasTrabajados ?? defaultDiasTrabajados(estadoAsistencia),
  );
  const posicion = posicionEsquemaPersonal(p, weekStartStr);
  const total = totalSemanasEsquema(p.esquema_rotacion);
  if (posicion !== null && total > 1) {
    return calculateWeeklyBaseRate(p, estadoAsistencia, weekStartStr, dias);
  }

  const tarifaSemanal = calculateWeeklyBaseRate(p, estadoAsistencia, weekStartStr, dias);
  if (estadoAsistencia === 'libre') {
    return tarifaSemanal;
  }
  if (estadoAsistencia === 'no_laborado') {
    return 0;
  }
  return applyProportionalWeeklyPay(tarifaSemanal, dias);
}

export function calculateBonoTransporteMolino15(
  p: Pick<Personal, 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'bono_transporte'>,
  estadoAsistencia: EstadoAsistenciaNomina,
  weekStartStr: string,
  diasTrabajados?: number,
): number {
  const posicion = posicionEsquemaPersonal(p, weekStartStr);
  const dias = clampDiasTrabajados(diasTrabajados ?? defaultDiasTrabajados(estadoAsistencia));
  if (posicion === null) {
    if (estadoAsistencia !== 'trabajada') return 0;
    return applyProportionalWeeklyPay(Number(p.bono_transporte) || 0, dias);
  }
  return calcularBonoTransportePorPosicion(
    p.esquema_rotacion,
    p,
    posicion,
    estadoAsistencia,
    dias,
  );
}

/** Normaliza estado + días: libre y falta siempre 0 días; turno laboral 1–7 días. */
export function resolveEstadoYDias(
  estado: EstadoAsistenciaNomina,
  dias: number,
): { estadoAsistencia: EstadoAsistenciaNomina; diasTrabajados: number } {
  if (estado === 'libre') {
    return { estadoAsistencia: 'libre', diasTrabajados: 0 };
  }
  if (estado === 'no_laborado') {
    return { estadoAsistencia: 'no_laborado', diasTrabajados: 0 };
  }
  const diasTrabajados = clampDiasTrabajados(dias);
  if (diasTrabajados === 0) {
    return { estadoAsistencia: 'no_laborado', diasTrabajados: 0 };
  }
  return { estadoAsistencia: 'trabajada', diasTrabajados };
}

/** Sueldo semanal por reposo según política del perfil (distinto al camino de falta/no laborado). */
export function aplicarPoliticaReposoSemanal(
  politica: PoliticaReposo | undefined,
  personal: Pick<Personal, 'salario_base'>,
  diasTrabajados: number,
): number {
  switch (politica ?? 'SIN_PAGO') {
    case 'PAGO_COMPLETO':
      return Number(personal.salario_base) || 0;
    case 'PARCIAL':
      return applyProportionalWeeklyPay(Number(personal.salario_base) || 0, diasTrabajados);
    case 'SIN_PAGO':
    default:
      return 0;
  }
}

export function calculateNominaRowPay(input: {
  personal: Pick<
    Personal,
    'esquema_rotacion' | 'rotacion_inicio_fecha' | 'salario_base' | 'salario_libre' | 'bono_transporte' | 'area' | 'area_detalle'
  >;
  estadoAsistencia: EstadoAsistenciaNomina;
  diasTrabajados: number;
  weekStart: string;
  bonoTransporte?: number;
  bonificaciones?: number;
  totalVales?: number;
}): {
  salarioBaseCalculado: number;
  bonoTransporte: number;
  esSemanaLibre: boolean;
  total: number;
} {
  const { estadoAsistencia, diasTrabajados } = resolveEstadoYDias(
    input.estadoAsistencia,
    input.diasTrabajados,
  );

  const salarioBaseCalculado = calculateDefaultBaseSal(
    input.personal,
    estadoAsistencia,
    input.weekStart,
    diasTrabajados,
  );

  const esAdmin = input.personal.area === 'administracion';

  const bonoTransporte =
    esAdmin
      ? 0
      : input.bonoTransporte !== undefined
        ? input.bonoTransporte
        : calculateBonoTransporteMolino15(
            input.personal,
            estadoAsistencia,
            input.weekStart,
            diasTrabajados,
          );

  const bonificaciones = Number(input.bonificaciones) || 0;
  const totalVales = Number(input.totalVales) || 0;
  const total = parseFloat(
    (salarioBaseCalculado + bonoTransporte + bonificaciones - totalVales).toFixed(2),
  );

  return {
    salarioBaseCalculado,
    bonoTransporte,
    esSemanaLibre: estadoAsistencia === 'libre',
    total: Math.max(0, total),
  };
}

/** Pago según Turno/Libre/Falta explícito (periodo manual con plantilla; ignora ciclo personal). */
export function calculateExplicitAsistenciaPay(input: {
  personal: Pick<Personal, 'salario_base' | 'salario_libre' | 'bono_transporte' | 'area' | 'area_detalle'>;
  estadoAsistencia: EstadoAsistenciaNomina;
  diasTrabajados: number;
  bonoTransporte?: number;
  bonificaciones?: number;
  totalVales?: number;
}): {
  salarioBaseCalculado: number;
  bonoTransporte: number;
  esSemanaLibre: boolean;
  total: number;
} {
  const { estadoAsistencia, diasTrabajados } = resolveEstadoYDias(
    input.estadoAsistencia,
    input.diasTrabajados,
  );
  const base = Number(input.personal.salario_base) || 0;
  const libre = Number(input.personal.salario_libre) || base;

  let salarioBaseCalculado = 0;
  let bonoTransporte = 0;

  const esAdmin = input.personal.area === 'administracion';

  if (estadoAsistencia === 'trabajada') {
    salarioBaseCalculado = applyProportionalWeeklyPay(base, diasTrabajados);
    bonoTransporte =
      esAdmin || input.bonoTransporte === undefined
        ? 0
        : input.bonoTransporte;
  } else if (estadoAsistencia === 'libre') {
    salarioBaseCalculado = libre;
  }

  const bonificaciones = Number(input.bonificaciones) || 0;
  const totalVales = Number(input.totalVales) || 0;
  const total = parseFloat(
    (salarioBaseCalculado + bonoTransporte + bonificaciones - totalVales).toFixed(2),
  );

  return {
    salarioBaseCalculado,
    bonoTransporte,
    esSemanaLibre: estadoAsistencia === 'libre',
    total: Math.max(0, total),
  };
}

export function explicitWeeklyBaseRate(
  p: Pick<Personal, 'salario_base' | 'salario_libre'>,
  estadoAsistencia: EstadoAsistenciaNomina,
): number {
  if (estadoAsistencia === 'no_laborado') return 0;
  if (estadoAsistencia === 'libre') {
    return Number(p.salario_libre) || Number(p.salario_base) || 0;
  }
  return Number(p.salario_base) || 0;
}

/** Pago según estatus de columna de plantilla (sueldo y bono en semanas distintas). */
export function calculatePayFromPlantillaEstatus(input: {
  estatus: EstatusRotacionPlantilla;
  personal: Pick<Personal, 'salario_base' | 'salario_libre' | 'bono_transporte' | 'area' | 'area_detalle'>;
  diasTrabajados: number;
  bonoTransporte?: number;
  bonificaciones?: number;
  totalVales?: number;
}): {
  salarioBaseCalculado: number;
  bonoTransporte: number;
  esSemanaLibre: boolean;
  total: number;
  estadoAsistencia: EstadoAsistenciaNomina;
} {
  const estadoAsistencia = esEstatusSemanaBonoTransporte(input.estatus)
    ? 'no_laborado'
    : (() => {
        switch (input.estatus) {
          case 'libre_paga':
          case 'vacaciones':
            return 'libre' as const;
          case 'libre_sin_pago':
          case 'no_laborada':
            return 'no_laborado' as const;
          case 'reposo':
            return 'no_laborado' as const;
          default:
            return 'trabajada' as const;
        }
      })();

  const { estadoAsistencia: resolvedEstado, diasTrabajados } = resolveEstadoYDias(
    estadoAsistencia,
    input.diasTrabajados,
  );

  const esAdmin = input.personal.area === 'administracion';

  let salarioBaseCalculado = 0;
  let bonoTransporte = 0;

  if (esEstatusSemanaBonoTransporte(input.estatus)) {
    if (!esAdmin) {
      const bonoBase = Number(input.personal.bono_transporte) || 0;
      bonoTransporte =
        input.bonoTransporte !== undefined
          ? input.bonoTransporte
          : applyProportionalWeeklyPay(bonoBase, NOMINA_DIAS_POR_SEMANA);
    }
  } else {
    // Para semanas que NO son 'bono_transporte_paga' (ej: 'trabajada_paga',
    // 'libre_paga', 'reposo'), el bono NO se paga automáticamente.
    // El bono de transporte es un componente SEPARADO que se paga solo
    // cuando el usuario lo captura manualmente con un override
    // (input.bonoTransporte !== undefined).
    const explicit = calculateExplicitAsistenciaPay({
      personal: input.personal,
      estadoAsistencia: resolvedEstado,
      diasTrabajados,
      bonoTransporte: input.bonoTransporte !== undefined
        ? input.bonoTransporte
        : 0,
      bonificaciones: input.bonificaciones,
      totalVales: input.totalVales,
    });
    salarioBaseCalculado = explicit.salarioBaseCalculado;
    bonoTransporte = explicit.bonoTransporte;
  }

  const bonificaciones = Number(input.bonificaciones) || 0;
  const totalVales = Number(input.totalVales) || 0;
  const total = parseFloat(
    (salarioBaseCalculado + bonoTransporte + bonificaciones - totalVales).toFixed(2),
  );

  return {
    salarioBaseCalculado,
    bonoTransporte,
    esSemanaLibre: resolvedEstado === 'libre',
    total: Math.max(0, total),
    estadoAsistencia: resolvedEstado,
  };
}

export function predictWeekPay(
  p: Personal,
  weekStart: string,
  valesDeduccion = 0,
): { amount: number; estado: EstadoAsistenciaNomina; diasTrabajados: number; source: 'calculada' } {
  const estado = calculateExpectedAttendance(
    p.esquema_rotacion,
    p.rotacion_inicio_fecha,
    weekStart,
  );
  const diasTrabajados = defaultDiasTrabajados(estado);
  const pay = calculateNominaRowPay({
    personal: p,
    estadoAsistencia: estado,
    diasTrabajados,
    weekStart,
    totalVales: valesDeduccion,
    // El bono de transporte es un componente SEPARADO que se paga
    // solo cuando el usuario lo captura manualmente. No se pasa
    // aquí para que el cálculo automático retorne 0.
  });
  return {
    amount: pay.total,
    estado,
    diasTrabajados,
    source: 'calculada',
  };
}

// ── LIQUIDACION DE DESPEDIDOS ──────────────────────────────────

export type LiquidacionDesglose = {
  semanaInicio: string;
  posicionCiclo: number;
  estado: EstadoAsistenciaNomina;
  dias: number;
  monto: number;
  descripcion: string;
};

export type LiquidacionResultado = {
  semanas: LiquidacionDesglose[];
  montoTotal: number;
  diasParciales: number;
  semanaLibreGanada: boolean;
};

/**
 * Calcula la liquidación de un trabajador despedido.
 * NO depende del esquema de rotación — es generalizada.
 * - Días trabajados: lunes de la semana del despido hasta el día ANTERIOR al despido
 *   (no se cuenta el día del despido, p.ej. lunes-jueves = 3 días).
 *   Si se pasa `diasTrabajadosOverride`, se usa ese valor en su lugar.
 * - Semana libre: solo si cobraSemanaLibre === true
 *   (el usuario decide manualmente si el trabajador llegó a cobrarla).
 *   El monto de la semana libre es `salario_libre || salario_base`
 *   (puede variar por trabajador según su $/Semana).
 * - Bono extra: se agrega aparte en el panel
 */
export function calcularLiquidacionPendiente(
  personal: Pick<Personal, 'salario_base' | 'salario_libre' | 'bono_transporte'>,
  despidoFechaISO: string,
  cobraSemanaLibre: boolean,
  diasTrabajadosOverride?: number | null,
): LiquidacionResultado {
  const salarioBase = Number(personal.salario_base) || 0;
  const salarioLibre = Number(personal.salario_libre) || salarioBase;
  const bonoTransporte = Number(personal.bono_transporte) || 0;

  const desglose: LiquidacionDesglose[] = [];
  let montoTotal = 0;

  const despidoFecha = new Date(`${despidoFechaISO}T00:00:00`);

  // Calcular el lunes de la semana del despido
  const despidoWeekStart = getWeekStart(despidoFecha);
  const despidoWeekStartDate = new Date(`${despidoWeekStart}T00:00:00`);

  // Días trabajados: override manual o auto-cálculo
  let diasTrabajados: number;
  if (diasTrabajadosOverride !== undefined && diasTrabajadosOverride !== null) {
    diasTrabajados = Math.max(0, Math.min(14, Math.round(diasTrabajadosOverride)));
  } else {
    // Auto: lunes hasta día ANTERIOR al despido (no contar día del despido)
    diasTrabajados = Math.max(
      0,
      Math.min(7, Math.ceil((despidoFecha.getTime() - despidoWeekStartDate.getTime()) / (24 * 60 * 60 * 1000)))
    );
  }

  if (diasTrabajados > 0) {
    // Pago proporcional sin cap a 7 días: un trabajador que trabajó 8 días cobra
    // (salarioSemanal / 7) * 8. clampDiasTrabajados acepta hasta
    // MAX_DIAS_TRABAJADOS (14) para soportar semana + extra.
    const porDia = salarioBase > 0 ? salarioBase / 7 : 0;
    const porDiaBono = bonoTransporte > 0 ? bonoTransporte / 7 : 0;
    const montoDias = parseFloat((porDia * diasTrabajados).toFixed(2));
    const montoBono = parseFloat((porDiaBono * diasTrabajados).toFixed(2));
    const total = parseFloat((montoDias + montoBono).toFixed(2));
    desglose.push({
      semanaInicio: despidoWeekStart,
      posicionCiclo: 0,
      estado: 'trabajada',
      dias: diasTrabajados,
      monto: total,
      descripcion: `${diasTrabajados} días trabajados`,
    });
    montoTotal += total;
  }

  if (cobraSemanaLibre) {
    desglose.push({
      semanaInicio: despidoWeekStart,
      posicionCiclo: -1,
      estado: 'libre',
      dias: 0,
      monto: parseFloat(salarioLibre.toFixed(2)),
      descripcion: `Semana libre ($${salarioLibre.toFixed(2)})`,
    });
    montoTotal += parseFloat(salarioLibre.toFixed(2));
  }

  return {
    semanas: desglose,
    montoTotal: parseFloat(montoTotal.toFixed(2)),
    diasParciales: diasTrabajados,
    semanaLibreGanada: cobraSemanaLibre,
  };
}

function rolEnCiclo(
  esquema: string,
  posicion: number,
  totalSemanas: number,
): 'trabajada' | 'libre' | 'no_laborada' {
  if (totalSemanas <= 1) return 'trabajada';
  switch (esquema) {
    case 'MINA_2X1':
    case 'MINA_ROTATIVA_3G':
      return posicion === 2 ? 'libre' : 'trabajada';
    case 'MOLINO_ROTATIVO':
      return posicion === 1 ? 'libre' : 'trabajada';
    case 'MOLINO_15X15':
    case 'MOLINO_14X14':
      if (posicion === 2) return 'libre';
      if (posicion === 3) return 'no_laborada';
      return 'trabajada';
    default:
      return 'trabajada';
  }
}
