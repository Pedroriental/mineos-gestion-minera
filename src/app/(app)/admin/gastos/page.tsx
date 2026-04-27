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
import GastosClient from './GastosClient';
import type { Gasto, CategoriaGasto } from '@/lib/types';

export default async function GastosPage() {
  const supabase = await createServerClient();

  // Fetch en paralelo — ambas queries en el servidor
  const [gastosRes, catsRes] = await Promise.all([
    supabase
      .from('gastos')
      .select('*, categorias_gasto(nombre, tipo)')
      .order('fecha', { ascending: false })
      .limit(500),                 // límite alto — TanStack pagina en cliente
    supabase
      .from('categorias_gasto')
      .select('*')
      .eq('activo', true)
      .order('nombre'),
  ]);

  const data:       Gasto[]         = (gastosRes.data as Gasto[])        ?? [];
  const categorias: CategoriaGasto[] = (catsRes.data  as CategoriaGasto[]) ?? [];

  // Pasa la data como props — el Client Component la recibe directamente
  return <GastosClient data={data} categorias={categorias} />;
}
