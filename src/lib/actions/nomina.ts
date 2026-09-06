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
    const semanaId = String(semana?.id || '').trim();
    const semanaInicio = String(semana?.semana_inicio || semana?.semanaInicio || '').trim();
    const area = String(semana?.area || '').trim();

    // 1. Recopilar todas las semanas objetivo por id o por (semana_inicio, area)
    const targetRowsMap = new Map<string, { id: string; periodo_id?: string | null; gasto_id?: string | null; total_pagado?: number; semana_inicio?: string; area?: string }>();

    if (semanaId) {
      const { data: byId } = await supabase
        .from('nomina_semanas')
        .select('id, periodo_id, gasto_id, total_pagado, semana_inicio, area')
        .eq('id', semanaId);
      if (byId?.length) {
        for (const row of byId) targetRowsMap.set(row.id, row);
      }
    }

    if (semanaInicio && area) {
      const { data: byDate } = await supabase
        .from('nomina_semanas')
        .select('id, periodo_id, gasto_id, total_pagado, semana_inicio, area')
        .eq('semana_inicio', semanaInicio)
        .eq('area', area);
      if (byDate?.length) {
        for (const row of byDate) targetRowsMap.set(row.id, row);
      }
    }

    const allTargetIds = Array.from(targetRowsMap.keys());
    let registrosCerrados: any[] = [];
    const periodIdsToRefresh = new Set<string>();

    if (allTargetIds.length > 0) {
      // 2. Restaurar vales asociados
      for (const sid of allTargetIds) {
        await supabase
          .from('nomina_vales')
          .update({ estado: 'PENDIENTE', semana_id: null })
          .eq('semana_id', sid);
      }

      // 3. Rescatar registros
      const { data: regs } = await supabase
        .from('nomina_registros')
        .select('personal_id, monto_pagado, es_semana_libre, estado_asistencia, dias_trabajados, salario_base_calculado, novedad_turno, novedad_turno_obs')
        .in('semana_id', allTargetIds);
      if (regs?.length) registrosCerrados = regs;

      // 4. Identificar links de periodos
      for (const row of targetRowsMap.values()) {
        if (row.periodo_id) periodIdsToRefresh.add(row.periodo_id);
      }

      const { data: periodoLinks } = await supabase
        .from('nomina_periodo_semanas')
        .select('periodo_id, semana_id')
        .in('semana_id', allTargetIds);

      if (periodoLinks?.length) {
        for (const link of periodoLinks) {
          if (link.periodo_id) periodIdsToRefresh.add(link.periodo_id);
        }
        await supabase
          .from('nomina_periodo_semanas')
          .delete()
          .in('semana_id', allTargetIds);
      }

      // 5. Eliminar registros, cierres, rotaciones
      await supabase.from('nomina_registros').delete().in('semana_id', allTargetIds);
      await supabase.from('nomina_cierres').delete().in('semana_id', allTargetIds);
      await supabase.from('rotacion_instancia_semanas').delete().in('nomina_semana_id', allTargetIds);

      for (const sid of allTargetIds) {
        try {
          await revertirCierreRotacionNominaAction(sid);
        } catch (rotErr) {
          console.warn('[revertirSemanaAction] Error revirtiendo rotación:', rotErr);
        }
      }

      // 6. Eliminar gastos vinculados
      const gastosToDelete = new Set<string>();
      if (semana.gasto_id) gastosToDelete.add(semana.gasto_id);
      for (const row of targetRowsMap.values()) {
        if (row.gasto_id) gastosToDelete.add(row.gasto_id);
      }
      for (const gid of gastosToDelete) {
        await supabase.from('gastos').delete().eq('id', gid);
      }

      // 7. Eliminar semanas
      const { error } = await supabase.from('nomina_semanas').delete().in('id', allTargetIds);
      if (error) {
        console.error('[Action] revertirSemanaAction Supabase error:', error.message);
        return { ok: false, message: `Error al revertir: ${error.message}` };
      }

      // 8. Refrescar totales y metadata de los periodos
      const targetIdsSet = new Set(allTargetIds);
      for (const pid of periodIdsToRefresh) {
        try {
          await refreshPeriodoTotalUsd(supabase, pid);
          const { data: pRow } = await supabase
            .from('nomina_periodos')
            .select('metadata')
            .eq('id', pid)
            .maybeSingle();
          if (pRow?.metadata && typeof pRow.metadata === 'object') {
            const meta = { ...pRow.metadata } as Record<string, any>;
            if (Array.isArray(meta.semana_ids)) {
              meta.semana_ids = meta.semana_ids.filter((id: string) => !targetIdsSet.has(id));
              await supabase.from('nomina_periodos').update({ metadata: meta }).eq('id', pid);
            }
          }
        } catch (pErr) {
          console.warn('[revertirSemanaAction] Error al refrescar total de periodo:', pErr);
        }
      }
    }

    if (semanaInicio) {
      await supabase.from('nomina_pagos').delete().eq('periodo_inicio', semanaInicio);
    }

    await registrarAuditAction(
      'REVERTIR_NOMINA',
      'nomina_semanas',
      semanaId || semanaInicio,
      `Nómina revertida para ${area.toUpperCase() || 'ÁREA'} de la semana ${semanaInicio || semanaId}. Monto eliminado: $${Number(semana.total_pagado || 0).toFixed(2)}.`,
      undefined,
    );

    revalidateAll();
    return {
      ok: true,
      message: 'Nómina revertida exitosamente.',
      data: {
        registros: registrosCerrados || [],
        deletedSemanaIds: allTargetIds,
      },
    };
  } catch (err) {
    console.error('[Action] revertirSemanaAction Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}
