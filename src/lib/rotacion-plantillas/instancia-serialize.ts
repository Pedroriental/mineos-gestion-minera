import type { InstanciaActivaSnapshot } from '@/lib/rotacion-plantillas/projection';

export type InstanciaActivaSerialized = Omit<InstanciaActivaSnapshot, 'personalCuadrillaMap'> & {
  personalCuadrillaMap: Record<string, string>;
};

export function serializeInstanciaSnapshot(
  snapshot: InstanciaActivaSnapshot | null,
): InstanciaActivaSerialized | null {
  if (!snapshot) return null;
  return {
    ...snapshot,
    personalCuadrillaMap: Object.fromEntries(snapshot.personalCuadrillaMap.entries()),
  };
}

export function deserializeInstanciaSnapshot(
  serialized: InstanciaActivaSerialized | null,
): InstanciaActivaSnapshot | null {
  if (!serialized) return null;
  return {
    ...serialized,
    personalCuadrillaMap: new Map(Object.entries(serialized.personalCuadrillaMap)),
  };
}
