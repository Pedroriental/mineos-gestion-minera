'use client';

import { useEffect } from 'react';

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return msg.includes('ChunkLoadError') || msg.includes('Loading chunk') || msg.includes('Failed to load chunk');
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
  window.location.reload();
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    console.error('[App] Error boundary caught:', error);
    if (!chunkError) return;
    const key = 'mineos-chunk-reload-v1';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void clearAppCachesAndReload();
  }, [error, chunkError]);

  return (
    <div className="flex h-full items-center justify-center p-8" role="alert">
      <div className="text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-red-600">
          {chunkError ? 'Actualización pendiente' : 'Error inesperado'}
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          {chunkError
            ? 'La aplicación se actualizó en el servidor. Recarga para obtener la versión nueva.'
            : 'Ocurrió un error al cargar esta sección. Puedes intentar recargar o volver al inicio.'}
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => (chunkError ? void clearAppCachesAndReload() : reset())}
            className="btn-primary text-sm"
          >
            {chunkError ? 'Actualizar ahora' : 'Reintentar'}
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
