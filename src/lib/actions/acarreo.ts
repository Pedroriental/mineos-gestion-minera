'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AcarreoSchema, AcarreoUpdateSchema } from '@/lib/validations/acarreo';
import type { ReporteAcarreo } from '@/lib/types';
import { assertBibliotecaValue } from '@/lib/validations/biblioteca';

const ACARREO_PATH = '/planta/acarreo';

function normalizeLineas(lineas: ReporteAcarreo['lineas']): ReporteAcarreo['lineas'] {
  return lineas.map((linea) => ({
    sacos: linea.sacos,
    vertical: linea.vertical?.trim() || undefined,
    disparo: linea.disparo?.trim() || undefined,
  }));
}

export async function createAcarreo(raw: Partial<ReporteAcarreo>) {
  try {
    const parsed = AcarreoSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: msg, error: parsed.error };
    }

    const data = parsed.data;
    let validatedMina = data.mina;
    let validatedMolino = data.molino;
    try {
      validatedMina = await assertBibliotecaValue('minas', data.mina, 'Mina');
      validatedMolino = await assertBibliotecaValue('molinos', data.molino, 'Molino');
    } catch {
      // Permite valores fuera de biblioteca si assert falla en entornos sin catálogo cargado
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from('reportes_acarreo').insert({
      ...data,
      mina: validatedMina,
      molino: validatedMolino,
      lineas: normalizeLineas(data.lineas),
    });

    if (error) {
      console.error('Error creating acarreo:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath(ACARREO_PATH);
    return { ok: true, message: 'Informe de acarreo registrado' };
  } catch (err) {
    console.error('Exception creating acarreo:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}

export async function updateAcarreo(raw: Partial<ReporteAcarreo> & { id: string }) {
  try {
    const parsed = AcarreoUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: msg, error: parsed.error };
    }

    const { id, registrado_por, ...rest } = parsed.data;
    let validatedMina = rest.mina;
    let validatedMolino = rest.molino;
    try {
      validatedMina = await assertBibliotecaValue('minas', rest.mina, 'Mina');
      validatedMolino = await assertBibliotecaValue('molinos', rest.molino, 'Molino');
    } catch {
      // keep original values
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('reportes_acarreo')
      .update({
        ...rest,
        mina: validatedMina,
        molino: validatedMolino,
        lineas: normalizeLineas(rest.lineas),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating acarreo:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath(ACARREO_PATH);
    return { ok: true, message: 'Informe de acarreo actualizado' };
  } catch (err) {
    console.error('Exception updating acarreo:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}

export async function deleteAcarreo(id: string) {
  try {
    const uuidParsed = z.string().uuid('ID inválido').safeParse(id);
    if (!uuidParsed.success) {
      return { ok: false, message: 'ID de reporte inválido' };
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from('reportes_acarreo').delete().eq('id', id);

    if (error) {
      console.error('Error deleting acarreo:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath(ACARREO_PATH);
    return { ok: true, message: 'Informe eliminado' };
  } catch (err) {
    console.error('Exception deleting acarreo:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}
