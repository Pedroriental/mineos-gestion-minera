'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import type {
  BibliotecaCategoria,
  BibliotecaCategoriaCompleta,
  BibliotecaModulo,
  BibliotecaVariable,
} from '@/lib/types';

export type BibliotecaActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const REVALIDATE_PATHS = [
  '/plataforma/biblioteca-variables',
  '/plataforma/diccionario-variables',
] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
  revalidatePath('/', 'layout');
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function loadBibliotecaCompleta(): Promise<BibliotecaCategoriaCompleta[]> {
  const supabase = await createServerClient();
  const [{ data: categorias }, { data: variables }] = await Promise.all([
    supabase.from('biblioteca_categorias').select('*').eq('activo', true).order('orden').order('nombre'),
    supabase.from('biblioteca_variables').select('*').eq('activo', true).order('orden').order('etiqueta'),
  ]);

  const varsByCat = new Map<string, BibliotecaVariable[]>();
  ((variables || []) as BibliotecaVariable[]).forEach((v) => {
    const list = varsByCat.get(v.categoria_id) || [];
    list.push(v);
    varsByCat.set(v.categoria_id, list);
  });

  return ((categorias || []) as BibliotecaCategoria[]).map((c) => ({
    ...c,
    variables: varsByCat.get(c.id) || [],
  }));
}

export async function upsertBibliotecaCategoriaAction(raw: {
  id?: string;
  slug?: string;
  nombre: string;
  descripcion?: string;
  modulo?: BibliotecaModulo;
  orden?: number;
}): Promise<BibliotecaActionResult> {
  try {
    if (!raw.nombre.trim()) return { ok: false, message: 'El nombre de la categoría es obligatorio.' };
    const supabase = await createServerClient();
    const slug = slugify(raw.slug || raw.nombre);
    const payload = {
      slug,
      nombre: raw.nombre.trim(),
      descripcion: raw.descripcion?.trim() || null,
      modulo: raw.modulo || 'general',
      orden: raw.orden ?? 0,
      activo: true,
    };
    const { error } = raw.id
      ? await supabase.from('biblioteca_categorias').update(payload).eq('id', raw.id)
      : await supabase.from('biblioteca_categorias').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: raw.id ? 'Categoría actualizada.' : 'Categoría creada.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar la categoría.' };
  }
}

export async function upsertBibliotecaVariableAction(raw: {
  id?: string;
  categoria_id: string;
  clave?: string;
  etiqueta: string;
  valor?: string;
  unidad?: string;
  descripcion?: string;
  orden?: number;
  metadata?: Record<string, unknown>;
}): Promise<BibliotecaActionResult> {
  try {
    if (!raw.etiqueta.trim()) return { ok: false, message: 'La etiqueta es obligatoria.' };
    const supabase = await createServerClient();
    const clave = slugify(raw.clave || raw.etiqueta);
    const payload = {
      categoria_id: raw.categoria_id,
      clave,
      etiqueta: raw.etiqueta.trim(),
      valor: (raw.valor ?? raw.etiqueta).trim(),
      unidad: raw.unidad?.trim() || null,
      descripcion: raw.descripcion?.trim() || null,
      orden: raw.orden ?? 0,
      activo: true,
      metadata: raw.metadata ?? {},
    };
    const { error } = raw.id
      ? await supabase.from('biblioteca_variables').update(payload).eq('id', raw.id)
      : await supabase.from('biblioteca_variables').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: raw.id ? 'Variable actualizada.' : 'Variable creada.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar la variable.' };
  }
}

export async function deleteBibliotecaCategoriaAction(id: string): Promise<BibliotecaActionResult> {
  const supabase = await createServerClient();
  const { error } = await supabase.from('biblioteca_categorias').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateAll();
  return { ok: true, message: 'Categoría eliminada.' };
}

export async function deleteBibliotecaVariableAction(id: string): Promise<BibliotecaActionResult> {
  const supabase = await createServerClient();
  const { error } = await supabase.from('biblioteca_variables').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateAll();
  return { ok: true, message: 'Variable eliminada.' };
}
