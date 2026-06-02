'use server';

import { createServerClient } from '@/lib/supabase-server';
import { buildDashboardAlerts, DashboardAlert } from '@/lib/dashboard-alerts';

export async function getSystemAlerts(): Promise<DashboardAlert[]> {
  const supabase = await createServerClient();

  // Obtenemos solo la data necesaria para las alertas
  // Voladuras (últimos 30 días aprox, o sin limite estricto para novedades recientes)
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  const from = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
  const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [
    inventarioRes,
    nominaSemanasRes,
    personalAreasRes,
    valesPendientesRes,
    volRes,
  ] = await Promise.all([
    supabase
      .from('inventario_items')
      .select('id, nombre, stock_actual, stock_minimo')
      .eq('activo', true),
    supabase.from('nomina_semanas').select('area, semana_inicio'),
    supabase.from('personal').select('area').eq('activo', true).in('area', ['planta', 'mina', 'administracion']),
    supabase
      .from('nomina_vales')
      .select('id, monto, personal:personal_id(area)')
      .eq('estado', 'PENDIENTE'),
    supabase
      .from('reportes_voladuras')
      .select('id, mina, fecha, sin_novedad')
      .gte('fecha', from)
      .lte('fecha', to)
      .eq('sin_novedad', false)
      .order('fecha', { ascending: false })
      .limit(10),
  ]);

  const personalCountByArea: Record<string, number> = {};
  for (const p of personalAreasRes.data ?? []) {
    const area = String(p.area ?? '');
    if (!area) continue;
    personalCountByArea[area] = (personalCountByArea[area] ?? 0) + 1;
  }

  const alerts = buildDashboardAlerts({
    inventario: inventarioRes.data ?? [],
    voladuras: volRes.data ?? [],
    nominaSemanas: nominaSemanasRes.data ?? [],
    personalCountByArea,
    valesPendientes: (valesPendientesRes.data ?? []).map((v: any) => ({
      id: v.id,
      monto: v.monto,
      personal: Array.isArray(v.personal) ? v.personal[0] : v.personal,
    })),
  });

  return alerts;
}
