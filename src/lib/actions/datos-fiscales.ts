'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';
import {
  FiscalEntidadSchema,
  FiscalEntidadUpdateSchema,
  FiscalRepresentanteSchema,
  FiscalRepresentanteUpdateSchema,
  FiscalCuentaBancariaSchema,
  FiscalCuentaBancariaUpdateSchema,
  FiscalTextoLegalSchema,
  FiscalTextoLegalUpdateSchema,
  FiscalParametroSchema,
  FiscalParametroUpdateSchema,
} from '@/lib/validations/datos-fiscales';
import type {
  FiscalCuentaBancaria,
  FiscalEntidad,
  FiscalEntidadCompleta,
  FiscalParametro,
  FiscalRepresentante,
  FiscalTextoLegal,
} from '@/lib/types';

export type FiscalActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const REVALIDATE_PATHS = ['/plataforma/datos-fiscales', '/plataforma/diccionario-variables'] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

async function clearEmisorPrincipal(supabase: Awaited<ReturnType<typeof createServerClient>>, exceptId?: string) {
  let q = supabase.from('fiscal_entidades').update({ es_emisor_principal: false }).eq('es_emisor_principal', true);
  if (exceptId) q = q.neq('id', exceptId);
  await q;
}

export async function upsertFiscalEntidadAction(raw: Record<string, unknown>): Promise<FiscalActionResult> {
  const schema = raw.id ? FiscalEntidadUpdateSchema : FiscalEntidadSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const data = parsed.data;
    const payload = {
      nombre_comercial: data.nombre_comercial.trim(),
      razon_social: data.razon_social.trim(),
      rif: data.rif.trim(),
      direccion_fiscal: data.direccion_fiscal.trim(),
      direccion_operativa: data.direccion_operativa?.trim() || null,
      ciudad: data.ciudad?.trim() || null,
      estado_region: data.estado_region?.trim() || null,
      codigo_postal: data.codigo_postal?.trim() || null,
      pais: data.pais?.trim() || 'Venezuela',
      telefono: data.telefono?.trim() || null,
      email: data.email?.trim() || null,
      sitio_web: data.sitio_web?.trim() || null,
      actividad_economica: data.actividad_economica?.trim() || null,
      es_emisor_principal: !!data.es_emisor_principal,
      notas: data.notas?.trim() || null,
      activo: true,
    };

    const id: string | undefined = 'id' in data ? (data as any).id : undefined;

    if (payload.es_emisor_principal) {
      await clearEmisorPrincipal(supabase, id);
    }

    const { error } = id
      ? await supabase.from('fiscal_entidades').update(payload).eq('id', id)
      : await supabase.from('fiscal_entidades').insert(payload);

    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: id ? 'Entidad actualizada.' : 'Entidad registrada.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar la entidad.' };
  }
}

export async function upsertFiscalRepresentanteAction(raw: Record<string, unknown>): Promise<FiscalActionResult> {
  const schema = raw.id ? FiscalRepresentanteUpdateSchema : FiscalRepresentanteSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const data = parsed.data;
    if (data.es_principal) {
      await supabase
        .from('fiscal_representantes')
        .update({ es_principal: false })
        .eq('entidad_id', data.entidad_id);
    }
    const payload = {
      entidad_id: data.entidad_id,
      nombre_completo: data.nombre_completo.trim(),
      cedula: data.cedula?.trim() || null,
      cargo: data.cargo?.trim() || 'Representante Legal',
      telefono: data.telefono?.trim() || null,
      email: data.email?.trim() || null,
      es_principal: !!data.es_principal,
    };
    const id: string | undefined = 'id' in data ? (data as any).id : undefined;
    const { error } = id
      ? await supabase.from('fiscal_representantes').update(payload).eq('id', id)
      : await supabase.from('fiscal_representantes').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Representante guardado.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar el representante.' };
  }
}

