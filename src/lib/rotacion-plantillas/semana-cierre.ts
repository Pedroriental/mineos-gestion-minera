import type {
  EstatusRotacionPlantilla,
  RotacionBalanceExport,
  RotacionInstanciaSemana,
  SemanaEjecucionEstado,
} from '@/lib/rotacion-plantillas/types';
import type { EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import { NOMINA_DIAS_POR_SEMANA } from '@/lib/nomina-calculo';

/** Mapeo estatus plantilla → asistencia nómina semanal */
export function estatusPlantillaToAsistencia(estatus: EstatusRotacionPlantilla): EstadoAsistenciaNomina {
  switch (estatus) {
    case 'trabajada_paga':
      return 'trabajada';
    case 'libre_paga':
    case 'libre_sin_pago':
      return 'libre';
    case 'no_laborada':
      return 'no_laborado';
    case 'reposo':
      return 'no_laborado';
    case 'vacaciones':
      return 'libre';
    default:
      return 'trabajada';
  }
}

/** Días bloqueados en UI semanal según estatus de plantilla */
export function diasInputBloqueadosPorPlantilla(estatus: EstatusRotacionPlantilla): boolean {
  return estatus !== 'trabajada_paga' && estatus !== 'reposo';
}

/** La plantilla sugiere asistencia; nunca bloquea la UI semanal. */
export function plantillaPermiteAjusteAsistencia(_estatus: EstatusRotacionPlantilla): boolean {
  return true;
}

/** Días editables solo cuando la asistencia explícita es «trabajada». */
export function resolveDiasInputBloqueadoPlantilla(
  _estatus: EstatusRotacionPlantilla,
  estadoAsistencia: EstadoAsistenciaNomina,
): boolean {
  return estadoAsistencia !== 'trabajada';
}

/** Estimación de pago semanal simplificada para preview (no reemplaza motor nómina) */
export function previewPagoSemanal(
  estatus: EstatusRotacionPlantilla,
  salarioBase: number,
  salarioLibre: number,
  bonoTransporte: number,
  diasTrabajados = NOMINA_DIAS_POR_SEMANA,
): { sueldo: number; bono: number; dias: number } {
  switch (estatus) {
    case 'trabajada_paga':
      return {
        sueldo: (salarioBase / NOMINA_DIAS_POR_SEMANA) * diasTrabajados,
        bono: (bonoTransporte / NOMINA_DIAS_POR_SEMANA) * diasTrabajados,
        dias: diasTrabajados,
      };
    case 'libre_paga':
      return { sueldo: salarioLibre || salarioBase, bono: 0, dias: 0 };
    case 'libre_sin_pago':
    case 'no_laborada':
      return { sueldo: 0, bono: 0, dias: 0 };
    case 'reposo':
      return { sueldo: (salarioBase / NOMINA_DIAS_POR_SEMANA) * Math.min(3, diasTrabajados), bono: 0, dias: diasTrabajados };
    case 'vacaciones':
      return { sueldo: salarioLibre || salarioBase, bono: 0, dias: 0 };
    default:
      return { sueldo: 0, bono: 0, dias: 0 };
  }
}

// ── Auditoría y cierre semanal ─────────────────────────────────────────────

export function puedeAvanzarASiguienteSemana(
  semanas: Pick<RotacionInstanciaSemana, 'orden' | 'estado'>[],
  ordenDestino: number,
): { ok: true } | { ok: false; message: string } {
  if (ordenDestino <= 0) return { ok: true };
  const anterior = semanas.find((s) => s.orden === ordenDestino - 1);
  if (!anterior) {
    return { ok: false, message: 'Semana anterior no encontrada en la instancia.' };
  }
  if (anterior.estado !== 'CERRADA_AUDITADA') {
    return {
      ok: false,
      message: `La semana "${ordenDestino}" está bloqueada hasta cerrar y auditar la semana ${ordenDestino}.`,
    };
  }
  return { ok: true };
}

export function puedeAsignarTrabajadoresASemana(
  semanas: Pick<RotacionInstanciaSemana, 'orden' | 'estado'>[],
  ordenSemana: number,
): { ok: true } | { ok: false; message: string } {
  const actual = semanas.find((s) => s.orden === ordenSemana);
  if (actual?.estado === 'CERRADA_AUDITADA') {
    return { ok: false, message: 'Esta semana ya está cerrada y auditada; no se pueden modificar asignaciones.' };
  }
  return puedeAvanzarASiguienteSemana(semanas, ordenSemana);
}

export function validarCierreSemanal(
  semana: Pick<RotacionInstanciaSemana, 'orden' | 'estado' | 'semanaInicio' | 'semanaFin'>,
  todasLasSemanas: Pick<RotacionInstanciaSemana, 'orden' | 'estado'>[],
  hoy: string,
): { ok: true } | { ok: false; message: string } {
  if (semana.estado === 'CERRADA_AUDITADA') {
    return { ok: false, message: 'La semana ya fue cerrada y auditada.' };
  }
  if (hoy < semana.semanaFin) {
    return {
      ok: false,
      message: `No puede cerrar antes del fin de semana (${semana.semanaFin}).`,
    };
  }
  if (semana.orden > 0) {
    const anterior = todasLasSemanas.find((s) => s.orden === semana.orden - 1);
    if (!anterior || anterior.estado !== 'CERRADA_AUDITADA') {
      return {
        ok: false,
        message: `Debe cerrar y auditar la semana ${semana.orden} antes de cerrar la semana ${semana.orden + 1}.`,
      };
    }
  }
  return { ok: true };
}

export function siguienteEstadoTrasCierre(estadoActual: SemanaEjecucionEstado): SemanaEjecucionEstado {
  if (estadoActual === 'ABIERTA') return 'CERRADA_AUDITADA';
  return estadoActual;
}

/** Congela traspaso: trabajadores permanecen en semana N hasta cierre */
export function trabajadoresCongeladosEnSemana(
  semanas: Pick<RotacionInstanciaSemana, 'orden' | 'estado'>[],
): number {
  const abierta = semanas.find((s) => s.estado === 'ABIERTA' || s.estado === 'BLOQUEADA');
  return abierta?.orden ?? semanas.length - 1;
}

export function buildBalanceExport(input: {
  plantillaId: string;
  plantillaNombre: string;
  area: string;
  semanasCerradas: RotacionInstanciaSemana[];
}): RotacionBalanceExport {
  const semanasCerradas = input.semanasCerradas.filter((s) => s.estado === 'CERRADA_AUDITADA');
  return {
    plantillaId: input.plantillaId,
    plantillaNombre: input.plantillaNombre,
    area: input.area,
    semanasCerradas,
    totalUsd: semanasCerradas.reduce((a, s) => a + s.subtotalUsd, 0),
    totalDias: semanasCerradas.reduce((a, s) => a + s.subtotalDias, 0),
    totalBonos: semanasCerradas.reduce((a, s) => a + s.subtotalBonos, 0),
    exportadoAt: new Date().toISOString(),
  };
}
