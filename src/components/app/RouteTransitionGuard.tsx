'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Limpieza global al cambiar de ruta: scroll del body y estado del shell.
 */
export function RouteTransitionGuard() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
  }, [pathname]);

  return null;
}
