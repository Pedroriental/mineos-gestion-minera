import { createServerClient } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  type CompensacionEmpresa,
  DEFAULT_EMPRESAS_INVERSORAS,
} from '@/lib/compensacion-gastos';
import {
  GASTOS_RESUMEN_CATEGORIAS,
  buildGastosResumenSummary,
  buildNominaSemanasDateFilter,
  resolveGastosResumenPeriod,
  type GastosResumenGastoRow,
  type GastosResumenNominaRow,
} from '@/lib/gastos-resumen';
import { applyNominaSemanasDateFilter } from '@/lib/nomina/nomina-read-model.server';
import GastosResumenClient from './GastosResumenClient';

type SearchParams = Promise<{ mes?: string; dia?: string }>;

export default async function GastosResumenPage({ searchParams }: { searchParams: SearchParams }) {
  const { mes, dia } = await searchParams;
  const period = resolveGastosResumenPeriod(mes, dia);
  const supabase = await createServerClient();
  const db = getSupabaseAdmin() ?? supabase;

  const { data: categorias } = await db
    .from('categorias_gasto')
    .select('id, nombre')
    .in('nombre', [GASTOS_RESUMEN_CATEGORIAS.MINA, GASTOS_RESUMEN_CATEGORIAS.MOLINO]);

  const catIds = (categorias ?? []).map((c) => c.id);

  const gastosQuery =
    catIds.length > 0
      ? db
          .from('gastos')
          .select('id, fecha, monto, categoria_id, categorias_gasto(nombre)')
          .in('categoria_id', catIds)
          .gte('fecha', period.desde)
          .lte('fecha', period.hasta)
          .order('fecha', { ascending: true })
      : Promise.resolve({ data: [] as GastosResumenGastoRow[], error: null });

  const nominaFilter = buildNominaSemanasDateFilter(period);
  let nominaQuery = db
    .from('nomina_semanas')
    .select('id, semana_inicio, semana_fin, area, total_pagado, total_trabajadores, periodo_id');

  nominaQuery = applyNominaSemanasDateFilter(nominaQuery, nominaFilter);
  nominaQuery = nominaQuery.order('semana_inicio', { ascending: true });

  const empresasQuery = db
    .from('empresas_inversoras')
    .select('id, nombre, nombre_corto, porcentaje_participacion, color')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  const [gastosRes, nominaRes, empresasRes] = await Promise.all([
    gastosQuery,
    nominaQuery,
    empresasQuery,
  ]);

  const empresasInversoras: CompensacionEmpresa[] = (empresasRes.data && empresasRes.data.length > 0)
    ? empresasRes.data.map((e: any) => ({
        id: e.id,
        nombre: e.nombre,
        nombre_corto: e.nombre_corto,
        porcentaje: Number(e.porcentaje_participacion),
        color: e.color ?? '#DAA520',
      }))
    : DEFAULT_EMPRESAS_INVERSORAS;

  const summary = buildGastosResumenSummary(
    (gastosRes.data as GastosResumenGastoRow[]) ?? [],
    (nominaRes.data as GastosResumenNominaRow[]) ?? [],
    period,
  );

  return <GastosResumenClient summary={summary} initialEmpresas={empresasInversoras} />;
}
