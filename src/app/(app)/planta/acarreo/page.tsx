import { createServerClient } from '@/lib/supabase-server';
import AcarreoClient from './AcarreoClient';
import type { ReporteAcarreo } from '@/lib/types';

export default async function AcarreoPage() {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('reportes_acarreo')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  const reportes: ReporteAcarreo[] = (data as ReporteAcarreo[]) ?? [];

  return <AcarreoClient data={reportes} />;
}
