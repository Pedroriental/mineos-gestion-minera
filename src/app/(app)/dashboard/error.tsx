'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard] Error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-8" role="alert">
      <div className="text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-red-600">
          Error al cargar el Command Center
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Ocurrió un error inesperado. Puedes intentar recargar o volver al dashboard.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="btn-primary text-sm"
          >
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="btn-secondary text-sm"
          >
            Recargar página
          </a>
        </div>
      </div>
    </div>
  );
}
