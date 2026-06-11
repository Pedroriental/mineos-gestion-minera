'use server';

import { createServerClient } from '@/lib/supabase-server';
import {
  planificarVinculoCiclo,
  posicionGrupoDesdeTrabajadores,
  rolSemanaPorPosicion,
  totalSemanasPerfil,
} from '@/lib/nomina/perfil-ciclo-reglas';
import type { PerfilCompensacion } from '@/lib/types';

export type ActionResult<T = void> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string };

/**
 * Evalúa si un trabajador con perfil de rotación necesita ser vinculado a un ciclo.
 * Si existe un ciclo ABIERTO para su área/vertical, vincula la semana.
 * Si no existe, crea un nuevo ciclo automáticamente.
 */
export async function vincularSemanaACicloAction(input: {
  semanaId: string;
  semanaInicio: string;
  area: string;
  personalIds: string[];
  userId?: string;
}): Promise<ActionResult<{ ciclosCreados: number; ciclosVinculados: number }>> {
  const { semanaId, semanaInicio, area, personalIds, userId } = input;

  try {
    const supabase = await createServerClient();

    // 1. Obtener trabajadores con perfil de compensación de rotación
    const { data: trabajadores, error: trabajadoresError } = await supabase
      .from('personal')
      .select(`
        id,
        nombre_completo,
        vertical_asignada,
        grupo_turno,
        rotacion_inicio_fecha,
        perfil_compensacion_id,
        perfiles_compensacion!inner (
          id,
          nombre,
          esquema_rotacion_default,
          semanas_trabajadas_por_ciclo,
          semanas_libres_por_ciclo,
          duracion_ciclo_dias
        )
      `)
      .in('id', personalIds)
      .not('perfil_compensacion_id', 'is', null);

    if (trabajadoresError) {
      console.error('[vincularSemanaACiclo] Error fetching trabajadores:', trabajadoresError.message);
      return { ok: false, message: `Error al obtener trabajadores: ${trabajadoresError.message}` };
    }

    if (!trabajadores || trabajadores.length === 0) {
      return {
        ok: true,
        message: 'No hay trabajadores con perfil de rotación',
        data: { ciclosCreados: 0, ciclosVinculados: 0 },
      };
    }

    // 2. Agrupar trabajadores por vertical/grupo
    const gruposMap = new Map<string, {
      vertical: string;
      perfil: PerfilCompensacion;
      trabajadores: string[];
      rotaciones: Array<string | null>;
    }>();

    for (const trab of trabajadores) {
      const vertical = trab.vertical_asignada || trab.grupo_turno || 'General';
      const rawPerfil = (trab as unknown as { perfiles_compensacion?: PerfilCompensacion | PerfilCompensacion[] })
        .perfiles_compensacion;
      const perfil = (Array.isArray(rawPerfil) ? rawPerfil[0] : rawPerfil) as PerfilCompensacion | undefined;
      if (!perfil) continue;

      // Solo procesar si tiene rotación (más de 1 semana por ciclo)
      const totalSemanas = totalSemanasPerfil(perfil);
      if (totalSemanas <= 1) continue;

      if (!gruposMap.has(vertical)) {
        gruposMap.set(vertical, {
          vertical,
          perfil,
          trabajadores: [],
          rotaciones: [],
        });
      }
      gruposMap.get(vertical)!.trabajadores.push(trab.id);
      gruposMap.get(vertical)!.rotaciones.push((trab as { rotacion_inicio_fecha?: string | null }).rotacion_inicio_fecha ?? null);
    }

    let ciclosCreados = 0;
    let ciclosVinculados = 0;

    // 3. Para cada grupo, buscar o crear ciclo
    for (const [vertical, grupo] of gruposMap.entries()) {
      const { perfil, trabajadores: grupoTrabajadores, rotaciones } = grupo;
      const totalSemanas = totalSemanasPerfil(perfil);

      // Buscar ciclo ABIERTO para esta área/vertical
      const { data: cicloExistente, error: cicloError } = await supabase
        .from('nomina_ciclos')
        .select('id, fecha_inicio, fecha_fin, semanas:nomina_ciclo_semanas(semana_id, posicion_en_ciclo)')
        .eq('area', area)
        .eq('vertical', vertical)
        .eq('estado', 'ABIERTO')
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cicloError) {
        console.error('[vincularSemanaACiclo] Error buscando ciclo:', cicloError.message);
        continue;
      }

      const semanasExistentes = ((cicloExistente as any)?.semanas ?? []) as Array<{
        semana_id: string;
        posicion_en_ciclo: number;
      }>;

      // Si esta semana ya está vinculada al ciclo abierto, saltar
      if (cicloExistente && semanasExistentes.some((s) => s.semana_id === semanaId)) {
        continue;
      }

      // D1 — Fuente única de posición: CALENDARIO de rotación de los
      // trabajadores (la misma con la que se calculó el pago), nunca el
      // orden en que se cerraron las semanas.
      const posicionCalendario = posicionGrupoDesdeTrabajadores(
        rotaciones,
        semanaInicio,
        totalSemanas,
      );

      const plan = planificarVinculoCiclo({
        semanaInicio,
        totalSemanas,
        posicionCalendario,
        cicloAbierto: cicloExistente
          ? {
              fechaInicio: cicloExistente.fecha_inicio,
              posicionesOcupadas: semanasExistentes.map((s) => s.posicion_en_ciclo),
            }
          : null,
      });

      let cicloId: string;
      const posicionEnCiclo = plan.posicion;

      if (plan.accion === 'usar_ciclo' && cicloExistente) {
        cicloId = cicloExistente.id;
        ciclosVinculados++;
      } else {
        // Ciclo completo, desalineado o inexistente → cerrar el abierto (si
        // hay) y crear uno nuevo cuya ventana deja la semana en su posición
        // de calendario.
        if (plan.accion === 'cerrar_y_crear' && cicloExistente) {
          await supabase
            .from('nomina_ciclos')
            .update({ estado: 'CERRADO', cerrado_at: new Date().toISOString() })
            .eq('id', cicloExistente.id);
        }

        const fechaInicioCiclo = plan.accion === 'usar_ciclo' ? semanaInicio : plan.fechaInicio;
        const nuevoCiclo = await crearNuevoCiclo(
          supabase,
          area,
          vertical,
          perfil,
          fechaInicioCiclo,
          grupoTrabajadores.length,
          userId
        );

        if (!nuevoCiclo.ok) {
          console.error('[vincularSemanaACiclo] Error creando ciclo:', nuevoCiclo.message);
          continue;
        }

        cicloId = nuevoCiclo.data!.cicloId;
        ciclosCreados++;
      }

      const rolSemana = rolSemanaPorPosicion(perfil.esquema_rotacion_default, posicionEnCiclo, perfil);

      // Vincular semana al ciclo
      const { error: vinculoError } = await supabase
        .from('nomina_ciclo_semanas')
        .insert({
          ciclo_id: cicloId,
          semana_id: semanaId,
          posicion_en_ciclo: posicionEnCiclo,
          rol_semana: rolSemana,
        });

      if (vinculoError) {
        console.error('[vincularSemanaACiclo] Error vinculando semana:', vinculoError.message);
        continue;
      }

      // Actualizar registros de nómina con ciclo_id y posicion
      const { error: updateError } = await supabase
        .from('nomina_registros')
        .update({
          ciclo_id: cicloId,
          posicion_en_ciclo: posicionEnCiclo,
        })
        .eq('semana_id', semanaId)
        .in('personal_id', grupoTrabajadores);

      if (updateError) {
        console.error('[vincularSemanaACiclo] Error actualizando registros:', updateError.message);
      }
    }

    return {
      ok: true,
      message: `Ciclos procesados: ${ciclosCreados} creados, ${ciclosVinculados} vinculados`,
      data: { ciclosCreados, ciclosVinculados },
    };
  } catch (err) {
    console.error('[vincularSemanaACiclo] Exception:', err);
    return { ok: false, message: 'Error interno del servidor' };
  }
}

