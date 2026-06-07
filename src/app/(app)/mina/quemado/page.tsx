import { createServerClient } from '@/lib/supabase-server';
import QuemadoClient from './QuemadoClient';
import type { ReporteQuemado } from '@/lib/types';
import { hasGlobalDateRange, type GlobalDateSearchParams } from '@/lib/global-date-range';

export default async function QuemadoPage(props: {
  searchParams: Promise<GlobalDateSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const hasParams = hasGlobalDateRange(searchParams);
  const supabase = await createServerClient();

  let query = supabase.from('reportes_quemado').select('*');

  if (hasParams) {
    query = query
      .gte('fecha', searchParams.desde!)
      .lte('fecha', searchParams.hasta!)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    query = query
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
  }

  const { data } = await query;

  const reportes: ReporteQuemado[] = (data as ReporteQuemado[]) ?? [];

  return <QuemadoClient data={reportes} />;
}
