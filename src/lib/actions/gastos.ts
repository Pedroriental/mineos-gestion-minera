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
import { GastoConceptoSchema } from '@/lib/validations/conceptos';
import { checkGastoDuplicatesForSave } from '@/lib/actions/gastos-audit';
import { applyGastoOroConversion } from '@/lib/actions/gastos-oro';
import { formatDuplicateMatches, type GastoDuplicateMatch } from '@/lib/gastos-audit';
import { z } from 'zod';
import { getServerUser } from '@/lib/rbac';
import { notifyAdmins } from '@/lib/notify-admins';

// ── Tipo de respuesta estándar ────────────────────────────────
export type ActionResult =
  | { ok: true;  message: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
      code?: 'DUPLICATE' | 'VALIDATION';
      duplicates?: GastoDuplicateMatch[];
    };

type SaveOptions = {
  acknowledgeDuplicates?: boolean;
  excludeIds?: string[];
};

// ── Paths a revalidar cuando cambia un gasto ──────────────────
const REVALIDATE_PATHS = [
  '/admin/gastos',
  '/admin/gastos/conceptos',
  '/admin/gastos/resumen',
  '/operaciones/resumen',
  '/operaciones/costos',
  '/dashboard',
] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

async function ensureNoDuplicates(
  gastos: Array<z.infer<typeof GastoSchema>>,
  options?: SaveOptions,
): Promise<ActionResult | null> {
  if (options?.acknowledgeDuplicates) return null;

  const excludeIds = options?.excludeIds ?? [];
  const duplicates = await checkGastoDuplicatesForSave(gastos, excludeIds);
  if (duplicates.length === 0) return null;

  return {
    ok: false,
    code: 'DUPLICATE',
    duplicates,
    message: `Posible gasto duplicado.\n${formatDuplicateMatches(duplicates)}`,
  };
}

