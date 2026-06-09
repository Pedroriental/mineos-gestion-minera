'use server';

import { createServerClient } from '@/lib/supabase-server';
import type {
  NominaCiclo,
  NominaCicloSemana,
  DetalleCicloCompleto,
  EstadoCiclo,
} from '@/lib/types';

export type ActionResult<T = void> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string };

export async function getCiclosActivos(
  area?: string,
): Promise<ActionResult<NominaCiclo[]>> {
  try {
    const supabase = await createServerClient();

    let query = supabase
      .from('nomina_ciclos')
      .select(`
        *,
        perfil_compensacion:perfiles_compensacion(*)
      `)
      .eq('estado', 'ABIERTO')
      .order('fecha_inicio', { ascending: false });

    if (area) {
      query = query.eq('area', area);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getCiclosActivos] Error:', error.message);
      return { ok: false, message: `Error al obtener ciclos: ${error.message}` };
    }

    return {
      ok: true,
      message: `${data?.length ?? 0} ciclos activos encontrados`,
      data: (data ?? []) as NominaCiclo[],
    };
  } catch (err) {
    console.error('[getCiclosActivos] Exception:', err);
    return { ok: false, message: 'Error interno del servidor' };
  }
}

export async function getCiclosPorEstado(
  estado: EstadoCiclo,
  area?: string,
  limit = 50,
): Promise<ActionResult<NominaCiclo[]>> {
  try {
    const supabase = await createServerClient();

    let query = supabase
      .from('nomina_ciclos')
      .select(`
        *,
        perfil_compensacion:perfiles_compensacion(*)
      `)
      .eq('estado', estado)
      .order('fecha_inicio', { ascending: false })
      .limit(limit);

    if (area) {
      query = query.eq('area', area);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getCiclosPorEstado] Error:', error.message);
      return { ok: false, message: `Error al obtener ciclos: ${error.message}` };
    }

    return {
      ok: true,
      message: `${data?.length ?? 0} ciclos encontrados`,
      data: (data ?? []) as NominaCiclo[],
    };
  } catch (err) {
    console.error('[getCiclosPorEstado] Exception:', err);
    return { ok: false, message: 'Error interno del servidor' };
  }
}

export async function getDetalleCiclo(
  cicloId: string,
): Promise<ActionResult<DetalleCicloCompleto>> {
  try {
    const supabase = await createServerClient();

    const { data: ciclo, error: cicloError } = await supabase
      .from('nomina_ciclos')
      .select(`
        *,
        perfil_compensacion:perfiles_compensacion(*)
      `)
      .eq('id', cicloId)
      .single();

    if (cicloError || !ciclo) {
      console.error('[getDetalleCiclo] Error:', cicloError?.message);
      return { ok: false, message: `Ciclo no encontrado: ${cicloError?.message ?? 'sin datos'}` };
    }

    const { data: cicloSemanas, error: semanasError } = await supabase
      .from('nomina_ciclo_semanas')
      .select(`
        *,
        semana:nomina_semanas(*)
      `)
      .eq('ciclo_id', cicloId)
      .order('posicion_en_ciclo', { ascending: true });

    if (semanasError) {
      console.error('[getDetalleCiclo] Error semanas:', semanasError.message);
      return { ok: false, message: `Error al obtener semanas del ciclo: ${semanasError.message}` };
    }

    const semanaIds = (cicloSemanas ?? []).map((cs) => cs.semana_id);

    if (semanaIds.length === 0) {
      return {
        ok: true,
        message: 'Ciclo sin semanas vinculadas',
        data: {
          ...(ciclo as NominaCiclo),
          semanas: [],
          trabajadores: [],
        },
      };
    }

    const { data: registros, error: registrosError } = await supabase
      .from('nomina_registros')
      .select(`
        *,
        personal:personal(*)
      `)
      .in('semana_id', semanaIds)
      .order('created_at', { ascending: true });

    if (registrosError) {
      console.error('[getDetalleCiclo] Error registros:', registrosError.message);
      return { ok: false, message: `Error al obtener registros: ${registrosError.message}` };
    }

    const registrosByPersonal = new Map<string, typeof registros>();
    for (const reg of registros ?? []) {
      const pid = reg.personal_id;
      if (!registrosByPersonal.has(pid)) {
        registrosByPersonal.set(pid, []);
      }
      registrosByPersonal.get(pid)!.push(reg);
    }

    const cicloSemanasMap = new Map<string, NominaCicloSemana>();
    for (const cs of cicloSemanas ?? []) {
      cicloSemanasMap.set(cs.semana_id, cs as NominaCicloSemana);
    }

    const trabajadores = Array.from(registrosByPersonal.entries()).map(([personalId, regs]) => {
      const personal = regs[0]?.personal;
      const registrosConSemana = regs.map((reg) => ({
        ...reg,
        semana: reg.semana as any,
        ciclo_semana: cicloSemanasMap.get(reg.semana_id)!,
      }));
      const totalCiclo = regs.reduce((sum, r) => sum + (Number(r.monto_pagado) || 0), 0);

      return {
        personal: personal!,
        registros: registrosConSemana,
        total_ciclo: parseFloat(totalCiclo.toFixed(2)),
      };
    });

    trabajadores.sort((a, b) => a.personal.nombre_completo.localeCompare(b.personal.nombre_completo));

    return {
      ok: true,
      message: `Detalle del ciclo ${ciclo.label} obtenido correctamente`,
      data: {
        ...(ciclo as NominaCiclo),
        semanas: (cicloSemanas ?? []) as NominaCicloSemana[],
        trabajadores,
      },
    };
  } catch (err) {
    console.error('[getDetalleCiclo] Exception:', err);
    return { ok: false, message: 'Error interno del servidor' };
  }
}

export async function getCiclosByTrabajador(
  personalId: string,
  limit = 10,
): Promise<ActionResult<NominaCiclo[]>> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('nomina_ciclo_semanas')
      .select(`
        ciclo_id,
        ciclo:nomina_ciclos(
          *,
          perfil_compensacion:perfiles_compensacion(*)
        )
      `)
      .in(
        'semana_id',
        (
          await supabase
            .from('nomina_registros')
            .select('semana_id')
            .eq('personal_id', personalId)
        ).data?.map((r) => r.semana_id) ?? [],
      )
      .limit(limit * 3);

    if (error) {
      console.error('[getCiclosByTrabajador] Error:', error.message);
      return { ok: false, message: `Error al obtener ciclos: ${error.message}` };
    }

    const ciclosMap = new Map<string, NominaCiclo>();
    for (const row of data ?? []) {
      const ciclo = (row as any).ciclo;
      if (ciclo && !ciclosMap.has(ciclo.id)) {
        ciclosMap.set(ciclo.id, ciclo as NominaCiclo);
      }
    }

    const ciclos = Array.from(ciclosMap.values())
      .sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())
      .slice(0, limit);

    return {
      ok: true,
      message: `${ciclos.length} ciclos encontrados`,
      data: ciclos,
    };
  } catch (err) {
    console.error('[getCiclosByTrabajador] Exception:', err);
    return { ok: false, message: 'Error interno del servidor' };
  }
}
