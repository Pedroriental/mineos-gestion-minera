import { addDays, format, parseISO } from 'date-fns';
import {
  calculateExpectedAttendance,
} from '@/lib/rotacion-personal';
import {
  calculatePayFromPlantillaEstatus,
  calculateNominaRowPay,
  defaultDiasTrabajados,
  NOMINA_DIAS_POR_SEMANA,
  type EstadoAsistenciaNomina,
} from '@/lib/nomina-calculo';
import {
  diasTrabajadosPorDefectoCiclo,
  inputsDiasBloqueados,
  posicionEsquemaPersonal,
  totalSemanasEsquema,
} from '@/lib/nomina/perfil-ciclo-reglas';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import {
  resolveWorkerRotacionContext,
  type InstanciaActivaSnapshot,
} from '@/lib/rotacion-plantillas/projection';
import type { Personal } from '@/lib/types';

export type ProximosPagosFuente = 'plantilla' | 'rotacion' | 'config_incompleta';
export type ProximosPagosConfianza = 'alta' | 'media' | 'baja';

export type ProximosPagosWorkerProjection = {
  personalId: string;
  nombre: string;
  amount: number;
  estado: EstadoAsistenciaNomina;
  diasTrabajados: number;
  fuente: ProximosPagosFuente;
  valesAplicados: number;
};

export type ProximosPagosWeekForecast = {
  weekStart: string;
  totalUsd: number;
  enTurno: number;
  libresPagadas: number;
  sinPago: number;
  porPlantilla: number;
  porRotacion: number;
  configIncompleta: number;
  valesAplicados: number;
  confianza: ProximosPagosConfianza;
  notas: string[];
  workers: ProximosPagosWorkerProjection[];
};

export type ProximosPagosForecastInput = {
  personal: Personal[];
  area: string;
  fromWeekStart: string;
  weeksAhead?: number;
  instanciaActiva?: InstanciaActivaSnapshot | null;
  valesPorPersonal?: Record<string, number>;
};

function addWeeksIso(weekStart: string, weeks: number): string {
  return format(addDays(parseISO(weekStart), weeks * 7), 'yyyy-MM-dd');
}

function isRotatingWithoutAnchor(personal: Personal): boolean {
  return totalSemanasEsquema(personal.esquema_rotacion) > 1 && !personal.rotacion_inicio_fecha;
}

function confidenceForWeek(input: {
  configIncompleta: number;
  porPlantilla: number;
  totalTrabajadores: number;
}): ProximosPagosConfianza {
  if (input.configIncompleta > 0) return 'baja';
  if (input.porPlantilla > 0 && input.porPlantilla < input.totalTrabajadores) return 'media';
  return 'alta';
}

function notesForWeek(input: {
  configIncompleta: number;
  porPlantilla: number;
  porRotacion: number;
  valesAplicados: number;
}): string[] {
  const notas: string[] = [];
  if (input.porPlantilla > 0) {
    notas.push(`${input.porPlantilla} trabajador(es) calculados con plantilla operativa`);
  }
  if (input.porRotacion > 0) {
    notas.push(`${input.porRotacion} trabajador(es) calculados por rotación base`);
  }
  if (input.configIncompleta > 0) {
    notas.push(`${input.configIncompleta} trabajador(es) sin fecha de inicio de rotación`);
  }
  if (input.valesAplicados > 0) {
    notas.push(`Vales descontados solo en la primera semana proyectada`);
  }
  return notas;
}

import { esEstatusSemanaBonoTransporte } from '@/lib/rotacion-plantillas/bono-transporte-semana';

