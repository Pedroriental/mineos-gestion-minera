import { createServerClient } from '@/lib/supabase-server';
import NominaWorkspace from '@/components/nomina/NominaWorkspace';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import { loadNominaRotacionContext } from '@/lib/nomina/load-rotacion-context';
import type { PerfilCompensacion, Personal, NominaSemana } from '@/lib/types';

export const metadata = {
  title: 'Nómina Mina - MineOS',
};

export const dynamic = 'force-dynamic';

export default async function MinaNominaPage() {
  const supabase = await createServerClient();
  const area = 'mina';

  // Obtener trabajadores activos de esta área
  const { data: personalRows } = await supabase
    .from('personal')
    .select('*')
    .eq('area', area)
    .order('nombre_completo')
    .limit(500);

  const personal = ((personalRows as Personal[]) || []).filter((p) =>
    isPersonalVisibleInNomina(p, area),
  );

  const [{ data: masterRows }, { data: perfiles }] = await Promise.all([
    supabase.from('personal').select('*').order('nombre_completo').limit(700),
    supabase.from('perfiles_compensacion').select('*').eq('activo', true).order('nombre'),
  ]);

  // Obtener historial de semanas procesadas
  const { data: semanas } = await supabase
    .from('nomina_semanas')
    .select('*')
    .eq('area', area)
    .order('semana_inicio', { ascending: false })
    .limit(200);

  const { instanciaActiva, rotacionPlantillas, rotacionMigrationRequired } =
    await loadNominaRotacionContext(area);

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
