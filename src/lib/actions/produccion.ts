'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { ProduccionSchema, ProduccionUpdateSchema } from '@/lib/validations/produccion';
import { z } from 'zod';

export type ActionResult =
  | { ok: true;  message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const REVALIDATE_PATHS = [
  '/planta/produccion',
  '/operaciones/resumen',
  '/dashboard',
] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

export async function createProduccion(raw: unknown): Promise<ActionResult> {
  const parsed = ProduccionSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const data = parsed.data;
  const supabase = await createServerClient();

  const { error } = await supabase.from('reportes_produccion').insert({
    fecha: data.fecha,
    turno: data.turno,
    molino: data.molino,
    material: data.material,
    material_codigo: data.material_codigo || null,
    amalgama_1_g: data.amalgama_1_g || null,
    amalgama_2_g: data.amalgama_2_g || null,
    oro_recuperado_g: data.oro_recuperado_g,
    merma_1_pct: data.merma_1_pct || null,
    merma_2_pct: data.merma_2_pct || null,
    sacos: data.sacos,
    toneladas_procesadas: data.toneladas_procesadas,
    tenor_tonelada_gpt: data.tenor_tonelada_gpt || null,
    tenor_saco_gps: data.tenor_saco_gps || null,
    responsable: data.responsable || null,
    observaciones: data.observaciones || null,
    registrado_por: data.registrado_por || null,
  });

  if (error) {
    console.error('[Action] createProduccion:', error.message);
    return { ok: false, message: `Error al guardar: ${error.message}` };
  }

  revalidateAll();
  return { ok: true, message: 'Reporte de producción registrado' };
}

export async function updateProduccion(raw: unknown): Promise<ActionResult> {
  const parsed = ProduccionUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const { id, registrado_por: _rp, ...rest } = parsed.data;
  const supabase = await createServerClient();

  const { error } = await supabase.from('reportes_produccion').update({
    fecha: rest.fecha,
    turno: rest.turno,
    molino: rest.molino,
    material: rest.material,
    material_codigo: rest.material_codigo || null,
    amalgama_1_g: rest.amalgama_1_g || null,
    amalgama_2_g: rest.amalgama_2_g || null,
    oro_recuperado_g: rest.oro_recuperado_g,
    merma_1_pct: rest.merma_1_pct || null,
    merma_2_pct: rest.merma_2_pct || null,
    sacos: rest.sacos,
    toneladas_procesadas: rest.toneladas_procesadas,
    tenor_tonelada_gpt: rest.tenor_tonelada_gpt || null,
    tenor_saco_gps: rest.tenor_saco_gps || null,
    responsable: rest.responsable || null,
    observaciones: rest.observaciones || null,
  }).eq('id', id);

  if (error) {
    console.error('[Action] updateProduccion:', error.message);
    return { ok: false, message: `Error al actualizar: ${error.message}` };
  }

  revalidateAll();
  return { ok: true, message: 'Reporte actualizado' };
}

export async function deleteProduccion(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: 'ID inválido' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('reportes_produccion').delete().eq('id', parsed.data);

  if (error) {
    console.error('[Action] deleteProduccion:', error.message);
    return { ok: false, message: `Error al eliminar: ${error.message}` };
  }

  revalidateAll();
  return { ok: true, message: 'Reporte eliminado' };
}
