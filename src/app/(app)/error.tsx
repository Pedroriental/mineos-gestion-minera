'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App] Error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-8" role="alert">
      <div className="text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-red-600">
          Error inesperado
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Ocurrió un error al cargar esta sección. Puedes intentar recargar o
          volver al inicio.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
