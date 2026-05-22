'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Ejecuta `onClose` cuando el usuario navega a otra ruta (no en el montaje inicial).
 * Útil para cerrar modales, popovers y limpiar estado local al cambiar de sección.
 */
export function useCloseOnRouteChange(onClose: () => void) {
  const pathname = usePathname();
  const isFirst = useRef(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    onCloseRef.current();
  }, [pathname]);
}