// ─────────────────────────────────────────────────────────────
// CREATE — Registrar nuevo gasto
// ─────────────────────────────────────────────────────────────
export async function createGasto(raw: unknown, options?: SaveOptions): Promise<ActionResult> {
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

  const enriched = await applyGastoOroConversion(data);
  const duplicateBlock = await ensureNoDuplicates([enriched], options);
  if (duplicateBlock) return duplicateBlock;

  // 2) Insertar en Supabase y verificar que RLS no bloquee
  const supabase = await createServerClient();
  const user = await getServerUser();
  const { data: inserted, error } = await supabase.from('gastos').insert({
    complex_id:           user?.complexId ?? null,
    fecha:               enriched.fecha,
    categoria_id:        enriched.categoria_id,
    descripcion:         enriched.descripcion,
    monto:               enriched.monto,
    monto_gramos_oro:    enriched.monto_gramos_oro ?? null,
    precio_oro_usd_gramo: enriched.precio_oro_usd_gramo ?? null,
    proveedor:           enriched.proveedor   ?? null,
    factura_referencia:  enriched.factura_referencia ?? null,
    notas:               enriched.notas       ?? null,
    registrado_por:      enriched.registrado_por    ?? null,
  }).select('id');

  if (error) {
    console.error('[Action] createGasto Supabase error:', error.message);
    return { ok: false, message: `Error al guardar: ${error.message}` };
  }

  if (!inserted || inserted.length === 0) {
    console.error('[Action] createGasto: RLS silently blocked insert');
    return { ok: false, message: 'Error de permisos: no se pudo guardar el gasto.' };
  }

  // Asignar empresas al gasto
  const gastoId = inserted[0].id;
  const empresasAsignacion = await asignarEmpresasAGasto(
    supabase,
    gastoId,
    enriched.monto,
    data.empresas ?? null,
  );
  if (!empresasAsignacion.ok) {
    // Si falla la asignación, igual continuamos (no es crítico)
    console.error('[Action] createGasto empresas asignacion:', empresasAsignacion.message);
  }

  // Notify admins if a supervisor submitted the report
  if (user?.complexId) {
    await notifyAdmins({
      complexId: user.complexId,
      type: 'report_submitted',
      title: 'Nuevo gasto registrado',
      body: `${user.email} registró un gasto de $${enriched.monto}`,
      href: '/admin/gastos',
      actorId: user.id,
      actorRole: user.role,
    });
  }

  // 3) Purgar caché y actualizar UI sin reload
  revalidateAll();
  return { ok: true, message: 'Gasto registrado correctamente' };
  } catch (err) {
    console.error('[Action] createGasto Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

/**
 * Asigna empresas a un gasto recién creado.
 * Si no se proporcionan empresas, asigna 100% a La Fé (la primera empresa activa).
 */
async function asignarEmpresasAGasto(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  gastoId: string,
  montoTotal: number,
  empresasInput: Array<{ empresa_id: string; monto_pagado: number; porcentaje?: number }> | null | undefined,
): Promise<{ ok: boolean; message: string }> {
  // Limpiar asignaciones previas antes de insertar las nuevas (para crear/actualizar limpio)
  const { error: deleteError } = await supabase
    .from('gastos_empresas')
    .delete()
    .eq('gasto_id', gastoId);

  if (deleteError) {
    console.error('[asignarEmpresasAGasto] Error clearing old assignments:', deleteError.message);
  }

  let empresasAsignar: Array<{ empresa_id: string; monto_pagado: number; porcentaje: number }>;

  if (empresasInput && empresasInput.length > 0) {
    empresasAsignar = empresasInput.map((e) => ({
      empresa_id: e.empresa_id,
      monto_pagado: e.monto_pagado,
      porcentaje: e.porcentaje ?? 0,
    }));
  } else {
    // Default: asignar 100% a La Fé
    const { data: laFe } = await supabase
      .from('empresas_inversoras')
      .select('id')
      .eq('nombre_corto', 'la_fe')
      .eq('activo', true)
      .limit(1)
      .maybeSingle();

    if (!laFe) {
      // Si no existe La Fé, tomar la primera empresa activa
      const { data: primeraActiva } = await supabase
        .from('empresas_inversoras')
        .select('id')
        .eq('activo', true)
        .limit(1)
        .maybeSingle();

      if (!primeraActiva) {
        return { ok: true, message: 'No hay empresas inversoras activas' };
      }
      empresasAsignar = [
        { empresa_id: primeraActiva.id, monto_pagado: montoTotal, porcentaje: 100 },
      ];
    } else {
      empresasAsignar = [
        { empresa_id: laFe.id, monto_pagado: montoTotal, porcentaje: 100 },
      ];
    }
  }

  const { error } = await supabase.from('gastos_empresas').insert(
    empresasAsignar.map((e) => ({
      gasto_id: gastoId,
      empresa_id: e.empresa_id,
      monto_pagado: e.monto_pagado,
      porcentaje: e.porcentaje,
      es_pago_directo: true,
    })),
  );

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: 'Empresas asignadas' };
}

// ─────────────────────────────────────────────────────────────
// CREATE BULK — Registrar múltiples gastos a la vez
// ─────────────────────────────────────────────────────────────
export async function createGastosBulk(raws: unknown[], options?: SaveOptions): Promise<ActionResult> {
  try {
    const parsedArray = z.array(GastoSchema).safeParse(raws);

    if (!parsedArray.success) {
      const fieldErrors = parsedArray.error.flatten().fieldErrors as unknown as Record<string, string[]>;
      const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos en uno de los registros';
      return { ok: false, message: firstError, fieldErrors };
    }

    const data = parsedArray.data;
    if (data.length === 0) return { ok: false, message: 'No hay gastos para registrar' };

    const enrichedRows = await Promise.all(data.map((row) => applyGastoOroConversion(row)));

    const duplicateBlock = await ensureNoDuplicates(enrichedRows, options);
    if (duplicateBlock) return duplicateBlock;

    const supabase = await createServerClient();
    const bulkUser = await getServerUser();
    const rowsToInsert = enrichedRows.map((g) => ({
      complex_id:           bulkUser?.complexId ?? null,
      fecha:               g.fecha,
      categoria_id:        g.categoria_id,
      descripcion:         g.descripcion,
      monto:               g.monto,
      monto_gramos_oro:    g.monto_gramos_oro ?? null,
      precio_oro_usd_gramo: g.precio_oro_usd_gramo ?? null,
      proveedor:           g.proveedor   ?? null,
      factura_referencia:  g.factura_referencia ?? null,
      notas:               g.notas       ?? null,
      registrado_por:      g.registrado_por    ?? null,
    }));

    const { data: inserted, error } = await supabase.from('gastos').insert(rowsToInsert).select('id');

    if (error) {
      console.error('[Action] createGastosBulk Supabase error:', error.message);
      return { ok: false, message: `Error al guardar lote: ${error.message}` };
    }

    if (!inserted || inserted.length === 0) {
      console.error('[Action] createGastosBulk: RLS silently blocked bulk insert');
      return { ok: false, message: 'Error de permisos: no se pudieron guardar los gastos.' };
    }

    // Asignar empresas a cada gasto insertado
    for (let i = 0; i < inserted.length; i++) {
      const gastoId = inserted[i].id;
      const originalRow = data[i];
      const enrichedRow = enrichedRows[i];
      const res = await asignarEmpresasAGasto(
        supabase,
        gastoId,
        enrichedRow.monto,
        originalRow.empresas ?? null,
      );
      if (!res.ok) {
        console.error('[Action] createGastosBulk empresas:', res.message);
      }
    }

    revalidateAll();
    return { ok: true, message: `${data.length} gasto(s) registrado(s) correctamente` };
  } catch (err) {
    console.error('[Action] createGastosBulk Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

// ─────────────────────────────────────────────────────────────
// UPDATE — Actualizar gasto existente
// ─────────────────────────────────────────────────────────────
export async function updateGasto(raw: unknown, options?: SaveOptions): Promise<ActionResult> {
  try {
    const parsed = GastoUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: firstError, fieldErrors };
  }

  const { id, registrado_por: _rp, ...rest } = parsed.data;
  const enriched = await applyGastoOroConversion({ ...rest, registrado_por: parsed.data.registrado_por ?? null });

  const duplicateBlock = await ensureNoDuplicates(
    [enriched],
    { ...options, excludeIds: [id, ...(options?.excludeIds ?? [])] },
  );
  if (duplicateBlock) return duplicateBlock;

  const supabase = await createServerClient();
  const { data: updated, error } = await supabase
    .from('gastos')
    .update({
      fecha:              enriched.fecha,
      categoria_id:       enriched.categoria_id,
      descripcion:        enriched.descripcion,
      monto:              enriched.monto,
      monto_gramos_oro:   enriched.monto_gramos_oro ?? null,
      precio_oro_usd_gramo: enriched.precio_oro_usd_gramo ?? null,
      proveedor:          enriched.proveedor          ?? null,
      factura_referencia: enriched.factura_referencia ?? null,
      notas:              enriched.notas              ?? null,
    })
    .eq('id', id)
    .select('id');

    if (error) {
      console.error('[Action] updateGasto Supabase error:', error.message);
      return { ok: false, message: `Error al actualizar: ${error.message}` };
    }

    if (!updated || updated.length === 0) {
      console.error('[Action] updateGasto: RLS silently blocked update or record not found');
      return { ok: false, message: 'Error de permisos: no se pudo actualizar el gasto.' };
    }

    // Actualizar asignaciones de empresas para el gasto
    const empresasAsignacion = await asignarEmpresasAGasto(
      supabase,
      id,
      enriched.monto,
      parsed.data.empresas ?? null,
    );

    if (!empresasAsignacion.ok) {
      console.error('[Action] updateGasto empresas asignacion:', empresasAsignacion.message);
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

// ─────────────────────────────────────────────────────────────
// GET OR CREATE CATEGORIA — Permite categorías de texto libre
// ─────────────────────────────────────────────────────────────
export async function getOrCreateCategoria(
  nombre: string
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const nombreClean = nombre.trim();
    if (!nombreClean) return { ok: false, message: 'Nombre de categoría vacío' };

    const supabase = await createServerClient();

    // 1) Buscar por nombre exacto (insensible a mayúsculas)
    const { data: existing } = await supabase
      .from('categorias_gasto')
      .select('id')
      .eq('nombre', nombreClean)
      .limit(1)
      .maybeSingle();

    if (existing?.id) return { ok: true, id: existing.id };

    // 2) No existe → crear
    const { data: created, error } = await supabase
      .from('categorias_gasto')
      .insert({ nombre: nombreClean, tipo: 'general', activo: true })
      .select('id')
      .single();

    if (error || !created?.id) {
      console.error('[Action] getOrCreateCategoria:', error?.message);
      return { ok: false, message: 'No se pudo crear la categoría' };
    }

    revalidateAll();
    return { ok: true, id: created.id };
  } catch (err) {
    console.error('[Action] getOrCreateCategoria Exception:', err);
    return { ok: false, message: 'Error interno del servidor' };
  }
}

// ─────────────────────────────────────────────────────────────
// CATALOGO DE CONCEPTOS — registrar, actualizar y eliminar
// ─────────────────────────────────────────────────────────────

export async function upsertGastoConcepto(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = GastoConceptoSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as unknown as Record<string, string[]>;
      const firstError = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: firstError, fieldErrors };
    }

    const data = parsed.data;
    const supabase = await createServerClient();
    const payload = {
      descripcion: data.descripcion.trim(),
      categoria_default_id: data.categoria_default_id ?? null,
      proveedor_sugerido: data.proveedor_sugerido ?? null,
      monto_sugerido: data.monto_sugerido ?? null,
      notas: data.notas ?? null,
      activo: data.activo ?? true,
    };

    let error;
    if (data.id) {
      ({ error } = await supabase.from('gasto_conceptos').update(payload).eq('id', data.id));
    } else {
      ({ error } = await supabase.from('gasto_conceptos').insert(payload));
    }

    if (error) {
      console.error('[Action] upsertGastoConcepto Supabase error:', error.message, error.code);
      if (error.code === '23505' || error.message.toLowerCase().includes('unique constraint') || error.message.toLowerCase().includes('duplicate key')) {
        return { ok: false, message: 'Ya existe un concepto registrado con esta misma descripción en el catálogo.' };
      }
      return { ok: false, message: `Error al guardar concepto: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: 'Concepto guardado correctamente en el catálogo' };
  } catch (err) {
    console.error('[Action] upsertGastoConcepto Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}

export async function deleteGastoConcepto(id: string): Promise<ActionResult> {
  try {
    const parsed = z.string().uuid('ID de concepto inválido').safeParse(id);
    if (!parsed.success) {
      return { ok: false, message: 'ID de concepto inválido' };
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from('gasto_conceptos').delete().eq('id', id);

    if (error) {
      console.error('[Action] deleteGastoConcepto Supabase error:', error.message);
      return { ok: false, message: `Error al eliminar del catálogo: ${error.message}` };
    }

    revalidateAll();
    return { ok: true, message: 'Concepto eliminado del catálogo' };
  } catch (err) {
    console.error('[Action] deleteGastoConcepto Exception:', err);
    return { ok: false, message: 'Error interno del servidor. Por favor, intenta de nuevo.' };
  }
}
