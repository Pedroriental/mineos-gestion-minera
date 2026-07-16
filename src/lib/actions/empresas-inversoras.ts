'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { EmpresaInversoraSchema } from '@/lib/validations/empresas-inversoras';
import type { CompensacionEmpresa } from '@/lib/compensacion-gastos';

export type ActionResult<T = void> =
  | { ok: true; data?: T; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function listEmpresasInversorasAction(): Promise<ActionResult<CompensacionEmpresa[]>> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('empresas_inversoras')
      .select('id, nombre, nombre_corto, porcentaje_participacion, color')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('[empresas-inversoras] list error:', error.message);
      return { ok: false, message: error.message };
    }

    const empresas: CompensacionEmpresa[] = (data ?? []).map((e) => ({
      id: e.id,
      nombre: e.nombre,
      nombre_corto: e.nombre_corto,
      porcentaje: Number(e.porcentaje_participacion),
      color: e.color ?? '#DAA520',
    }));

    return { ok: true, data: empresas, message: 'OK' };
  } catch (err) {
    console.error('[empresas-inversoras] list exception:', err);
    return { ok: false, message: 'Error al listar empresas inversoras' };
  }
}

export async function createEmpresaInversoraAction(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = EmpresaInversoraSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
      const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: firstError, fieldErrors };
    }

    const data = parsed.data;
    const supabase = await createServerClient();

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { ok: false, message: 'No autenticado' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('complex_id')
      .eq('id', user.user.id)
      .maybeSingle();

    if (!profile?.complex_id) {
      return { ok: false, message: 'No se encontró el complejo del usuario' };
    }

    const { error } = await supabase.from('empresas_inversoras').insert({
      complex_id: profile.complex_id,
      nombre: data.nombre,
      nombre_corto: data.nombre_corto,
      porcentaje_participacion: data.porcentaje_participacion,
      color: data.color ?? '#DAA520',
      activo: data.activo,
      notas: data.notas ?? null,
    });

    if (error) {
      console.error('[empresas-inversoras] create error:', error.message);
      return { ok: false, message: error.message };
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/gastos/resumen');
    return { ok: true, message: 'Empresa inversora creada correctamente' };
  } catch (err) {
    console.error('[empresas-inversoras] create exception:', err);
    return { ok: false, message: 'Error al crear empresa inversora' };
  }
}

export async function updateEmpresaInversoraAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const parsed = EmpresaInversoraSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
      const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: firstError, fieldErrors };
    }

    const data = parsed.data;
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('empresas_inversoras')
      .update({
        nombre: data.nombre,
        nombre_corto: data.nombre_corto,
        porcentaje_participacion: data.porcentaje_participacion,
        color: data.color ?? '#DAA520',
        activo: data.activo,
        notas: data.notas ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[empresas-inversoras] update error:', error.message);
      return { ok: false, message: error.message };
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/gastos/resumen');
    return { ok: true, message: 'Empresa inversora actualizada correctamente' };
  } catch (err) {
    console.error('[empresas-inversoras] update exception:', err);
    return { ok: false, message: 'Error al actualizar empresa inversora' };
  }
}

export async function deleteEmpresaInversoraAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from('empresas_inversoras')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[empresas-inversoras] delete error:', error.message);
      return { ok: false, message: error.message };
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/gastos/resumen');
    return { ok: true, message: 'Empresa inversora desactivada' };
  } catch (err) {
    console.error('[empresas-inversoras] delete exception:', err);
    return { ok: false, message: 'Error al desactivar empresa inversora' };
  }
}
