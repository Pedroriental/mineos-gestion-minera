import type {
  PerfilCompensacion,
  Personal,
  NominaRegistro,
  NominaCicloSemana,
  PoliticaDiaLibre,
  PoliticaReposo,
  BonoAutomatico,
} from '@/lib/types';
import {
  calculateNominaRowPay,
  applyProportionalWeeklyPay,
  NOMINA_DIAS_POR_SEMANA,
  type EstadoAsistenciaNomina,
} from '@/lib/nomina-calculo';
import {
  calcularBonoTransportePorPosicion,
  calcularSalarioPorPosicionCiclo,
  inputsDiasBloqueados,
  rolSemanaPorPosicion,
  totalSemanasPerfil,
} from '@/lib/nomina/perfil-ciclo-reglas';

export interface CalculoPagoCicloInput {
  personal: Personal;
  perfil: PerfilCompensacion;
  cicloSemanas: (NominaCicloSemana & {
    semana: { semana_inicio: string; [key: string]: any };
    registro?: NominaRegistro;
  })[];
}

export interface PagoSemanaDetalle {
  semana_id: string;
  semana_inicio: string;
  posicion_en_ciclo: number;
  rol_semana: string;
  estado_asistencia: EstadoAsistenciaNomina;
  dias_trabajados: number;
  salario_base_calculado: number;
  bono_transporte: number;
  bonificaciones: number;
  bonos_automaticos: { tipo: string; monto: number }[];
  total_vales: number;
  total: number;
  es_semana_libre: boolean;
  es_finiquito: boolean;
  notas?: string;
}

export interface CalculoPagoCicloResult {
  personal_id: string;
  personal_nombre: string;
  perfil_compensacion: string;
  semanas: PagoSemanaDetalle[];
  total_ciclo: number;
  total_salarios: number;
  total_bonos: number;
  total_vales: number;
  dias_totales_trabajados: number;
  semanas_trabajadas: number;
  semanas_libres: number;
}

function evaluarCondicionBono(
  condicion: string,
  posicion: number,
  estado: EstadoAsistenciaNomina,
): boolean {
  switch (condicion) {
    case 'POSICION_0':
      return posicion === 0;
    case 'POSICION_1':
      return posicion === 1;
    case 'POSICION_2':
      return posicion === 2;
    case 'TRABAJADA':
      return estado === 'trabajada';
    case 'LIBRE':
      return estado === 'libre';
    default:
      return false;
  }
}

function calcularBonosAutomaticos(
  bonos: BonoAutomatico[],
  posicion: number,
  estado: EstadoAsistenciaNomina,
  diasTrabajados: number,
): { tipo: string; monto: number }[] {
  const resultados: { tipo: string; monto: number }[] = [];

  for (const bono of bonos) {
    if (evaluarCondicionBono(bono.condicion, posicion, estado)) {
      const montoProporcional = applyProportionalWeeklyPay(bono.monto, diasTrabajados);
      if (montoProporcional > 0) {
        resultados.push({ tipo: bono.tipo, monto: montoProporcional });
      }
    }
  }

  return resultados;
}

function resolverEstadoAsistencia(
  rolSemana: string,
  estadoManual?: EstadoAsistenciaNomina | null,
): EstadoAsistenciaNomina {
  if (estadoManual) return estadoManual;

  switch (rolSemana) {
    case 'libre':
      return 'libre';
    case 'trabajada':
      return 'trabajada';
    case 'no_laborada':
      return 'no_laborado';
    case 'reposo':
      return 'libre';
    case 'vacaciones':
      return 'libre';
    default:
      return 'trabajada';
  }
}

function aplicarPoliticaDiaLibre(
  politica: PoliticaDiaLibre,
  personal: Personal,
  diasTrabajados: number,
): number {
  switch (politica) {
    case 'TARIFA_PLANA':
      return Number(personal.salario_libre) || Number(personal.salario_base);

    case 'SALARIO_LIBRE':
      return applyProportionalWeeklyPay(
        Number(personal.salario_libre) || Number(personal.salario_base),
        diasTrabajados,
      );

    case 'GARANTIZADO':
      return Number(personal.salario_base);

    case 'SIN_PAGO':
    default:
      return 0;
  }
}

