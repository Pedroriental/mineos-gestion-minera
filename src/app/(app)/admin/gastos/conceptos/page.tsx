import { createServerClient } from '@/lib/supabase-server';
import ConceptosClient from './ConceptosClient';
import type { GastoConcepto, CategoriaGasto } from '@/lib/types';

export default async function ConceptosPage() {
  const supabase = await createServerClient();

  const [conceptosRes, catsRes] = await Promise.all([
    supabase
      .from('gasto_conceptos')
      .select('*, categorias_gasto(id, nombre, tipo)')
      .order('descripcion'),
    supabase
      .from('categorias_gasto')
      .select('*')
      .eq('activo', true)
      .order('nombre'),
  ]);

  const conceptos: GastoConcepto[] = (conceptosRes.data as GastoConcepto[]) ?? [];
  const categorias: CategoriaGasto[] = (catsRes.data as CategoriaGasto[]) ?? [];

  return (
    <ConceptosClient
      conceptos={conceptos}
      categorias={categorias}
    />
  );
}
