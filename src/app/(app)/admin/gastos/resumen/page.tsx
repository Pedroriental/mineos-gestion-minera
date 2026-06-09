import { createServerClient } from '@/lib/supabase-server';
import {
  GASTOS_RESUMEN_CATEGORIAS,
  buildGastosResumenSummary,
  resolveGastosResumenPeriod,
  type GastosResumenGastoRow,
  type GastosResumenNominaRow,
} from '@/lib/gastos-resumen';
import GastosResumenClient from './GastosResumenClient';

type SearchParams = Promise<{ mes?: string; dia?: string }>;

export default async function GastosResumenPage({ searchParams }: { searchParams: SearchParams }) {
  const { mes, dia } = await searchParams;
  const period = resolveGastosResumenPeriod(mes, dia);
  const supabase = await createServerClient();

  const { data: categorias } = await supabase
    .from('categorias_gasto')
    .select('id, nombre')
    .in('nombre', [GASTOS_RESUMEN_CATEGORIAS.MINA, GASTOS_RESUMEN_CATEGORIAS.MOLINO]);

  const catIds = (categorias ?? []).map((c) => c.id);

  const gastosQuery =
    catIds.length > 0
      ? supabase
          .from('gastos')
          .select('id, fecha, monto, categoria_id, categorias_gasto(nombre)')
          .in('categoria_id', catIds)
          .gte('fecha', period.desde)
          .lte('fecha', period.hasta)
          .order('fecha', { ascending: true })
      : Promise.resolve({ data: [] as GastosResumenGastoRow[], error: null });

  const nominaQuery = supabase
    .from('nomina_semanas')
    .select('id, semana_inicio, semana_fin, area, total_pagado, total_trabajadores')
    .lte('semana_inicio', period.hasta)
    .gte('semana_fin', period.desde)
    .order('semana_inicio', { ascending: true });

  const [gastosRes, nominaRes] = await Promise.all([gastosQuery, nominaQuery]);

  const summary = buildGastosResumenSummary(
    (gastosRes.data as GastosResumenGastoRow[]) ?? [],
    (nominaRes.data as GastosResumenNominaRow[]) ?? [],
    period,
  );

  return <GastosResumenClient summary={summary} />;
}
