import { createServerClient } from '@/lib/supabase-server';
import QuemadoClient from './QuemadoClient';
import type { ReporteQuemado } from '@/lib/types';

export default async function QuemadoPage() {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('reportes_quemado')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  const reportes: ReporteQuemado[] = (data as ReporteQuemado[]) ?? [];

  return <QuemadoClient data={reportes} />;
}