function projectWorker(input: {
  personal: Personal;
  weekStart: string;
  instanciaActiva?: InstanciaActivaSnapshot | null;
  valesAplicados: number;
}): ProximosPagosWorkerProjection {
  const { personal: rawPersonal, weekStart, instanciaActiva, valesAplicados } = input;
  const personal = rawPersonal.area === 'mina'
    ? { ...rawPersonal, bono_transporte: 0 }
    : rawPersonal;

  const rotacion = resolveWorkerRotacionContext(personal, instanciaActiva, weekStart);
  const missingAnchor = !rotacion && isRotatingWithoutAnchor(personal);
  const fuente: ProximosPagosFuente = rotacion
    ? 'plantilla'
    : missingAnchor
      ? 'config_incompleta'
      : 'rotacion';
  const estado = rotacion
    ? rotacion.estadoAsistencia
    : calculateExpectedAttendance(
        personal.esquema_rotacion,
        personal.rotacion_inicio_fecha,
        weekStart,
      );
  const cicloPosicion = rotacion ? rotacion.posicionCiclo : posicionEsquemaPersonal(personal, weekStart);
  const diasInputBloqueado = rotacion
    ? rotacion.diasInputBloqueado
    : inputsDiasBloqueados(personal.esquema_rotacion, cicloPosicion);
  const diasTrabajados = rotacion
    ? estado === 'trabajada'
      ? NOMINA_DIAS_POR_SEMANA
      : defaultDiasTrabajados(estado)
    : diasTrabajadosPorDefectoCiclo(personal.esquema_rotacion, cicloPosicion, estado);
  const pay = rotacion
    ? calculatePayFromPlantillaEstatus({
        personal,
        estatus: rotacion.estatus,
        diasTrabajados,
        bonificaciones: 0,
        totalVales: valesAplicados,
        bonoTransporte: esEstatusSemanaBonoTransporte(rotacion.estatus)
          ? undefined
          : diasInputBloqueado
            ? 0
            : undefined,
      })
    : calculateNominaRowPay({
        personal,
        estadoAsistencia: estado,
        diasTrabajados,
        weekStart,
        bonificaciones: 0,
        totalVales: valesAplicados,
        bonoTransporte: diasInputBloqueado ? 0 : undefined,
      });

  return {
    personalId: personal.id,
    nombre: personal.nombre_completo,
    amount: pay.total,
    estado: pay.esSemanaLibre ? 'libre' : pay.total > 0 && estado === 'trabajada' ? 'trabajada' : estado,
    diasTrabajados,
    fuente,
    valesAplicados,
  };
}

/** Proyección determinista de desembolsos futuros alineada con el motor semanal. */
export function buildProximosPagosForecast({
  personal,
  area,
  fromWeekStart,
  weeksAhead = 4,
  instanciaActiva = null,
  valesPorPersonal = {},
}: ProximosPagosForecastInput): ProximosPagosWeekForecast[] {
  const roster = personal.filter((p) => isPersonalVisibleInNomina(p, area));
  const forecast: ProximosPagosWeekForecast[] = [];

  for (let i = 0; i < weeksAhead; i++) {
    const weekStart = addWeeksIso(fromWeekStart, i);
    const workers = roster.map((p) =>
      projectWorker({
        personal: p,
        weekStart,
        instanciaActiva,
        valesAplicados: i === 0 ? Number(valesPorPersonal[p.id]) || 0 : 0,
      }),
    );

    let totalUsd = 0;
    let enTurno = 0;
    let libresPagadas = 0;
    let sinPago = 0;
    let porPlantilla = 0;
    let porRotacion = 0;
    let configIncompleta = 0;
    let valesAplicados = 0;

    for (const worker of workers) {
      totalUsd += worker.amount;
      valesAplicados += worker.valesAplicados;
      if (worker.estado === 'trabajada') enTurno += 1;
      else if (worker.estado === 'libre' && worker.amount > 0) libresPagadas += 1;
      else sinPago += 1;

      if (worker.fuente === 'plantilla') porPlantilla += 1;
      else if (worker.fuente === 'config_incompleta') configIncompleta += 1;
      else porRotacion += 1;
    }

    const confianza = confidenceForWeek({
      configIncompleta,
      porPlantilla,
      totalTrabajadores: workers.length,
    });

    forecast.push({
      weekStart,
      totalUsd: parseFloat(totalUsd.toFixed(2)),
      enTurno,
      libresPagadas,
      sinPago,
      porPlantilla,
      porRotacion,
      configIncompleta,
      valesAplicados: parseFloat(valesAplicados.toFixed(2)),
      confianza,
      notas: notesForWeek({ configIncompleta, porPlantilla, porRotacion, valesAplicados }),
      workers,
    });
  }

  return forecast;
}
