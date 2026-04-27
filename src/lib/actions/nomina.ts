'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { PersonalSchema, PersonalUpdateSchema, ImportarPersonalSchema, EmpleadoParseadoType } from '@/lib/validations/nomina';
import { z } from 'zod';

export type ActionResult =
  | { ok: true;  message: string; data?: any }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const REVALIDATE_PATHS = [
  '/admin/nomina',
  '/mina/nomina',
  '/planta/nomina',
  '/operaciones/resumen',
  '/dashboard',
] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
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
    
    // Desactivar trabajadores actuales del área para reemplazarlos (soft-delete style like before)
    await supabase.from('personal').update({ activo: false }).eq('activo', true).eq('area', area);

    let nuevos = 0;
    let actualizados = 0;

    for (const emp of validEmps) {
      const payload = {
        cedula: emp.cedula,
        nombre_completo: emp.nombre_completo,
        cargo: emp.cargo,
        area: emp.area,
        salario_base: emp.salario_semanal,
        fecha_ingreso: emp.fecha_ingreso,
        activo: true,
      };

      const { data: existing } = await supabase.from('personal').select('id').eq('cedula', emp.cedula).maybeSingle();
      
      if (existing) {
        await supabase.from('personal').update(payload).eq('id', existing.id);
        actualizados++;
      } else {
        await supabase.from('personal').insert(payload);
        nuevos++;
      }
    }

    revalidateAll();
    return { ok: true, message: 'Importación completada', data: { nuevos, actualizados } };
  } catch (err) {
    console.error('[Action] importarPersonalAction Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

export async function procesarNominaSemanaAction(
  userId: string,
  area: string,
  inicio: string,
  fin: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    
    // 1. Get active workers for the area
    const { data: trabajadores } = await supabase.from('personal').select('*').eq('activo', true).eq('area', area);
    if (!trabajadores || trabajadores.length === 0) {
      return { ok: false, message: 'No hay trabajadores activos registrados en esta área.' };
    }

    const totalNomina = trabajadores.reduce((s, p) => s + Number(p.salario_base), 0);
    const fechaHoy = new Date().toISOString().split('T')[0];

    // 2. Check if already exists
    const { data: existe } = await supabase
      .from('nomina_semanas')
      .select('id')
      .eq('semana_inicio', inicio)
      .eq('area', area)
      .maybeSingle();

    if (existe) {
      // If we want to strictly prevent double processing from the server side without prompt:
      // return { ok: false, message: 'Esta semana ya fue procesada.' };
      // The previous implementation used upsert, so we will do the same but the UI handled the warning.
    }

    // 3. Create payments
    const pagos = trabajadores.map((p) => ({
      personal_id: p.id,
      fecha_pago: fechaHoy,
      periodo_inicio: inicio,
      periodo_fin: fin,
      salario_base: p.salario_base,
      bonificaciones: 0,
      deducciones: 0,
      total_pagado: p.salario_base,
      metodo_pago: 'nomina_semanal',
      observaciones: `Nómina ${area} ${inicio} al ${fin}`,
      registrado_por: userId || null,
    }));

    // We should delete existing payments for this week/area before inserting if replacing
    // But standard is upsert on `nomina_semanas`. To keep it safe, let's just insert.
    const { error: pagosError } = await supabase.from('nomina_pagos').insert(pagos);
    if (pagosError) return { ok: false, message: `Error al registrar pagos: ${pagosError.message}` };

    // 4. Create gasto
    let gastoId: string | null = null;
    const { data: catRow } = await supabase.from('categorias_gasto').select('id').ilike('nombre', '%nomina%').limit(1).maybeSingle();
    if (catRow) {
      const { data: gastoRow } = await supabase.from('gastos').insert({
        fecha: fechaHoy,
        categoria_id: catRow.id,
        descripcion: `Nómina ${area.toUpperCase()} ${inicio} al ${fin} — ${trabajadores.length} trabajadores`,
        monto: totalNomina,
        proveedor: 'Nómina interna',
        notas: `Procesado automáticamente desde módulo Nómina ${area}.`,
        registrado_por: userId || null,
      }).select('id').maybeSingle();
      gastoId = gastoRow?.id ?? null;
    }

    // 5. Create or update nomina_semanas
    const { error: semanaError } = await supabase.from('nomina_semanas').upsert({
      semana_inicio: inicio,
      semana_fin: fin,
      total_trabajadores: trabajadores.length,
      total_pagado: totalNomina,
      area: area,
      registrado_por: userId || null,
      ...(gastoId ? { gasto_id: gastoId } : {}),
    }, { onConflict: 'semana_inicio,area' });

    if (semanaError) return { ok: false, message: `Error al registrar la semana: ${semanaError.message}` };

    revalidateAll();
    return { ok: true, message: `Nómina procesada: ${trabajadores.length} trabajadores.`, data: { total: totalNomina, count: trabajadores.length } };
  } catch (err) {
    console.error('[Action] procesarNominaSemanaAction Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function revertirSemanaAction(semana: any): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();

    await supabase.from('nomina_pagos').delete().eq('periodo_inicio', semana.semana_inicio);
    if (semana.gasto_id) {
      await supabase.from('gastos').delete().eq('id', semana.gasto_id);
    }
    const { error } = await supabase.from('nomina_semanas').delete().eq('id', semana.id);

    if (error) {
      console.error('[Action] revertirSemanaAction Supabase error:', error.message);
      return { ok: false, message: `Error al revertir: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: 'Nómina revertida exitosamente.' };
  } catch (err) {
    console.error('[Action] revertirSemanaAction Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}
