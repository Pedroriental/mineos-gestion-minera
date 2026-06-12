import { unstable_noStore as noStore } from 'next/cache';
import { getInstanciaActivaAction } from '@/lib/actions/rotacion-instancias';
import { listRotacionPlantillasWithMetaAction } from '@/lib/actions/rotacion-plantillas';
import { serializeInstanciaSnapshot } from '@/lib/rotacion-plantillas/instancia-serialize';

export async function loadNominaRotacionContext(area: string) {
  noStore();
  const [instanciaActiva, plantillasResult] = await Promise.all([
    getInstanciaActivaAction(area),
    listRotacionPlantillasWithMetaAction(area),
  ]);

  return {
    instanciaActiva: serializeInstanciaSnapshot(instanciaActiva),
    rotacionPlantillas: plantillasResult.plantillas,
    rotacionMigrationRequired: plantillasResult.migrationRequired,
  };
}
