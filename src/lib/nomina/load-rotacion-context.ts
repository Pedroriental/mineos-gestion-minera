import { getInstanciaActivaAction } from '@/lib/actions/rotacion-instancias';
import { listRotacionPlantillasWithMetaAction } from '@/lib/actions/rotacion-plantillas';
import { serializeInstanciaSnapshot } from '@/lib/rotacion-plantillas/instancia-serialize';

export async function loadNominaRotacionContext(area: string) {
  try {
    const [instanciaActiva, plantillasResult] = await Promise.all([
      getInstanciaActivaAction(area).catch((err) => {
        console.error('[loadNominaRotacionContext] getInstanciaActivaAction error:', err);
        return null;
      }),
      listRotacionPlantillasWithMetaAction(area).catch((err) => {
        console.error('[loadNominaRotacionContext] listRotacionPlantillasWithMetaAction error:', err);
        return { plantillas: [], migrationRequired: false };
      }),
    ]);

    return {
      instanciaActiva: serializeInstanciaSnapshot(instanciaActiva),
      rotacionPlantillas: plantillasResult?.plantillas ?? [],
      rotacionMigrationRequired: plantillasResult?.migrationRequired ?? false,
    };
  } catch (err) {
    console.error('[loadNominaRotacionContext] fatal error:', err);
    return {
      instanciaActiva: null,
      rotacionPlantillas: [],
      rotacionMigrationRequired: false,
    };
  }
}
