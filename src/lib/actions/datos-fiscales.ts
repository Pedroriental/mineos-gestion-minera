'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
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

export async function upsertFiscalEntidadAction(raw: {
  id?: string;
  nombre_comercial: string;
  razon_social: string;
  rif: string;
  direccion_fiscal: string;
  direccion_operativa?: string;
  ciudad?: string;
  estado_region?: string;
  codigo_postal?: string;
  pais?: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  actividad_economica?: string;
  es_emisor_principal?: boolean;
  notas?: string;
}): Promise<FiscalActionResult> {
  try {
    if (!raw.nombre_comercial.trim() || !raw.razon_social.trim() || !raw.rif.trim() || !raw.direccion_fiscal.trim()) {
      return { ok: false, message: 'Razón social, RIF y dirección fiscal son obligatorios.' };
    }

    const supabase = await createServerClient();
    const payload = {
      nombre_comercial: raw.nombre_comercial.trim(),
      razon_social: raw.razon_social.trim(),
      rif: raw.rif.trim(),
      direccion_fiscal: raw.direccion_fiscal.trim(),
      direccion_operativa: raw.direccion_operativa?.trim() || null,
      ciudad: raw.ciudad?.trim() || null,
      estado_region: raw.estado_region?.trim() || null,
      codigo_postal: raw.codigo_postal?.trim() || null,
      pais: raw.pais?.trim() || 'Venezuela',
      telefono: raw.telefono?.trim() || null,
      email: raw.email?.trim() || null,
      sitio_web: raw.sitio_web?.trim() || null,
      actividad_economica: raw.actividad_economica?.trim() || null,
      es_emisor_principal: !!raw.es_emisor_principal,
      notas: raw.notas?.trim() || null,
      activo: true,
    };

    if (payload.es_emisor_principal) {
      await clearEmisorPrincipal(supabase, raw.id);
    }

    const { error } = raw.id
      ? await supabase.from('fiscal_entidades').update(payload).eq('id', raw.id)
      : await supabase.from('fiscal_entidades').insert(payload);

    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: raw.id ? 'Entidad actualizada.' : 'Entidad registrada.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar la entidad.' };
  }
}

export async function upsertFiscalRepresentanteAction(raw: {
  id?: string;
  entidad_id: string;
  nombre_completo: string;
  cedula?: string;
  cargo?: string;
  telefono?: string;
  email?: string;
  es_principal?: boolean;
}): Promise<FiscalActionResult> {
  try {
    const supabase = await createServerClient();
    if (raw.es_principal) {
      await supabase
        .from('fiscal_representantes')
        .update({ es_principal: false })
        .eq('entidad_id', raw.entidad_id);
    }
    const payload = {
      entidad_id: raw.entidad_id,
      nombre_completo: raw.nombre_completo.trim(),
      cedula: raw.cedula?.trim() || null,
      cargo: raw.cargo?.trim() || 'Representante Legal',
      telefono: raw.telefono?.trim() || null,
      email: raw.email?.trim() || null,
      es_principal: !!raw.es_principal,
    };
    const { error } = raw.id
      ? await supabase.from('fiscal_representantes').update(payload).eq('id', raw.id)
      : await supabase.from('fiscal_representantes').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Representante guardado.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar el representante.' };
  }
}

export async function upsertFiscalCuentaAction(raw: {
  id?: string;
  entidad_id: string;
  banco: string;
  tipo_cuenta?: string;
  numero_cuenta: string;
  titular?: string;
  moneda?: string;
  es_principal?: boolean;
}): Promise<FiscalActionResult> {
  try {
    const supabase = await createServerClient();
    if (raw.es_principal) {
      await supabase
        .from('fiscal_cuentas_bancarias')
        .update({ es_principal: false })
        .eq('entidad_id', raw.entidad_id);
    }
    const payload = {
      entidad_id: raw.entidad_id,
      banco: raw.banco.trim(),
      tipo_cuenta: raw.tipo_cuenta?.trim() || 'Corriente',
      numero_cuenta: raw.numero_cuenta.trim(),
      titular: raw.titular?.trim() || null,
      moneda: raw.moneda?.trim() || 'USD',
      es_principal: !!raw.es_principal,
    };
    const { error } = raw.id
      ? await supabase.from('fiscal_cuentas_bancarias').update(payload).eq('id', raw.id)
      : await supabase.from('fiscal_cuentas_bancarias').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Cuenta guardada.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar la cuenta.' };
  }
}

export async function upsertFiscalTextoAction(raw: {
  id?: string;
  slug: string;
  titulo: string;
  categoria: FiscalTextoLegal['categoria'];
  contenido: string;
}): Promise<FiscalActionResult> {
  try {
    const supabase = await createServerClient();
    const slug = raw.slug.trim().toLowerCase().replace(/\s+/g, '_');
    const payload = {
      slug,
      titulo: raw.titulo.trim(),
      categoria: raw.categoria,
      contenido: raw.contenido,
      activo: true,
    };
    const { error } = raw.id
      ? await supabase.from('fiscal_textos_legales').update(payload).eq('id', raw.id)
      : await supabase.from('fiscal_textos_legales').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Texto legal guardado.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar el texto.' };
  }
}

export async function upsertFiscalParametroAction(raw: {
  id?: string;
  clave: string;
  etiqueta: string;
  valor: string;
  grupo: FiscalParametro['grupo'];
}): Promise<FiscalActionResult> {
  try {
    const supabase = await createServerClient();
    const clave = raw.clave.trim().toLowerCase().replace(/\s+/g, '_');
    const payload = {
      clave,
      etiqueta: raw.etiqueta.trim(),
      valor: raw.valor,
      grupo: raw.grupo,
    };
    const { error } = raw.id
      ? await supabase.from('fiscal_parametros').update(payload).eq('id', raw.id)
      : await supabase.from('fiscal_parametros').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Parámetro guardado.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar el parámetro.' };
  }
}

export async function deleteFiscalEntidadAction(id: string): Promise<FiscalActionResult> {
  const supabase = await createServerClient();
  const { error } = await supabase.from('fiscal_entidades').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateAll();
  return { ok: true, message: 'Entidad eliminada.' };
}

export async function deleteFiscalTextoAction(id: string): Promise<FiscalActionResult> {
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
