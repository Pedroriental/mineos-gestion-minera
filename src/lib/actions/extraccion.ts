'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { ReporteExtraccion } from '@/lib/types';

export async function createExtraccion(data: Partial<ReporteExtraccion>) {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('reportes_extraccion')
      .insert(data);

    if (error) {
      console.error('Error creating extraccion:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath('/mina/extraccion');
    return { ok: true, message: 'Reporte registrado exitosamente' };
  } catch (err: any) {
    console.error('Exception creating extraccion:', err);
    return { ok: false, message: err.message || 'Error desconocido' };
  }
}

export async function updateExtraccion(data: Partial<ReporteExtraccion> & { id: string }) {
  try {
    const supabase = await createServerClient();

    // No queremos actualizar el id ni quien lo registró
    const { id, registrado_por, ...payload } = data;

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
  } catch (err: any) {
    console.error('Exception updating extraccion:', err);
    return { ok: false, message: err.message || 'Error desconocido' };
  }
}

export async function deleteExtraccion(id: string) {
  try {
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
  } catch (err: any) {
    console.error('Exception deleting extraccion:', err);
    return { ok: false, message: err.message || 'Error desconocido' };
  }
}