/**
 * Crea un nuevo ciclo de nómina.
 * `fechaInicioCiclo` es el inicio de la VENTANA del ciclo (alineada al
 * calendario de rotación), que puede ser anterior a la semana que se cierra.
 */
async function crearNuevoCiclo(
  supabase: any,
  area: string,
  vertical: string,
  perfil: PerfilCompensacion,
  fechaInicioCiclo: string,
  totalTrabajadores: number,
  userId?: string
): Promise<ActionResult<{ cicloId: string }>> {
  const totalSemanas = totalSemanasPerfil(perfil);
  const duracionDias = perfil.duracion_ciclo_dias;

  // Calcular fecha_fin del ciclo (formateo local, sin saltos de timezone)
  const fechaFin = new Date(`${fechaInicioCiclo}T00:00:00`);
  fechaFin.setDate(fechaFin.getDate() + duracionDias - 1);
  const fechaFinIso = `${fechaFin.getFullYear()}-${String(fechaFin.getMonth() + 1).padStart(2, '0')}-${String(fechaFin.getDate()).padStart(2, '0')}`;

  const label = `Ciclo ${vertical} - ${fechaInicioCiclo} (${totalSemanas} semanas)`;

  const { data: nuevoCiclo, error: cicloError } = await supabase
    .from('nomina_ciclos')
    .insert({
      label,
      fecha_inicio: fechaInicioCiclo,
      fecha_fin: fechaFinIso,
      perfil_compensacion_id: perfil.id,
      area,
      vertical,
      total_ciclo_usd: 0,
      total_trabajadores: totalTrabajadores,
      estado: 'ABIERTO',
      creado_por: userId || null,
    })
    .select('id')
    .single();

  if (cicloError) {
    return { ok: false, message: `Error creando ciclo: ${cicloError.message}` };
  }

  return { ok: true, message: 'Ciclo creado', data: { cicloId: nuevoCiclo.id } };
}

