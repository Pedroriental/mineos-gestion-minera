import { createServerClient } from '@/lib/supabase-server';
import NominaClient from '@/components/nomina/NominaClient';
import { syncRotacionEstadosLaboralesAction } from '@/lib/actions/rotacion-sync';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import { getWeekStart } from '@/lib/rotacion-personal';
import type { Personal, NominaSemana } from '@/lib/types';

export const metadata = {
  title: 'Nómina Molino - MineOS',
};

export default async function PlantaNominaPage() {
  const supabase = await createServerClient();
  const area = 'planta';

  await syncRotacionEstadosLaboralesAction(getWeekStart());

  // Obtener trabajadores activos de esta área
  const { data: personalRows } = await supabase
    .from('personal')
    .select('*')
    .eq('area', area)
    .order('nombre_completo');

  const personal = ((personalRows as Personal[]) || []).filter((p) =>
    isPersonalVisibleInNomina(p, area),
  );

  const { data: masterRows } = await supabase
    .from('personal')
    .select('*')
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
      data={personal}
      masterCatalog={(masterRows as Personal[]) || []}
      semanas={(semanas as NominaSemana[]) || []}
    />
  );
}
