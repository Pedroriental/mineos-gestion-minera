import { createServerClient } from '@/lib/supabase-server';
import ProduccionClient from './ProduccionClient';
import type { ReporteProduccion } from '@/lib/types';

export default async function ProduccionPage() {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('reportes_produccion')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  const reportes: ReporteProduccion[] = (data as ReporteProduccion[]) ?? [];

  return <ProduccionClient data={reportes} />;
}