function aplicarPoliticaReposo(
  politica: PoliticaReposo,
  personal: Personal,
  diasTrabajados: number,
): number {
  switch (politica) {
    case 'PAGO_COMPLETO':
      return Number(personal.salario_base);

    case 'PARCIAL':
      return applyProportionalWeeklyPay(Number(personal.salario_base), diasTrabajados);

    case 'SIN_PAGO':
    default:
      return 0;
  }
}

export function calcularPagoCicloTrabajador(
  input: CalculoPagoCicloInput,
): CalculoPagoCicloResult {
  const { personal, perfil, cicloSemanas } = input;

  const semanasDetalle: PagoSemanaDetalle[] = [];
  let totalCiclo = 0;
  let totalSalarios = 0;
  let totalBonos = 0;
  let totalVales = 0;
  let diasTotales = 0;
  let semanasTrabajadas = 0;
  let semanasLibres = 0;

  for (const cs of cicloSemanas) {
    const estadoAsistencia = resolverEstadoAsistencia(
      cs.rol_semana,
      cs.registro?.estado_asistencia,
    );

    let diasTrabajados =
      cs.registro?.dias_trabajados ??
      (estadoAsistencia === 'no_laborado' ? 0 : NOMINA_DIAS_POR_SEMANA);

    let salarioBaseCalculado = 0;
    let esSemanaLibre = false;
    let notas: string | undefined;

    const totalSemanasCiclo = totalSemanasPerfil(perfil);
    const usaReglasPosicion = totalSemanasCiclo > 1;

    if (cs.rol_semana === 'reposo') {
      salarioBaseCalculado = aplicarPoliticaReposo(
        perfil.politica_reposo,
        personal,
        diasTrabajados,
      );
      notas = `Reposo - Política: ${perfil.politica_reposo}`;
    } else if (usaReglasPosicion) {
      if (inputsDiasBloqueados(perfil.esquema_rotacion_default, cs.posicion_en_ciclo)) {
        diasTrabajados = 0;
      }
      salarioBaseCalculado = calcularSalarioPorPosicionCiclo(
        perfil.esquema_rotacion_default,
        personal,
        cs.posicion_en_ciclo,
        estadoAsistencia,
        diasTrabajados,
      );
      if (
        cs.rol_semana === 'libre' ||
        estadoAsistencia === 'libre' ||
        cs.rol_semana === 'no_laborada'
      ) {
        esSemanaLibre = cs.rol_semana === 'libre' || estadoAsistencia === 'libre';
        semanasLibres++;
        notas = `Posición ${cs.posicion_en_ciclo} — ${cs.rol_semana}`;
      } else {
        semanasTrabajadas++;
        notas = `Posición ${cs.posicion_en_ciclo} — trabajada`;
      }
    } else if (estadoAsistencia === 'libre' || cs.rol_semana === 'libre') {
      salarioBaseCalculado = aplicarPoliticaDiaLibre(
        perfil.politica_dia_libre,
        personal,
        diasTrabajados,
      );
      esSemanaLibre = true;
      semanasLibres++;
      notas = `Semana libre - Política: ${perfil.politica_dia_libre}`;
    } else {
      const payResult = calculateNominaRowPay({
        personal,
        estadoAsistencia,
        diasTrabajados,
        weekStart: cs.semana.semana_inicio,
        bonoTransporte: cs.registro?.bono_transporte_pagado,
        bonificaciones: cs.registro?.bonificaciones,
        totalVales: cs.registro?.total_vales,
      });
      salarioBaseCalculado = payResult.salarioBaseCalculado;
      semanasTrabajadas++;
    }

    const bonosAutomaticos = calcularBonosAutomaticos(
      perfil.bonos_automaticos,
      cs.posicion_en_ciclo,
      estadoAsistencia,
      diasTrabajados,
    );

    const montoBonosAuto = bonosAutomaticos.reduce((sum, b) => sum + b.monto, 0);
    const bonoTransporte =
      cs.registro?.bono_transporte_pagado ??
      (usaReglasPosicion
        ? calcularBonoTransportePorPosicion(
            perfil.esquema_rotacion_default,
            personal,
            cs.posicion_en_ciclo,
            estadoAsistencia,
            diasTrabajados,
          )
        : 0);
    const bonificaciones = (cs.registro?.bonificaciones ?? 0) + montoBonosAuto;
    const valesDeducidos = cs.registro?.total_vales ?? 0;

    const totalSemana = Math.max(
      0,
      parseFloat(
        (salarioBaseCalculado + bonoTransporte + bonificaciones - valesDeducidos).toFixed(2),
      ),
    );

    semanasDetalle.push({
      semana_id: cs.semana_id,
      semana_inicio: cs.semana.semana_inicio,
      posicion_en_ciclo: cs.posicion_en_ciclo,
      rol_semana: cs.rol_semana,
      estado_asistencia: estadoAsistencia,
      dias_trabajados: diasTrabajados,
      salario_base_calculado: salarioBaseCalculado,
      bono_transporte: bonoTransporte,
      bonificaciones,
      bonos_automaticos: bonosAutomaticos,
      total_vales: valesDeducidos,
      total: totalSemana,
      es_semana_libre: esSemanaLibre,
      es_finiquito: cs.registro?.es_finiquito ?? false,
      notas,
    });

    totalCiclo += totalSemana;
    totalSalarios += salarioBaseCalculado;
    totalBonos += bonoTransporte + bonificaciones;
    totalVales += valesDeducidos;
    diasTotales += diasTrabajados;
  }

  return {
    personal_id: personal.id,
    personal_nombre: personal.nombre_completo,
    perfil_compensacion: perfil.nombre,
    semanas: semanasDetalle,
    total_ciclo: parseFloat(totalCiclo.toFixed(2)),
    total_salarios: parseFloat(totalSalarios.toFixed(2)),
    total_bonos: parseFloat(totalBonos.toFixed(2)),
    total_vales: parseFloat(totalVales.toFixed(2)),
    dias_totales_trabajados: diasTotales,
    semanas_trabajadas: semanasTrabajadas,
    semanas_libres: semanasLibres,
  };
}

