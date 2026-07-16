/**
 * Gastos — Server Component (async)
 *
 * Arquitectura:
 *   page.tsx (Server)   → fetches data server-side
 *                       → pasa props al Client Component
 *   GastosClient.tsx    → TanStack Table + modal + Server Actions
 *
 * Cuando un Server Action llama revalidatePath('/admin/gastos'),
 * Next.js re-ejecuta este Server Component y envía el nuevo
 * RSC payload al cliente — sin recarga, sin useEffect, sin loadData.
 */

import { createServerClient } from '@/lib/supabase-server';
import { resolveRegistradoPorLabels } from '@/lib/resolve-registrado-por';
import GastosClient from './GastosClient';
import type { Gasto, CategoriaGasto } from '@/lib/types';

export default async function GastosPage() {
  const supabase = await createServerClient();

  // Fetch en paralelo — queries en el servidor
  const [gastosRes, catsRes, conceptosRes] = await Promise.all([
    supabase
      .from('gastos')
      .select(
        '*, categorias_gasto(nombre, tipo), gastos_empresas(empresa_id, monto_pagado, porcentaje, empresas_inversoras(id, nombre, nombre_corto, color))',
      )
      .order('fecha', { ascending: false })
      .limit(500),                 // límite alto — TanStack pagina en cliente
    supabase
      .from('categorias_gasto')
      .select('*')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('gasto_conceptos')
      .select('*, categorias_gasto(id, nombre)')
      .eq('activo', true)
      .order('descripcion'),
  ]);

  const data:       Gasto[]         = (gastosRes.data as Gasto[])        ?? [];
  const categorias: CategoriaGasto[] = (catsRes.data  as CategoriaGasto[]) ?? [];
  const conceptos:  any[]           = (conceptosRes.data as any[])       ?? [];

  const registradoPorLabels = await resolveRegistradoPorLabels(
    data.map(g => g.registrado_por),
  );

  return (
    <GastosClient
      data={data}
      categorias={categorias}
      registradoPorLabels={registradoPorLabels}
      conceptos={conceptos}
    />
  );
}
