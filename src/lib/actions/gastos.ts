'use server';

/**
 * Server Actions — Módulo de Gastos
 *
 * Flujo:
 *   Cliente llama action → Zod valida en servidor → Supabase muta →
 *   revalidatePath purga caché → cliente recibe ActionResult
 *
 * NUNCA importar desde archivos 'use client' directamente,
 * solo pasar la referencia de la función.
 */

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { GastoSchema, GastoUpdateSchema } from '@/lib/validations/gastos';
import { z } from 'zod';

// ── Tipo de respuesta estándar ────────────────────────────────
export type ActionResult =
  | { ok: true;  message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

// ── Paths a revalidar cuando cambia un gasto ──────────────────
const REVALIDATE_PATHS = [
  '/admin/gastos',
  '/operaciones/resumen',
  '/operaciones/costos',
  '/dashboard',
] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

// ─────────────────────────────────────────────────────────────
// CREATE — Registrar nuevo gasto
// ─────────────────────────────────────────────────────────────
export async function createGasto(raw: unknown): Promise<ActionResult> {
  try {
    // 1) Validar con Zod
    const parsed = GastoSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    // Primer mensaje de error como texto principal
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const data = parsed.data;

  // 2) Insertar en Supabase
  const supabase = await createServerClient();
  const { error } = await supabase.from('gastos').insert({
    fecha:               data.fecha,
    categoria_id:        data.categoria_id,
    descripcion:         data.descripcion,
    monto:               data.monto,
    proveedor:           data.proveedor   || null,
    factura_referencia:  data.factura_referencia || null,
    notas:               data.notas       || null,
    registrado_por:      data.registrado_por    || null,
  });

    if (error) {
      console.error('[Action] createGasto Supabase error:', error.message);
      return { ok: false, message: `Error al guardar: ${error.message}` };
    }

    // 3) Purgar caché y actualizar UI sin reload
    revalidateAll();
    return { ok: true, message: 'Gasto registrado correctamente' };
  } catch (err) {
    console.error('[Action] createGasto Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

// ─────────────────────────────────────────────────────────────
// UPDATE — Actualizar gasto existente
// ─────────────────────────────────────────────────────────────
export async function updateGasto(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = GastoUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const { id, registrado_por: _rp, ...rest } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('gastos')
    .update({
      fecha:              rest.fecha,
      categoria_id:       rest.categoria_id,
      descripcion:        rest.descripcion,
      monto:              rest.monto,
      proveedor:          rest.proveedor          || null,
      factura_referencia: rest.factura_referencia || null,
      notas:              rest.notas              || null,
    })
    .eq('id', id);

    if (error) {
      console.error('[Action] updateGasto Supabase error:', error.message);
      return { ok: false, message: `Error al actualizar: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: 'Gasto actualizado correctamente' };
  } catch (err) {
    console.error('[Action] updateGasto Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE — Eliminar gasto
// ─────────────────────────────────────────────────────────────
export async function deleteGasto(id: string): Promise<ActionResult> {
  try {
    // Validar que el id sea un UUID válido
    const parsed = z.string().uuid('ID inválido').safeParse(id);
  if (!parsed.success) {
    return { ok: false, message: 'ID de gasto inválido' };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from('gastos').delete().eq('id', parsed.data);

    if (error) {
      console.error('[Action] deleteGasto Supabase error:', error.message);
      return { ok: false, message: `Error al eliminar: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: 'Gasto eliminado' };
  } catch (err) {
    console.error('[Action] deleteGasto Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}
