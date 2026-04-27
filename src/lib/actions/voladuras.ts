'use server';

/**
 * Server Actions — Módulo de Voladuras
 *
 * Flujo:
 *   Cliente llama action → Zod valida en servidor → Supabase muta →
 *   revalidatePath purga caché → cliente recibe ActionResult
 *
 * Las voladuras alimentan el RPC get_rentabilidad (ciclos de extracción).
 * Por eso se revalida también /operaciones/resumen y /dashboard.
 */

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { VoladuraSchema, VoladuraUpdateSchema } from '@/lib/validations/voladuras';
import { z } from 'zod';

// ── Tipo de respuesta estándar (igual al módulo de Gastos) ────
export type ActionResult =
  | { ok: true;  message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

// ── Paths a revalidar cuando cambia una voladura ──────────────
const REVALIDATE_PATHS = [
  '/mina/voladuras',
  '/operaciones/resumen',
  '/dashboard',
] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

// ─────────────────────────────────────────────────────────────
// CREATE — Registrar nuevo reporte de voladura
// ─────────────────────────────────────────────────────────────
export async function createVoladura(raw: unknown): Promise<ActionResult> {
  // 1) Validar con Zod (coerciona strings a numbers)
  const parsed = VoladuraSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const firstError  = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const data = parsed.data;

  // 2) Insertar en Supabase
  const supabase = createServerClient();
  const { error } = await supabase.from('reportes_voladuras').insert({
    fecha:                 data.fecha,
    turno:                 data.turno,
    mina:                  data.mina                  ?? null,
    frente:                'Vertical',
    orientacion:           'vertical',
    numero_frente:         null,
    responsable:           data.responsable            ?? null,
    hora_inicio_barrenado: data.hora_inicio_barrenado  ?? null,
    hora_fin_barrenado:    data.hora_fin_barrenado      ?? null,
    numero_disparo:        data.numero_disparo          ?? null,
    hora_disparo:          data.hora_disparo            ?? null,
    vertical_disparo:      data.vertical_disparo        ?? null,
    sin_novedad:           data.sin_novedad,
    huecos_cantidad:       data.huecos_cantidad,
    huecos_pies:           data.huecos_pies,
    chupis_cantidad:       data.chupis_cantidad,
    chupis_pies:           data.chupis_pies,
    fosforos_lp:           data.fosforos_lp,
    espaguetis:            data.espaguetis,
    vitamina_e:            data.vitamina_e,
    trenza_metros:         data.trenza_metros,
    arroz_kg:              data.arroz_kg,
    pausas_barrenado:      data.pausas_barrenado?.length ? data.pausas_barrenado : null,
    observaciones_disparo: data.observaciones_disparo   ?? null,
    observaciones:         data.observaciones            ?? null,
    registrado_por:        data.registrado_por           ?? null,
  });

  if (error) {
    console.error('[Action] createVoladura:', error.message);
    return { ok: false, message: `Error al guardar: ${error.message}` };
  }

  // 3) Purgar caché → Next.js inyecta el nuevo RSC payload
  revalidateAll();
  return { ok: true, message: 'Reporte de voladura registrado correctamente' };
}

// ─────────────────────────────────────────────────────────────
// UPDATE — Actualizar reporte existente
// ─────────────────────────────────────────────────────────────
export async function updateVoladura(raw: unknown): Promise<ActionResult> {
  const parsed = VoladuraUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const firstError  = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const { id, registrado_por: _rp, ...rest } = parsed.data;

  const supabase = createServerClient();
  const { error } = await supabase
    .from('reportes_voladuras')
    .update({
      fecha:                 rest.fecha,
      turno:                 rest.turno,
      mina:                  rest.mina                  ?? null,
      responsable:           rest.responsable            ?? null,
      hora_inicio_barrenado: rest.hora_inicio_barrenado  ?? null,
      hora_fin_barrenado:    rest.hora_fin_barrenado      ?? null,
      numero_disparo:        rest.numero_disparo          ?? null,
      hora_disparo:          rest.hora_disparo            ?? null,
      vertical_disparo:      rest.vertical_disparo        ?? null,
      sin_novedad:           rest.sin_novedad,
      huecos_cantidad:       rest.huecos_cantidad,
      huecos_pies:           rest.huecos_pies,
      chupis_cantidad:       rest.chupis_cantidad,
      chupis_pies:           rest.chupis_pies,
      fosforos_lp:           rest.fosforos_lp,
      espaguetis:            rest.espaguetis,
      vitamina_e:            rest.vitamina_e,
      trenza_metros:         rest.trenza_metros,
      arroz_kg:              rest.arroz_kg,
      pausas_barrenado:      rest.pausas_barrenado?.length ? rest.pausas_barrenado : null,
      observaciones_disparo: rest.observaciones_disparo   ?? null,
      observaciones:         rest.observaciones            ?? null,
    })
    .eq('id', id);

  if (error) {
    console.error('[Action] updateVoladura:', error.message);
    return { ok: false, message: `Error al actualizar: ${error.message}` };
  }

  revalidateAll();
  return { ok: true, message: 'Reporte actualizado correctamente' };
}

// ─────────────────────────────────────────────────────────────
// DELETE — Eliminar reporte
// ─────────────────────────────────────────────────────────────
export async function deleteVoladura(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid('ID inválido').safeParse(id);
  if (!parsed.success) {
    return { ok: false, message: 'ID de reporte inválido' };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('reportes_voladuras')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    console.error('[Action] deleteVoladura:', error.message);
    return { ok: false, message: `Error al eliminar: ${error.message}` };
  }

  revalidateAll();
  return { ok: true, message: 'Reporte eliminado' };
}
