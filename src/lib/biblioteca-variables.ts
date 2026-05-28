import { getBibliotecaOptions, loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { createServerClient } from '@/lib/supabase-server';
import type { BibliotecaVariable } from '@/lib/types';

/** Opciones { value, label } para selects a partir de una categoría por slug. */
export async function getBibliotecaSelectOptions(categoriaSlug: string): Promise<{ value: string; label: string }[]> {
  const snapshot = await loadBibliotecaAppSnapshot();
  return getBibliotecaOptions(snapshot, categoriaSlug);
}

/** Valores de una categoría indexados por clave interna. */
export async function getBibliotecaMapByCategoria(
  categoriaSlug: string,
): Promise<Record<string, BibliotecaVariable>> {
  const supabase = await createServerClient();
  const { data: cat } = await supabase
    .from('biblioteca_categorias')
    .select('id')
    .eq('slug', categoriaSlug)
    .eq('activo', true)
    .maybeSingle();

  if (!cat?.id) return {};

  const { data: rows } = await supabase
    .from('biblioteca_variables')
    .select('*')
    .eq('categoria_id', cat.id)
    .eq('activo', true);

  const map: Record<string, BibliotecaVariable> = {};
  ((rows || []) as BibliotecaVariable[]).forEach((v) => {
    map[v.clave] = v;
  });
  return map;
}
