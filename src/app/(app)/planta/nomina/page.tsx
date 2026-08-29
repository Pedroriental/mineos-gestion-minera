import { createServerClient } from '@/lib/supabase-server';
import NominaWorkspace from '@/components/nomina/NominaWorkspace';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import { loadNominaRotacionContext } from '@/lib/nomina/load-rotacion-context';
import type { PerfilCompensacion, Personal, NominaSemana } from '@/lib/types';

export const metadata = {
  title: 'Nómina Molino - MineOS',
};

export const dynamic = 'force-dynamic';

export default async function PlantaNominaPage() {
  const supabase = await createServerClient();
  const area = 'planta';

  const [
    { data: personalRows },
    { data: masterRows },
    { data: perfiles },
    { data: semanas },
    rotacionCtx,
  ] = await Promise.all([
    supabase
      .from('personal')
      .select('*')
      .eq('area', area)
      .order('nombre_completo')
      .limit(500),
    supabase.from('personal').select('*').order('nombre_completo').limit(700),
    supabase.from('perfiles_compensacion').select('*').eq('activo', true).order('nombre'),
    supabase
      .from('nomina_semanas')
      .select('*')
      .eq('area', area)
      .order('semana_inicio', { ascending: false })
      .limit(200),
    loadNominaRotacionContext(area),
  ]);

  const personal = ((personalRows as Personal[]) || []).filter((p) =>
    isPersonalVisibleInNomina(p, area),
  );

  const { instanciaActiva, rotacionPlantillas, rotacionMigrationRequired } = rotacionCtx;

  return (
    <NominaWorkspace
      area={area}
      data={personal}
      masterCatalog={(masterRows as Personal[]) || []}
      perfilesCompensacion={(perfiles as PerfilCompensacion[]) || []}
      semanas={(semanas as NominaSemana[]) || []}
      instanciaActiva={instanciaActiva}
      rotacionPlantillas={rotacionPlantillas}
      rotacionMigrationRequired={rotacionMigrationRequired}
    />
  );
}
