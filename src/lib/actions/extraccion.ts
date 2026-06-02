'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ExtraccionSchema, ExtraccionUpdateSchema } from '@/lib/validations/extraccion';
import type { ReporteExtraccion } from '@/lib/types';

export async function createExtraccion(raw: Partial<ReporteExtraccion>) {
  try {
    const parsed = ExtraccionSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: msg, error: parsed.error };
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('reportes_extraccion')
      .insert(parsed.data);

    if (error) {
      console.error('Error creating extraccion:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath('/mina/extraccion');
    return { ok: true, message: 'Reporte registrado exitosamente' };
  } catch (err) {
    console.error('Exception creating extraccion:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}

export async function updateExtraccion(raw: Partial<ReporteExtraccion> & { id: string }) {
  try {
    const parsed = ExtraccionUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: msg, error: parsed.error };
    }

    const supabase = await createServerClient();
    const { id, registrado_por, ...payload } = parsed.data;
    const { error } = await supabase
      .from('reportes_extraccion')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Error updating extraccion:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath('/mina/extraccion');
    return { ok: true, message: 'Reporte actualizado exitosamente' };
  } catch (err) {
    console.error('Exception updating extraccion:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}

export async function deleteExtraccion(id: string) {
  try {
    const uuidParsed = z.string().uuid('ID inválido').safeParse(id);
    if (!uuidParsed.success) {
      return { ok: false, message: 'ID de reporte inválido' };
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('reportes_extraccion')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting extraccion:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath('/mina/extraccion');
    return { ok: true, message: 'Reporte eliminado' };
  } catch (err) {
    console.error('Exception deleting extraccion:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}
