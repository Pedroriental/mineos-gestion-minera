'use client';

import { useCallback, useRef } from 'react';

/**
 * Evita actualizar estado si el usuario ya cambió de sección mientras la petición estaba en vuelo.
 */
export function useAsyncGuard() {
  const generation = useRef(0);

  const begin = useCallback(() => {
    generation.current += 1;
    return generation.current;
  }, []);

  const isStale = useCallback((gen: number) => gen !== generation.current, []);

  return { begin, isStale };
}
