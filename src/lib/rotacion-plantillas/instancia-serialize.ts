import type { InstanciaActivaSnapshot } from '@/lib/rotacion-plantillas/projection';

export type InstanciaActivaSerialized = Omit<InstanciaActivaSnapshot, 'personalCuadrillaMap'> & {
  personalCuadrillaMap: Record<string, string>;
};

export function serializeInstanciaSnapshot(
  snapshot: InstanciaActivaSnapshot | null,
): InstanciaActivaSerialized | null {
  if (!snapshot) return null;
  let mapObj: Record<string, string> = {};
  try {
    if (snapshot.personalCuadrillaMap instanceof Map) {
      mapObj = Object.fromEntries(snapshot.personalCuadrillaMap.entries());
    } else if (snapshot.personalCuadrillaMap && typeof snapshot.personalCuadrillaMap === 'object') {
      mapObj = snapshot.personalCuadrillaMap as Record<string, string>;
    }
  } catch {
    mapObj = {};
  }
  return {
    ...snapshot,
    personalCuadrillaMap: mapObj,
  };
}

export function deserializeInstanciaSnapshot(
  serialized: InstanciaActivaSerialized | null,
): InstanciaActivaSnapshot | null {
  if (!serialized) return null;
  const mapEntries = serialized.personalCuadrillaMap
    ? Object.entries(serialized.personalCuadrillaMap)
    : [];
  return {
    ...serialized,
    personalCuadrillaMap: new Map(mapEntries),
  };
}
