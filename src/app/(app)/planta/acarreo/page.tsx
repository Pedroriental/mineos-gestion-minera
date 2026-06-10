import { createServerClient } from '@/lib/supabase-server';
import AcarreoClient from './AcarreoClient';
import type { ReporteAcarreo } from '@/lib/types';
import { hasGlobalDateRange, type GlobalDateSearchParams } from '@/lib/global-date-range';
import { normalizeReportPhotoUrls } from '@/lib/report-photo-url';

export default async function AcarreoPage(props: {
  searchParams: Promise<GlobalDateSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const hasParams = hasGlobalDateRange(searchParams);
  const supabase = await createServerClient();

  let query = supabase.from('reportes_acarreo').select('*');

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

  const reportes: ReporteAcarreo[] = ((data as ReporteAcarreo[]) ?? []).map((row) => ({
    ...row,
    fotos: normalizeReportPhotoUrls(row.fotos),
  }));

  return <AcarreoClient data={reportes} />;
}