export function validarConsistenciaCiclo(
  perfil: PerfilCompensacion,
  semanasCount: number,
): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  const semanasEsperadas = perfil.semanas_trabajadas_por_ciclo + perfil.semanas_libres_por_ciclo;

  if (semanasCount !== semanasEsperadas) {
    errores.push(
      `El ciclo tiene ${semanasCount} semanas pero el perfil "${perfil.nombre}" espera ${semanasEsperadas} ` +
        `(${perfil.semanas_trabajadas_por_ciclo} trabajadas + ${perfil.semanas_libres_por_ciclo} libres)`,
    );
  }

  const duracionEsperada = semanasEsperadas * 7;
  if (perfil.duracion_ciclo_dias !== duracionEsperada) {
    errores.push(
      `El perfil define ${perfil.duracion_ciclo_dias} días pero las semanas suman ${duracionEsperada} días`,
    );
  }

  return { valido: errores.length === 0, errores };
}

export function proyectarPagoCiclo(
  personal: Personal,
  perfil: PerfilCompensacion,
  semanaInicioCiclo: string,
): CalculoPagoCicloResult {
  const semanasProyectadas: CalculoPagoCicloInput['cicloSemanas'] = [];
  const totalSemanas = perfil.semanas_trabajadas_por_ciclo + perfil.semanas_libres_por_ciclo;
  const baseDate = new Date(semanaInicioCiclo);

  for (let i = 0; i < totalSemanas; i++) {
    const weekDate = new Date(baseDate);
    weekDate.setDate(weekDate.getDate() + i * 7);
    const weekStart = weekDate.toISOString().split('T')[0];

    const rolSemana = rolSemanaPorPosicion(perfil.esquema_rotacion_default, i, perfil);

    semanasProyectadas.push({
      ciclo_id: '',
      semana_id: '',
      posicion_en_ciclo: i,
      rol_semana: rolSemana as any,
      created_at: '',
      semana: { semana_inicio: weekStart } as any,
    });
  }

  return calcularPagoCicloTrabajador({
    personal,
    perfil,
    cicloSemanas: semanasProyectadas,
  });
}
