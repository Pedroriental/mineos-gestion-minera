'use client';

import { useEffect } from 'react';

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to load chunk')
  );
}

/**
 * Detecta errores que típicamente se producen cuando el cliente ejecuta
 * un bundle JS antiguo (anterior al último deploy). En ese caso el
 * error boundary no se puede recuperar con un "reset" de React: hay
 * que invalidar TODAS las caches (Service Worker + HTTP cache +
 * memory cache) y recargar la página desde el servidor.
 */
function isStaleBundleError(error: Error): boolean {
  const msg = error.message || '';
  // ReferenceError de variables libres sugiere que el bundle incluye
  // closures de un build anterior que ya no existen en el código actual.
  if (msg.includes('is not defined')) return true;
  // Errores de Server Action por hashes obsoletos.
  if (msg.includes('Failed to find Server Action')) return true;
  return isChunkLoadError(error);
}

async function clearAppCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    // ignore
  }
  // Forzar navegación a una URL con query param único. Esto bypassea
  // el HTTP cache del navegador (los navegadores no cachean URLs con
  // query strings que cambian) y combinado con el SW v12 (que usa
  // cache: 'reload' en navegaciones) garantiza que se cargue HTML
  // y bundles nuevos del servidor.
  const cb = `cb=${Date.now()}`;
  const url = window.location.pathname + window.location.search + (window.location.search ? '&' : '?') + cb;
  window.location.replace(url);
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  const staleBundle = isStaleBundleError(error);

  useEffect(() => {
    console.error('[App] Error boundary caught:', error);
    if (!staleBundle) return;
    const key = 'mineos-bundle-reload';
    const attempts = Number(sessionStorage.getItem(key) || '0');
    if (attempts >= 3) return;
    sessionStorage.setItem(key, String(attempts + 1));
    void clearAppCachesAndReload();
  }, [error, staleBundle]);

  return (
    <div className="flex h-full items-center justify-center p-8" role="alert">
      <div className="text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-red-600">
          {staleBundle ? 'Actualización pendiente' : 'Error inesperado'}
        </h2>
        <p className="mb-4 text-sm text-gray-400">
          {staleBundle
            ? 'La aplicación se actualizó en el servidor. Recarga para obtener la versión nueva.'
            : 'Ocurrió un error al cargar esta sección. Puedes intentar recargar o volver al inicio.'}
        </p>

        {error?.message ? (
          <div className="mx-auto mb-5 max-w-lg rounded-xl border border-red-500/25 bg-red-950/40 p-3.5 text-left text-xs font-mono text-red-200">
            <div className="flex items-center justify-between gap-2 border-b border-red-500/20 pb-1.5 mb-1.5">
              <span className="font-bold text-red-400">Detalle del error</span>
              {error.digest && <span className="text-[10px] text-zinc-400">Digest: {error.digest}</span>}
            </div>
            <p className="break-words whitespace-pre-wrap leading-relaxed">{error.message}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => (staleBundle ? void clearAppCachesAndReload() : reset())}
            className="btn-primary text-sm"
          >
            {staleBundle ? 'Actualizar ahora' : 'Reintentar'}
          </button>
          <button
            type="button"
            onClick={() => void clearAppCachesAndReload()}
            className="btn-secondary text-sm border border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
          >
            Limpiar caché y recargar
          </button>
          <a
            href="/dashboard"
            className="btn-secondary text-sm"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
