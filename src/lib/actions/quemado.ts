'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { QuemadoSchema, QuemadoUpdateSchema } from '@/lib/validations/quemado';
import { z } from 'zod';

export type ActionResult =
  | { ok: true;  message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const REVALIDATE_PATHS = [
  '/mina/quemado',
  '/operaciones/resumen',
  '/dashboard',
] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

export async function createQuemado(raw: unknown): Promise<ActionResult> {
  const parsed = QuemadoSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const data = parsed.data;
  const supabase = await createServerClient();

  const { error } = await supabase.from('reportes_quemado').insert({
    fecha:            data.fecha,
    turno:            data.turno,
    numero_quemada:   data.numero_quemada   || null,
    planchas:         data.planchas,
    manto_amalgama_g: data.manto_amalgama_g || null,
    manto_oro_g:      data.manto_oro_g      || null,
    retorta_oro_g:    data.retorta_oro_g    || null,
    total_amalgama_g: data.total_amalgama_g,
    total_oro_g:      data.total_oro_g,
    responsable:      data.responsable      || null,
    observaciones:    data.observaciones    || null,
    registrado_por:   data.registrado_por   || null,
  });

  if (error) {
    console.error('[Action] createQuemado:', error.message);
    return { ok: false, message: `Error al guardar: ${error.message}` };
  }

  revalidateAll();
  return { ok: true, message: 'Reporte de quemado registrado' };
}

export async function updateQuemado(raw: unknown): Promise<ActionResult> {
  const parsed = QuemadoUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const { id, registrado_por: _rp, ...rest } = parsed.data;
  const supabase = await createServerClient();

  const { error } = await supabase.from('reportes_quemado').update({
    fecha:            rest.fecha,
    turno:            rest.turno,
    numero_quemada:   rest.numero_quemada   || null,
    planchas:         rest.planchas,
    manto_amalgama_g: rest.manto_amalgama_g || null,
    manto_oro_g:      rest.manto_oro_g      || null,
    retorta_oro_g:    rest.retorta_oro_g    || null,
    total_amalgama_g: rest.total_amalgama_g,
    total_oro_g:      rest.total_oro_g,
    responsable:      rest.responsable      || null,
    observaciones:    rest.observaciones    || null,
  }).eq('id', id);

  if (error) {
    console.error('[Action] updateQuemado:', error.message);
    return { ok: false, message: `Error al actualizar: ${error.message}` };
  }

  revalidateAll();
  return { ok: true, message: 'Reporte actualizado' };
}

export async function deleteQuemado(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: 'ID inválido' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('reportes_quemado').delete().eq('id', parsed.data);

  if (error) {
    console.error('[Action] deleteQuemado:', error.message);
    return { ok: false, message: `Error al eliminar: ${error.message}` };
  }

  revalidateAll();
  return { ok: true, message: 'Reporte eliminado' };
}
