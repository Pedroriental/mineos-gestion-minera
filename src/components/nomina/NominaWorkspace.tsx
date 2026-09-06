'use client';

import dynamic from 'next/dynamic';
import React, { Component, type ReactNode } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { NominaClientProps } from '@/components/nomina/NominaClient';

class NominaErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[NominaWorkspace] Caught client render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[70vh] w-full flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-neutral-900/90 p-6 shadow-2xl backdrop-blur-sm">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-3" />
            <h2 className="text-lg font-bold text-white mb-2">Error al renderizar nómina</h2>
            <p className="text-xs text-neutral-400 mb-4">
              Ocurrió un problema en la vista interactiva. Puedes recargar la nómina para restablecer el estado.
            </p>
            {this.state.error?.message && (
              <div className="mb-4 rounded-lg bg-black/50 p-3 text-left font-mono text-[11px] text-red-300 overflow-auto max-h-32 whitespace-pre-wrap">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  try {
                    if (typeof window !== 'undefined') {
                      window.history.replaceState(null, '', window.location.pathname);
                    }
                  } catch {}
                  this.setState({ hasError: false, error: null });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Restablecer vista
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Recargar página
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                      const key = localStorage.key(i);
                      if (key && (key.startsWith('mineos_manual_') || key.startsWith('mineos_novedad_'))) {
                        localStorage.removeItem(key);
                      }
                    }
                  } catch {}
                  window.location.reload();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
                title="Borrar borradores locales corruptos y recargar"
              >
                Limpiar borradores y recargar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const DynamicNominaClient = dynamic(
  () => import('@/components/nomina/NominaClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <span className="text-sm font-medium text-neutral-400">Cargando nómina...</span>
      </div>
    ),
  },
);

export default function NominaWorkspace(props: NominaClientProps) {
  return (
    <NominaErrorBoundary>
      <DynamicNominaClient {...props} />
    </NominaErrorBoundary>
  );
}
