import { createServerClient } from '@/lib/supabase-server';
import NominaClient from '@/components/nomina/NominaClient';
import type { Personal, NominaSemana } from '@/lib/types';

export const metadata = {
  title: 'Nómina Administrativa - MineOS',
};

export default async function AdminNominaPage() {
  const supabase = createServerClient();
  const area = 'administracion';

  // Obtener trabajadores activos de esta área
  const { data: personal } = await supabase
    .from('personal')
    .select('*')
    .eq('activo', true)
    .eq('area', area)
    .order('nombre_completo');

  // Obtener historial de semanas procesadas
  const { data: semanas } = await supabase
    .from('nomina_semanas')
    .select('*')
    .eq('area', area)
    .order('semana_inicio', { ascending: false });

  return (
    <NominaClient 
      area={area} 
      data={(personal as Personal[]) || []} 
      semanas={(semanas as NominaSemana[]) || []} 
    />
  );
}
