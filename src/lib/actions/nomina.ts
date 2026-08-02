'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import { z } from 'zod';
import { registrarAuditAction } from './nomina-v3';
import { revertirCierreRotacionNominaAction } from './rotacion-instancias';
import { refreshPeriodoTotalUsd } from '@/lib/nomina/cierre-semana-db';

export type ActionResult =
  | { ok: true;  message: string; data?: any }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function revalidateAll() {
  PERSONAL_SYNC_PATHS.forEach((p) => revalidatePath(p));
}

export async function createPersonal(raw: unknown): Promise<ActionResult> {
  void raw;
  return {
    ok: false,
    message:
      'Flujo legacy deshabilitado. Registra trabajadores desde Base de Trabajadores o asignación V3 para conservar perfil, asignación y auditoría.',
  };
}

export async function updatePersonal(raw: unknown): Promise<ActionResult> {
  void raw;
  return {
    ok: false,
    message:
      'Flujo legacy deshabilitado. Edita trabajadores desde Base de Trabajadores para conservar perfil, asignación y auditoría.',
  };
}

export async function togglePersonalActivo(id: string, activo: boolean): Promise<ActionResult> {
  try {
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) return { ok: false, message: 'ID inválido' };

    const supabase = await createServerClient();
    const { error } = await supabase.from('personal').update({ activo }).eq('id', parsed.data);

    if (error) {
      console.error('[Action] togglePersonalActivo Supabase error:', error.message);
      return { ok: false, message: `Error al cambiar estado: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: activo ? 'Trabajador reactivado.' : 'Trabajador desactivado.' };
  } catch (err) {
    console.error('[Action] togglePersonalActivo Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

export async function borrarTodoPersonalArea(area: string): Promise<ActionResult> {
  try {
    const parsed = z.string().min(2).safeParse(area);
    if (!parsed.success) return { ok: false, message: 'Área inválida' };

    const supabase = await createServerClient();
    const { error } = await supabase.from('personal').delete().eq('activo', true).eq('area', parsed.data);

    if (error) {
      console.error('[Action] borrarTodoPersonalArea Supabase error:', error.message);
      if (error.message.includes('foreign key constraint')) {
        return { ok: false, message: 'No se puede borrar el personal porque hay una nómina procesada que depende de ellos. Revierte la semana en el Historial antes de borrarlos.' };
      }
      return { ok: false, message: `Error al intentar borrar: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: 'Trabajadores eliminados exitosamente.' };
  } catch (err) {
    console.error('[Action] borrarTodoPersonalArea Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

export async function importarPersonalAction(rawEmps: unknown, area: string): Promise<ActionResult> {
  void rawEmps;
  void area;
  return {
    ok: false,
    message:
      'Importación legacy deshabilitada: no asigna perfil de compensación ni rotación. Usa el importador V3/base de trabajadores.',
  };
}

/**
 * @deprecated V1 — ZOMBI. No usar. Usa `procesarCierreNominaV3Action` de `nomina-v3.ts`.
 * Esta función es un no-op seguro que devuelve error inmediatamente.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function procesarNominaSemanaAction(
  _userId: string,
  _area: string,
  _inicio: string,
  _fin: string,
): Promise<ActionResult> {
  console.error('[DEPRECATED] procesarNominaSemanaAction (V1). Usar procesarCierreNominaV3Action.');
  return { ok: false, message: '[DEPRECATED] Usar procesarCierreNominaV3Action.' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function revertirSemanaAction(semana: any): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const semanaId = semana.id as string;

    const { data: valesRows } = await supabase
      .from('nomina_vales')
      .select('id')
      .eq('semana_id', semanaId);

    if (valesRows?.length) {
      await supabase
        .from('nomina_vales')
        .update({ estado: 'PENDIENTE', semana_id: null })
        .eq('semana_id', semanaId);
    } else {
      await supabase.from('nomina_vales').update({ semana_id: null }).eq('semana_id', semanaId);
    }

    // Rescatar registros guardados antes de eliminar la semana para poder conservar el borrador
    const { data: registrosCerrados } = await supabase
      .from('nomina_registros')
      .select('personal_id, monto_pagado, es_semana_libre, estado_asistencia, dias_trabajados, salario_base_calculado, novedad_turno, novedad_turno_obs')
      .eq('semana_id', semanaId);

    // Limpiar links del periodo consolidado antes de borrar la semana
    const { data: periodoLinks } = await supabase
      .from('nomina_periodo_semanas')
      .select('periodo_id')
      .eq('semana_id', semanaId);

    if (periodoLinks?.length) {
      await supabase.from('nomina_periodo_semanas').delete().eq('semana_id', semanaId);
      for (const link of periodoLinks) {
        if (link.periodo_id) {
          await refreshPeriodoTotalUsd(supabase, link.periodo_id);
        }
      }
    }

    await supabase.from('nomina_registros').delete().eq('semana_id', semanaId);
    await supabase.from('nomina_cierres').delete().eq('semana_id', semanaId);

    if (semana.gasto_id) {
      await supabase.from('gastos').delete().eq('id', semana.gasto_id);
    }

    await supabase.from('nomina_pagos').delete().eq('periodo_inicio', semana.semana_inicio);

    await revertirCierreRotacionNominaAction(semanaId);

    const { error } = await supabase.from('nomina_semanas').delete().eq('id', semanaId);

    if (error) {
      console.error('[Action] revertirSemanaAction Supabase error:', error.message);
      return { ok: false, message: `Error al revertir: ${error.message}` };
    }

    await registrarAuditAction(
      'REVERTIR_NOMINA',
      'nomina_semanas',
      semanaId,
      `Nómina revertida para ${semana.area?.toUpperCase()} de la semana ${semana.semana_inicio}. Monto eliminado: $${Number(semana.total_pagado || 0).toFixed(2)}.`,
      undefined,
    );

    revalidateAll();
    return {
      ok: true,
      message: 'Nómina revertida exitosamente.',
      data: { registros: registrosCerrados || [] },
    };
  } catch (err) {
    console.error('[Action] revertirSemanaAction Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}
