import { createServerClient } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import QuemadoClient from './QuemadoClient';
import type { ReporteQuemado } from '@/lib/types';
import { hasGlobalDateRange, type GlobalDateSearchParams } from '@/lib/global-date-range';

export default async function QuemadoPage(props?: {
  searchParams?: Promise<GlobalDateSearchParams>;
}) {
  const searchParams = props?.searchParams ? (await props.searchParams) ?? {} : {};
  const hasParams = hasGlobalDateRange(searchParams);
  const supabase = await createServerClient();
  const db = getSupabaseAdmin() ?? supabase;

  let query = db.from('reportes_quemado').select('*');

  if (hasParams && searchParams.desde && searchParams.hasta) {
    query = query
      .gte('fecha', searchParams.desde)
      .lte('fecha', searchParams.hasta)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    query = query
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
  }

  const { data } = await query;

  const rawReportes: ReporteQuemado[] = (data as ReporteQuemado[]) ?? [];
  const reportes = rawReportes.filter(
    (r) => r && typeof r.fecha === 'string' && r.fecha.trim().length > 0,
  );

  return <QuemadoClient data={reportes} />;
}
