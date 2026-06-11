import { getInstanciaActivaAction } from '@/lib/actions/rotacion-instancias';
import { listRotacionPlantillasWithMetaAction } from '@/lib/actions/rotacion-plantillas';
import { serializeInstanciaSnapshot } from '@/lib/rotacion-plantillas/instancia-serialize';

export async function loadNominaRotacionContext(area: string) {
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
