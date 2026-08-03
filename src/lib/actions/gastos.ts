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

// ─────────────────────────────────────────────────────────────
// ACCIÓN DE RESTAURACIÓN / REGISTRO COMPLETO DE JULIO 2026
// ─────────────────────────────────────────────────────────────

export async function restaurarGastosJulio2026Action(): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const user = await getServerUser();

    // 1. Obtener empresas inversoras
    const { data: empresas } = await supabase
      .from('empresas_inversoras')
      .select('id, nombre, nombre_corto')
      .eq('activo', true);

    if (!empresas || empresas.length === 0) {
      return { ok: false, message: 'No hay empresas inversoras activas en la BD.' };
    }

    const riasco = empresas.find(
      (e) =>
        (e.nombre_corto ?? '').toLowerCase().includes('riasco') ||
        e.nombre.toLowerCase().includes('riasco'),
    );
    const fe = empresas.find(
      (e) =>
        (e.nombre_corto ?? '').toLowerCase().includes('fe') ||
        e.nombre.toLowerCase().includes('fe'),
    );

    if (!riasco || !fe) {
      return { ok: false, message: 'No se encontraron las empresas Los Riasco y La Fé.' };
    }

    // 2. Helper para obtener o crear categoría
    async function getCatId(nombreCat: string): Promise<string | null> {
      const { data: existing } = await supabase
        .from('categorias_gasto')
        .select('id')
        .eq('nombre', nombreCat)
        .limit(1)
        .maybeSingle();

      if (existing?.id) return existing.id;

      const { data: created } = await supabase
        .from('categorias_gasto')
        .insert({ nombre: nombreCat, tipo: 'general', activo: true })
        .select('id')
        .maybeSingle();

      return created?.id ?? null;
    }

    const catVoladurasId = await getCatId('Voladuras (Exp y Barre)');
    const catOperacionesId = await getCatId('Operaciones de Mina');
    const catComidaId = await getCatId('Comida en Mina');
    const catNominaId = await getCatId('Nómina en Mina');
    const catMolinoId = await getCatId('Operaciones de Molino');

    // 3. Listado completo de ítems a registrar de Julio 2026
    const itemsAInsertar = [
      // --- Voladuras (Explosivos y Barre) ---
      {
        fecha: '2026-07-11',
        categoria_id: catVoladurasId,
        descripcion: '50 metros de Cordón Detonante',
        monto: 1000.00,
        proveedor: 'Los Riascos',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 1000.00 }],
      },
      {
        fecha: '2026-07-17',
        categoria_id: catVoladurasId,
        descripcion: '350 LP y 50 m de Trenzas',
        monto: 20250.00,
        proveedor: 'La Fe',
        empresas: [{ empresa_id: fe.id, monto_pagado: 20250.00 }],
      },

      // --- Comida en Mina ---
      {
        fecha: '2026-07-02',
        categoria_id: catComidaId,
        descripcion: 'Viveres - Plaza Exito',
        monto: 401.28,
        proveedor: 'Comercializadora Plaza Exito, C.A.',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 401.28 }],
      },
      {
        fecha: '2026-07-02',
        categoria_id: catComidaId,
        descripcion: 'Hortalizas - PEH',
        monto: 62.22,
        proveedor: 'Inversiones PEH, C.A.',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 62.22 }],
      },
      {
        fecha: '2026-07-02',
        categoria_id: catComidaId,
        descripcion: 'Hortalizas - PEH',
        monto: 81.91,
        proveedor: 'Inversiones PEH, C.A.',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 81.91 }],
      },
      {
        fecha: '2026-07-02',
        categoria_id: catComidaId,
        descripcion: 'Viveres - Plaza Exito',
        monto: 2005.55,
        proveedor: 'Comercializadora Plaza Exito, C.A.',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 2005.55 }],
      },
      {
        fecha: '2026-07-09',
        categoria_id: catComidaId,
        descripcion: 'Hortalizas - PEH',
        monto: 145.64,
        proveedor: 'Inversiones PEH, C.A.',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 145.64 }],
      },
      {
        fecha: '2026-07-15',
        categoria_id: catComidaId,
        descripcion: 'Hidratación y Hielo',
        monto: 57.60,
        proveedor: 'Proveedor Comunitario',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 57.60 }],
      },
      {
        fecha: '2026-07-17',
        categoria_id: catComidaId,
        descripcion: 'Viveres - Plaza Exito',
        monto: 1735.15,
        proveedor: 'Comercializadora Plaza Exito, C.A.',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 1735.15 }],
      },
      {
        fecha: '2026-07-17',
        categoria_id: catComidaId,
        descripcion: 'Hortalizas - PEH',
        monto: 120.95,
        proveedor: 'Inversiones PEH, C.A.',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 120.95 }],
      },
      {
        fecha: '2026-07-24',
        categoria_id: catComidaId,
        descripcion: 'Carne de Res',
        monto: 93.33,
        proveedor: 'Proveedor Comunitario',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 93.33 }],
      },
      {
        fecha: '2026-07-24',
        categoria_id: catComidaId,
        descripcion: 'Hidratación e Hielo',
        monto: 90.00,
        proveedor: 'Proveedor Comunitario',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 90.00 }],
      },
      {
        fecha: '2026-07-25',
        categoria_id: catComidaId,
        descripcion: 'Hortalizas - PEH',
        monto: 129.67,
        proveedor: 'Inversiones PEH, C.A.',
        empresas: [
          { empresa_id: fe.id, monto_pagado: 125.00 },
          { empresa_id: riasco.id, monto_pagado: 4.67 },
        ],
      },
      {
        fecha: '2026-07-31',
        categoria_id: catComidaId,
        descripcion: 'Hidratación e Hielo',
        monto: 8.03,
        proveedor: 'Proveedor Comunitario',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 8.03 }],
      },

      // --- Nómina en Mina ---
      {
        fecha: '2026-07-05',
        categoria_id: catNominaId,
        descripcion: 'Nómina Semanal Mina (Día 5)',
        monto: 5900.71,
        proveedor: 'Nómina Operativa',
        empresas: [
          { empresa_id: riasco.id, monto_pagado: 3540.43 },
          { empresa_id: fe.id, monto_pagado: 2360.28 },
        ],
      },
      {
        fecha: '2026-07-12',
        categoria_id: catNominaId,
        descripcion: 'Nómina Semanal Mina (Día 12)',
        monto: 6660.00,
        proveedor: 'Nómina Operativa',
        empresas: [
          { empresa_id: riasco.id, monto_pagado: 3996.00 },
          { empresa_id: fe.id, monto_pagado: 2664.00 },
        ],
      },
      {
        fecha: '2026-07-19',
        categoria_id: catNominaId,
        descripcion: 'Nómina Semanal Mina (Día 19)',
        monto: 7027.84,
        proveedor: 'Nómina Operativa',
        empresas: [
          { empresa_id: riasco.id, monto_pagado: 4216.70 },
          { empresa_id: fe.id, monto_pagado: 2811.14 },
        ],
      },
      {
        fecha: '2026-07-26',
        categoria_id: catNominaId,
        descripcion: 'Nómina Semanal Mina (Día 26)',
        monto: 7128.57,
        proveedor: 'Nómina Operativa',
        empresas: [
          { empresa_id: riasco.id, monto_pagado: 4277.14 },
          { empresa_id: fe.id, monto_pagado: 2851.43 },
        ],
      },

      // --- Operaciones de Mina (Compras La Fé: $13.484,01 + $6.546,00 Acometida V4 = $20.030,01) ---
      {
        fecha: '2026-07-02',
        categoria_id: catOperacionesId,
        descripcion: '1500 Litros de Diesel',
        monto: 1800.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 1800.00 }],
      },
      {
        fecha: '2026-07-02',
        categoria_id: catOperacionesId,
        descripcion: '500 Litros de Gasolina',
        monto: 700.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 700.00 }],
      },
      {
        fecha: '2026-07-05',
        categoria_id: catOperacionesId,
        descripcion: '2 Pares de Radios',
        monto: 120.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 120.00 }],
      },
      {
        fecha: '2026-07-07',
        categoria_id: catOperacionesId,
        descripcion: '2 Brocas',
        monto: 100.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 100.00 }],
      },
      {
        fecha: '2026-07-09',
        categoria_id: catOperacionesId,
        descripcion: '11 Brocas',
        monto: 660.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 660.00 }],
      },
      {
        fecha: '2026-07-16',
        categoria_id: catOperacionesId,
        descripcion: '500 Litros de Gasolina',
        monto: 700.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 700.00 }],
      },
      {
        fecha: '2026-07-17',
        categoria_id: catOperacionesId,
        descripcion: 'Contactor, Sacos',
        monto: 600.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 600.00 }],
      },
      {
        fecha: '2026-07-21',
        categoria_id: catOperacionesId,
        descripcion: 'Materiales de Mina',
        monto: 3000.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 3000.00 }],
      },
      {
        fecha: '2026-07-25',
        categoria_id: catOperacionesId,
        descripcion: 'Información y Planos',
        monto: 650.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 650.00 }],
      },
      {
        fecha: '2026-07-30',
        categoria_id: catOperacionesId,
        descripcion: 'Tubos Elec 1", Sacos',
        monto: 700.00,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 700.00 }],
      },
      {
        fecha: '2026-07-30',
        categoria_id: catOperacionesId,
        descripcion: 'Transformadores y Accesorios',
        monto: 4454.01,
        proveedor: 'Proveedor Local',
        empresas: [{ empresa_id: fe.id, monto_pagado: 4454.01 }],
      },
      {
        fecha: '2026-07-11',
        categoria_id: catOperacionesId,
        descripcion: 'Acometida V4 - Bomba 20Hp, Cable, Mano Obra y Transformadores (Cuota La Fe)',
        monto: 6546.00,
        proveedor: 'Oxifast / Ferremateriales',
        empresas: [{ empresa_id: fe.id, monto_pagado: 6546.00 }],
      },

      // --- Operaciones de Mina (Compras Los Riascos: $24.671,86 Total) ---
      {
        fecha: '2026-07-11',
        categoria_id: catOperacionesId,
        descripcion: 'Acometida V4 - Bomba 20Hp, Cable, Mano Obra y Transformadores (Cuota Los Riascos)',
        monto: 10559.00,
        proveedor: 'Oxifast / Ferremateriales',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 10559.00 }],
      },
      {
        fecha: '2026-07-15',
        categoria_id: catOperacionesId,
        descripcion: 'Equipos, Repuestos e Insumos Operaciones Mina',
        monto: 14112.86,
        proveedor: 'Proveedores Varios',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 14112.86 }],
      },

      // --- Gastos de Molino Los Riasco (Excluidos de compensación mina) ---
      {
        fecha: '2026-07-15',
        categoria_id: catMolinoId,
        descripcion: 'Operaciones de Molino',
        monto: 20782.67,
        proveedor: 'Los Riascos',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 20782.67 }],
      },
      {
        fecha: '2026-07-20',
        categoria_id: catMolinoId,
        descripcion: 'Comida en Molino',
        monto: 2853.13,
        proveedor: 'Los Riascos',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 2853.13 }],
      },
      {
        fecha: '2026-07-31',
        categoria_id: catMolinoId,
        descripcion: 'Nómina en Molino',
        monto: 13580.00,
        proveedor: 'Los Riascos',
        empresas: [{ empresa_id: riasco.id, monto_pagado: 13580.00 }],
      },
    ];

    let creadosCount = 0;
    let lastErrorMsg = '';

    for (const item of itemsAInsertar) {
      if (!item.categoria_id) continue;

      // Buscar si ya existe un gasto idéntico en fecha y monto para no duplicar
      const { data: existingGasto } = await supabase
        .from('gastos')
        .select('id')
        .eq('fecha', item.fecha)
        .eq('categoria_id', item.categoria_id)
        .eq('monto', item.monto)
        .limit(1)
        .maybeSingle();

      let gastoId = existingGasto?.id;

      if (!gastoId) {
        const { data: gastoIns, error: gastoErr } = await supabase
          .from('gastos')
          .insert({
            complex_id: user?.complexId ?? null,
            registrado_por: user?.id ?? null,
            fecha: item.fecha,
            monto: item.monto,
            categoria_id: item.categoria_id,
            descripcion: item.descripcion,
            proveedor: item.proveedor ?? null,
          })
          .select('id');

        if (gastoErr || !gastoIns || gastoIns.length === 0) {
          lastErrorMsg = gastoErr?.message ?? 'Permisos de base de datos o RLS impidieron guardar.';
          console.error('[restaurarGastosJulio2026] Error insertando gasto:', lastErrorMsg);
          continue;
        }

        gastoId = gastoIns[0].id;
        creadosCount++;
      }

      // Asignar empresas al gasto con asignarEmpresasAGasto
      await asignarEmpresasAGasto(supabase, gastoId, item.monto, item.empresas);
    }

    // Reparar cualquier otro gasto de Julio 2026 que no tenga empresas asignadas
    const { data: todosJulio } = await supabase
      .from('gastos')
      .select('id, monto, descripcion, categorias_gasto(nombre)')
      .gte('fecha', '2026-07-01')
      .lte('fecha', '2026-07-31');

    if (todosJulio?.length) {
      const idsJulio = todosJulio.map((g) => g.id);
      const { data: asignaciones } = await supabase
        .from('gastos_empresas')
        .select('gasto_id')
        .in('gasto_id', idsJulio);

      const asignadosSet = new Set((asignaciones ?? []).map((a) => a.gasto_id));

      for (const g of todosJulio) {
        if (!asignadosSet.has(g.id)) {
          const desc = (g.descripcion ?? '').toLowerCase();
          const cat = (Array.isArray(g.categorias_gasto) ? g.categorias_gasto[0]?.nombre : g.categorias_gasto?.nombre ?? '').toLowerCase();

          if (desc.includes('fe') || desc.includes('la fe')) {
            await asignarEmpresasAGasto(supabase, g.id, Number(g.monto), [{ empresa_id: fe.id, monto_pagado: Number(g.monto) }]);
          } else if (desc.includes('riasco')) {
            await asignarEmpresasAGasto(supabase, g.id, Number(g.monto), [{ empresa_id: riasco.id, monto_pagado: Number(g.monto) }]);
          } else {
            // Dividir 60/40 por defecto
            const mRiasco = Math.round(Number(g.monto) * 0.6 * 100) / 100;
            const mFe = Math.round((Number(g.monto) - mRiasco) * 100) / 100;
            await asignarEmpresasAGasto(supabase, g.id, Number(g.monto), [
              { empresa_id: riasco.id, monto_pagado: mRiasco },
              { empresa_id: fe.id, monto_pagado: mFe },
            ]);
          }
        }
      }
    }

    if (creadosCount === 0 && lastErrorMsg) {
      return { ok: false, message: `No se pudieron guardar los gastos: ${lastErrorMsg}` };
    }

    revalidateAll();
    return {
      ok: true,
      message: `Se sincronizaron e ingresaron exitosamente los gastos de Julio 2026.`,
    };
  } catch (err: any) {
    console.error('[restaurarGastosJulio2026] Exception:', err);
    return { ok: false, message: `Error al restaurar gastos: ${err.message}` };
  }
}
