'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';
import {
  BibliotecaCategoriaSchema,
  BibliotecaCategoriaUpdateSchema,
  BibliotecaVariableSchema,
  BibliotecaVariableUpdateSchema,
  DeleteBibliotecaCategoriaSchema,
  DeleteBibliotecaVariableSchema,
} from '@/lib/validations/biblioteca';
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
  const schema = raw.id ? BibliotecaCategoriaUpdateSchema : BibliotecaCategoriaSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const slug = slugify(parsed.data.slug || parsed.data.nombre);
    const payload = {
      slug,
      nombre: parsed.data.nombre.trim(),
      descripcion: parsed.data.descripcion?.trim() || null,
      modulo: parsed.data.modulo || 'general',
      orden: parsed.data.orden ?? 0,
      activo: true,
    };
    const id = 'id' in parsed.data ? parsed.data.id : undefined;
    const { error } = id
      ? await supabase.from('biblioteca_categorias').update(payload).eq('id', id)
      : await supabase.from('biblioteca_categorias').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: id ? 'Categoría actualizada.' : 'Categoría creada.' };
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
  const schema = raw.id ? BibliotecaVariableUpdateSchema : BibliotecaVariableSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const data = parsed.data;
    const clave = slugify(data.clave || data.etiqueta);
    const payload = {
      categoria_id: data.categoria_id,
      clave,
      etiqueta: data.etiqueta.trim(),
      valor: (data.valor ?? data.etiqueta).trim(),
      unidad: data.unidad?.trim() || null,
      descripcion: data.descripcion?.trim() || null,
      orden: data.orden ?? 0,
      activo: true,
      metadata: data.metadata ?? {},
    };
    const id = 'id' in data ? data.id : undefined;
    const { error } = id
      ? await supabase.from('biblioteca_variables').update(payload).eq('id', id)
      : await supabase.from('biblioteca_variables').insert(payload);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: id ? 'Variable actualizada.' : 'Variable creada.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar la variable.' };
  }
}

export async function deleteBibliotecaCategoriaAction(id: string): Promise<BibliotecaActionResult> {
  const parsed = DeleteBibliotecaCategoriaSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, message: 'ID de categoría inválido' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('biblioteca_categorias').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateAll();
  return { ok: true, message: 'Categoría eliminada.' };
}

export async function deleteBibliotecaVariableAction(id: string): Promise<BibliotecaActionResult> {
  const parsed = DeleteBibliotecaVariableSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, message: 'ID de variable inválido' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('biblioteca_variables').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateAll();
  return { ok: true, message: 'Variable eliminada.' };
}
