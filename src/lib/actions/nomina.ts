'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { normalizeAreaDetalle, PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import { PersonalSchema, PersonalUpdateSchema, ImportarPersonalSchema, EmpleadoParseadoType } from '@/lib/validations/nomina';
import { z } from 'zod';
import { registrarAuditAction } from './nomina-v3';
import { revertirCierreRotacionNominaAction } from './rotacion-instancias';

export type ActionResult =
  | { ok: true;  message: string; data?: any }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function revalidateAll() {
  PERSONAL_SYNC_PATHS.forEach((p) => revalidatePath(p));
}

export async function createPersonal(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = PersonalSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
      return { ok: false, message: Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos', fieldErrors };
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from('personal').insert(parsed.data);

    if (error) {
      console.error('[Action] createPersonal Supabase error:', error.message);
      return { ok: false, message: `Error al crear personal: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: 'Trabajador registrado exitosamente.' };
  } catch (err) {
    console.error('[Action] createPersonal Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

export async function updatePersonal(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = PersonalUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
      return { ok: false, message: Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos', fieldErrors };
    }

    const { id, ...data } = parsed.data;
    const supabase = await createServerClient();
    const { error } = await supabase.from('personal').update(data).eq('id', id);

    if (error) {
      console.error('[Action] updatePersonal Supabase error:', error.message);
      return { ok: false, message: `Error al actualizar: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: 'Trabajador actualizado.' };
  } catch (err) {
    console.error('[Action] updatePersonal Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
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
  try {
    const parsed = ImportarPersonalSchema.safeParse(rawEmps);
    if (!parsed.success) {
      return { ok: false, message: 'Los datos importados contienen errores o no cumplen el formato requerido.' };
    }

    const validEmps = parsed.data;
    const supabase = await createServerClient();

    // Guardar IDs de trabajadores activos antes de desactivarlos (para rollback)
    const { data: prevActivos } = await supabase
      .from('personal')
      .select('id')
      .eq('activo', true)
      .eq('area', area);
    const prevIds = (prevActivos ?? []).map((p: { id: string }) => p.id);

    // Desactivar trabajadores actuales del área para reemplazarlos
    await supabase.from('personal').update({ activo: false }).eq('activo', true).eq('area', area);

    let nuevos = 0;
    let actualizados = 0;

    try {
      for (const emp of validEmps) {
        const payload = {
          cedula: emp.cedula,
          nombre_completo: emp.nombre_completo,
          cargo: emp.cargo,
          area: emp.area,
          area_detalle: normalizeAreaDetalle(emp.cargo, emp.area),
          salario_base: emp.salario_semanal,
          fecha_ingreso: emp.fecha_ingreso,
          activo: true,
          estado_laboral: 'ACTIVO',
          estatus: 'ACTIVO',
        };

        const { data: existing } = await supabase.from('personal').select('id').eq('cedula', emp.cedula).maybeSingle();

        if (existing) {
          await supabase.from('personal').update(payload).eq('id', existing.id);
          actualizados++;
        } else {
          const { error: insertErr } = await supabase.from('personal').insert(payload);
          if (insertErr) throw new Error(`Error al insertar trabajador ${emp.cedula}: ${insertErr.message}`);
          nuevos++;
        }
      }
    } catch (err) {
      // Rollback: restaurar trabajadores que fueron desactivados
      if (prevIds.length > 0) {
        await supabase.from('personal').update({ activo: true }).in('id', prevIds);
      }
      throw err; // Re-lanzar para el catch exterior
    }

    revalidateAll();
    return { ok: true, message: 'Importación completada', data: { nuevos, actualizados } };
  } catch (err) {
    console.error('[Action] importarPersonalAction Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
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
    return { ok: true, message: 'Nómina revertida exitosamente.' };
  } catch (err) {
    console.error('[Action] revertirSemanaAction Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}
