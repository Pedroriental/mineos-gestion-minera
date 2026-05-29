import { calculateExpectedAttendance } from '@/lib/rotacion-personal';
import type { Personal } from '@/lib/types';

export type EstadoAsistenciaNomina = 'trabajada' | 'libre' | 'no_laborado';

export const NOMINA_DIAS_POR_SEMANA = 7;

export function clampDiasTrabajados(
  dias: number,
  diasSemana: number = NOMINA_DIAS_POR_SEMANA,
): number {
  if (!Number.isFinite(dias)) return 0;
  return Math.max(0, Math.min(diasSemana, Math.round(dias)));
}

export function defaultDiasTrabajados(estado: EstadoAsistenciaNomina): number {
  if (estado === 'no_laborado') return 0;
  return NOMINA_DIAS_POR_SEMANA;
}

/** Sueldo semanal proporcional: (salario_semanal / días_semana) × días_trabajados */
export function applyProportionalWeeklyPay(
  salarioSemanal: number,
  diasTrabajados: number,
  diasSemana: number = NOMINA_DIAS_POR_SEMANA,
): number {
  const semanal = Number(salarioSemanal) || 0;
  const dias = clampDiasTrabajados(diasTrabajados, diasSemana);
  if (semanal <= 0 || dias <= 0) return 0;
  if (dias >= diasSemana) return parseFloat(semanal.toFixed(2));
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

function molino15Position(
  rotacionInicio: string,
  weekStartStr: string,
): number {
  const startDate = new Date(rotacionInicio);
  const weekStart = new Date(weekStartStr);
  const diffMs = weekStart.getTime() - startDate.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  return ((diffWeeks % 4) + 4) % 4;
}

/** Sueldo semanal completo (sin prorratear por días) según estado y esquema */
export function calculateWeeklyBaseRate(
  p: Pick<Personal, 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'salario_base' | 'salario_libre'>,
  estadoAsistencia: EstadoAsistenciaNomina,
  weekStartStr: string,
): number {
  if (p.esquema_rotacion === 'MOLINO_15X15') {
    if (!p.rotacion_inicio_fecha) {
      return estadoAsistencia === 'no_laborado' ? 0 : Number(p.salario_base);
    }
    const position = molino15Position(p.rotacion_inicio_fecha, weekStartStr);

    if (estadoAsistencia === 'trabajada') return Number(p.salario_base);
    if (estadoAsistencia === 'libre') {
      const libreSal = Number(p.salario_libre) || Number(p.salario_base);
      return position === 2 ? libreSal : 0;
    }
    return 0;
  }

  if (estadoAsistencia === 'no_laborado') return 0;
  if (estadoAsistencia === 'libre') {
    return Number(p.salario_libre) || Number(p.salario_base);
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
  const tarifaSemanal = calculateWeeklyBaseRate(p, estadoAsistencia, weekStartStr);
  return applyProportionalWeeklyPay(tarifaSemanal, dias);
}

export function calculateBonoTransporteMolino15(
  p: Pick<Personal, 'esquema_rotacion' | 'rotacion_inicio_fecha' | 'bono_transporte'>,
  estadoAsistencia: EstadoAsistenciaNomina,
  weekStartStr: string,
  diasTrabajados?: number,
): number {
  if (p.esquema_rotacion !== 'MOLINO_15X15' || !p.rotacion_inicio_fecha) return 0;
  const position = molino15Position(p.rotacion_inicio_fecha, weekStartStr);
  if (position !== 1 || estadoAsistencia !== 'trabajada') return 0;
  const bono = Number(p.bono_transporte) || 0;
  const dias = clampDiasTrabajados(diasTrabajados ?? defaultDiasTrabajados(estadoAsistencia));
  return applyProportionalWeeklyPay(bono, dias);
}

export function resolveEstadoYDias(
  estado: EstadoAsistenciaNomina,
  dias: number,
): { estadoAsistencia: EstadoAsistenciaNomina; diasTrabajados: number } {
  const diasTrabajados = clampDiasTrabajados(dias);
  if (diasTrabajados === 0) {
    return { estadoAsistencia: 'no_laborado', diasTrabajados: 0 };
  }
  if (estado === 'no_laborado') {
    return { estadoAsistencia: 'trabajada', diasTrabajados };
  }
  return { estadoAsistencia: estado, diasTrabajados };
}

export function calculateNominaRowPay(input: {
  personal: Pick<
    Personal,
    'esquema_rotacion' | 'rotacion_inicio_fecha' | 'salario_base' | 'salario_libre' | 'bono_transporte'
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

  const bonoTransporte =
    input.bonoTransporte !== undefined
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
  });
  return {
    amount: pay.total,
    estado,
    diasTrabajados,
    source: 'calculada',
  };
}