export async function upsertFiscalCuentaAction(raw: Record<string, unknown>): Promise<FiscalActionResult> {
  const schema = raw.id ? FiscalCuentaBancariaUpdateSchema : FiscalCuentaBancariaSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const data = parsed.data;
    if (data.es_principal) {
      await supabase
        .from('fiscal_cuentas_bancarias')
        .update({ es_principal: false })
        .eq('entidad_id', data.entidad_id);
    }
    const payload = {
      entidad_id: data.entidad_id,
      banco: data.banco.trim(),
      tipo_cuenta: data.tipo_cuenta?.trim() || 'Corriente',
      numero_cuenta: data.numero_cuenta.trim(),
      titular: data.titular?.trim() || null,
      moneda: data.moneda?.trim() || 'USD',
      es_principal: !!data.es_principal,
    };
    const id: string | undefined = 'id' in data ? (data as any).id : undefined;
    const { error } = id
      ? await supabase.from('fiscal_cuentas_bancarias').update(payload).eq('id', id)
      : await supabase.from('fiscal_cuentas_bancarias').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Cuenta guardada.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar la cuenta.' };
  }
}

export async function upsertFiscalTextoAction(raw: Record<string, unknown>): Promise<FiscalActionResult> {
  const schema = raw.id ? FiscalTextoLegalUpdateSchema : FiscalTextoLegalSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const data = parsed.data;
    const slug = data.slug.trim().toLowerCase().replace(/\s+/g, '_');
    const payload = {
      slug,
      titulo: data.titulo.trim(),
      categoria: data.categoria,
      contenido: data.contenido,
      activo: true,
    };
    const id: string | undefined = 'id' in data ? (data as any).id : undefined;
    const { error } = id
      ? await supabase.from('fiscal_textos_legales').update(payload).eq('id', id)
      : await supabase.from('fiscal_textos_legales').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Texto legal guardado.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar el texto.' };
  }
}

export async function upsertFiscalParametroAction(raw: Record<string, unknown>): Promise<FiscalActionResult> {
  const schema = raw.id ? FiscalParametroUpdateSchema : FiscalParametroSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const data = parsed.data;
    const clave = data.clave.trim().toLowerCase().replace(/\s+/g, '_');
    const payload = {
      clave,
      etiqueta: data.etiqueta.trim(),
      valor: data.valor,
      grupo: data.grupo,
    };
    const id: string | undefined = 'id' in data ? (data as any).id : undefined;
    const { error } = id
      ? await supabase.from('fiscal_parametros').update(payload).eq('id', id)
      : await supabase.from('fiscal_parametros').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Parámetro guardado.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar el parámetro.' };
  }
}

export async function deleteFiscalEntidadAction(id: string): Promise<FiscalActionResult> {
  const parsed = z.string().uuid('ID inválido').safeParse(id);
  if (!parsed.success) return { ok: false, message: 'ID de entidad inválido' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('fiscal_entidades').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateAll();
  return { ok: true, message: 'Entidad eliminada.' };
}

export async function deleteFiscalTextoAction(id: string): Promise<FiscalActionResult> {
  const parsed = z.string().uuid('ID inválido').safeParse(id);
  if (!parsed.success) return { ok: false, message: 'ID de texto inválido' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('fiscal_textos_legales').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateAll();
  return { ok: true, message: 'Texto eliminado.' };
}

export async function loadFiscalTextosLegales(): Promise<FiscalTextoLegal[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('fiscal_textos_legales')
    .select('*')
    .order('categoria')
    .order('titulo');
  return (data || []) as FiscalTextoLegal[];
}

export async function loadFiscalParametros(): Promise<FiscalParametro[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from('fiscal_parametros').select('*').order('grupo').order('etiqueta');
  return (data || []) as FiscalParametro[];
}

export async function loadFiscalEntidadesCompletas(): Promise<FiscalEntidadCompleta[]> {
  const supabase = await createServerClient();
  const { data: entidades } = await supabase
    .from('fiscal_entidades')
    .select('*')
    .eq('activo', true)
    .order('es_emisor_principal', { ascending: false })
    .order('nombre_comercial');

  if (!entidades?.length) return [];

  const ids = entidades.map((e) => e.id);
  const [{ data: reps }, { data: cuentas }] = await Promise.all([
    supabase.from('fiscal_representantes').select('*').in('entidad_id', ids),
    supabase.from('fiscal_cuentas_bancarias').select('*').in('entidad_id', ids),
  ]);

  return (entidades as FiscalEntidad[]).map((e) => ({
    ...e,
    representantes: ((reps || []) as FiscalRepresentante[]).filter((r) => r.entidad_id === e.id),
    cuentas: ((cuentas || []) as FiscalCuentaBancaria[]).filter((c) => c.entidad_id === e.id),
  }));
}