/**
 * Cierra un ciclo cuando se procesa la última semana del ciclo.
 * Consolida totales y cambia estado a CERRADO.
 */
export async function cerrarCicloAutomaticoAction(input: {
  semanaId: string;
  userId?: string;
}): Promise<ActionResult<{ cicloId: string; totalCiclo: number }>> {
  const { semanaId, userId } = input;

  try {
    const supabase = await createServerClient();

    // 1. Buscar si esta semana pertenece a un ciclo
    const { data: cicloSemana, error: cicloSemanaError } = await supabase
      .from('nomina_ciclo_semanas')
      .select(`
        ciclo_id,
        posicion_en_ciclo,
        ciclo:nomina_ciclos (
          id,
          estado,
          perfil_compensacion_id,
          perfiles_compensacion (
            semanas_trabajadas_por_ciclo,
            semanas_libres_por_ciclo
          )
        )
      `)
      .eq('semana_id', semanaId)
      .maybeSingle();

    if (cicloSemanaError) {
      console.error('[cerrarCicloAutomatico] Error buscando ciclo:', cicloSemanaError.message);
      return { ok: false, message: `Error al buscar ciclo: ${cicloSemanaError.message}` };
    }

    if (!cicloSemana) {
      // Esta semana no pertenece a ningún ciclo
      return { ok: true, message: 'Semana sin ciclo asociado' };
    }

    const ciclo = (cicloSemana as any).ciclo;
    if (!ciclo || ciclo.estado !== 'ABIERTO') {
      return { ok: true, message: 'Ciclo no está abierto' };
    }

    const perfil = ciclo.perfiles_compensacion as PerfilCompensacion;
    const totalSemanas = perfil.semanas_trabajadas_por_ciclo + perfil.semanas_libres_por_ciclo;
    const posicionActual = cicloSemana.posicion_en_ciclo;

    // 2. Verificar si es la última semana del ciclo
    if (posicionActual < totalSemanas - 1) {
      // No es la última semana, no cerrar aún
      return { ok: true, message: `Semana ${posicionActual + 1} de ${totalSemanas}, ciclo continúa` };
    }

    // 3. Es la última semana, consolidar totales
    const { data: todasSemanas, error: semanasError } = await supabase
      .from('nomina_ciclo_semanas')
      .select(`
        semana_id,
        nomina_semanas (
          total_pagado
        )
      `)
      .eq('ciclo_id', ciclo.id);

    if (semanasError) {
      console.error('[cerrarCicloAutomatico] Error obteniendo semanas:', semanasError.message);
      return { ok: false, message: `Error al obtener semanas: ${semanasError.message}` };
    }

    const totalCiclo = (todasSemanas || []).reduce((sum, cs) => {
      const semana = (cs as any).nomina_semanas;
      return sum + (Number(semana?.total_pagado) || 0);
    }, 0);

    // 4. Actualizar ciclo a CERRADO con total consolidado
    const { error: updateError } = await supabase
      .from('nomina_ciclos')
      .update({
        estado: 'CERRADO',
        total_ciclo_usd: totalCiclo,
        cerrado_por: userId || null,
        cerrado_at: new Date().toISOString(),
      })
      .eq('id', ciclo.id);

    if (updateError) {
      console.error('[cerrarCicloAutomatico] Error cerrando ciclo:', updateError.message);
      return { ok: false, message: `Error al cerrar ciclo: ${updateError.message}` };
    }

    // 5. Actualizar registros con snapshot del perfil
    const { data: perfilCompleto } = await supabase
      .from('perfiles_compensacion')
      .select('*')
      .eq('id', perfil.id)
      .single();

    if (perfilCompleto) {
      const snapshot = {
        id: perfilCompleto.id,
        nombre: perfilCompleto.nombre,
        politica_dia_libre: perfilCompleto.politica_dia_libre,
        politica_reposo: perfilCompleto.politica_reposo,
        semanas_trabajadas_por_ciclo: perfilCompleto.semanas_trabajadas_por_ciclo,
        semanas_libres_por_ciclo: perfilCompleto.semanas_libres_por_ciclo,
        duracion_ciclo_dias: perfilCompleto.duracion_ciclo_dias,
        bonos_automaticos: perfilCompleto.bonos_automaticos,
        multiplicadores: perfilCompleto.multiplicadores,
      };

      await supabase
        .from('nomina_registros')
        .update({ perfil_compensacion_snapshot: snapshot })
        .eq('ciclo_id', ciclo.id);
    }

    return {
      ok: true,
      message: `Ciclo cerrado: $${totalCiclo.toFixed(2)} consolidado`,
      data: { cicloId: ciclo.id, totalCiclo },
    };
  } catch (err) {
    console.error('[cerrarCicloAutomatico] Exception:', err);
    return { ok: false, message: 'Error interno del servidor' };
  }
}
