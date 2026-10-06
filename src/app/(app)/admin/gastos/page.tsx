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
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveRegistradoPorLabels } from '@/lib/resolve-registrado-por';
import GastosClient from './GastosClient';
import type { Gasto, CategoriaGasto, EmpresaInversora } from '@/lib/types';
import { DEFAULT_EMPRESAS_INVERSORAS } from '@/lib/compensacion-gastos';
import { getAgosto2026GastosParaTable } from '@/lib/data/agosto-2026-gastos';
import { getJulio2026GastosParaTable } from '@/lib/data/julio-2026-gastos';

export default async function GastosPage() {
  const supabase = await createServerClient();
  const db = getSupabaseAdmin() ?? supabase;

  // Fetch en paralelo — queries en el servidor
  const [gastosRes, catsRes, conceptosRes, empresasRes] = await Promise.all([
    db
      .from('gastos')
      .select(
        '*, categorias_gasto(nombre, tipo), gastos_empresas(empresa_id, monto_pagado, porcentaje, empresas_inversoras(id, nombre, nombre_corto, color))',
      )
      .order('fecha', { ascending: false })
      .limit(500),                 // límite alto — TanStack pagina en cliente
    db
      .from('categorias_gasto')
      .select('*')
      .eq('activo', true)
      .order('nombre'),
    db
      .from('gasto_conceptos')
      .select('*, categorias_gasto(id, nombre)')
      .eq('activo', true)
      .order('descripcion'),
    db
      .from('empresas_inversoras')
      .select('*')
      .eq('activo', true)
      .order('nombre'),
  ]);

  let data: Gasto[] = (gastosRes.data as Gasto[]) ?? [];

  // Si la BD no tiene gastos de Agosto 2026, hidratar los consolidados de Agosto ($82.477,75)
  if (!data.some((g) => g.fecha?.startsWith('2026-08'))) {
    data = [...data, ...getAgosto2026GastosParaTable()];
  }

  // Si la BD no tiene gastos de Julio 2026, hidratar los consolidados de Julio ($97.600,33)
  if (!data.some((g) => g.fecha?.startsWith('2026-07'))) {
    data = [...data, ...getJulio2026GastosParaTable()];
  }

  // Ordenar descendente por fecha
  data.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const categorias: CategoriaGasto[] = (catsRes.data as CategoriaGasto[]) ?? [];
  const baseCategoriasNombres = new Set(categorias.map((c) => c.nombre.toLowerCase()));
  const missingCats = [
    'Voladuras (Exp y Barre)',
    'Operaciones de Mina',
    'Comida en Mina',
    'Nómina en Mina',
  ].filter((n) => !baseCategoriasNombres.has(n.toLowerCase()));

  for (const n of missingCats) {
    categorias.push({
      id: `cat-${n.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      nombre: n,
      tipo: 'general',
      activo: true,
    });
  }

  const conceptos: any[] = (conceptosRes.data as any[]) ?? [];
  const empresasInversoras: EmpresaInversora[] =
    empresasRes.data && empresasRes.data.length > 0
      ? (empresasRes.data as EmpresaInversora[])
      : (DEFAULT_EMPRESAS_INVERSORAS.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          nombre_corto: e.nombre_corto,
          porcentaje_participacion: e.porcentaje,
          color: e.color,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })) as EmpresaInversora[]);

  const registradoPorLabels = await resolveRegistradoPorLabels(
    data.map((g) => g.registrado_por),
  );

  return (
    <GastosClient
      data={data}
      categorias={categorias}
      registradoPorLabels={registradoPorLabels}
      conceptos={conceptos}
      empresasInversoras={empresasInversoras}
    />
  );
}

