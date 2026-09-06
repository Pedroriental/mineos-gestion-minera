import {
  getInstanciaActivaData,
  listRotacionPlantillasWithMetaData,
} from '@/lib/rotacion-plantillas/rotacion-data.server';
import { serializeInstanciaSnapshot } from '@/lib/rotacion-plantillas/instancia-serialize';

export async function loadNominaRotacionContext(area: string) {
  try {
    const [instanciaActiva, plantillasResult] = await Promise.all([
      getInstanciaActivaData(area).catch((err) => {
        console.error('[loadNominaRotacionContext] getInstanciaActivaData error:', err);
        return null;
      }),
      listRotacionPlantillasWithMetaData(area).catch((err) => {
        console.error('[loadNominaRotacionContext] listRotacionPlantillasWithMetaData error:', err);
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
