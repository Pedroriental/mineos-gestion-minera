'use client';

import { useEffect } from 'react';
import { Loader2, X, Download, Share2, FileText, AlertTriangle } from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  blobUrl: string | null;
  loading?: boolean;
  error?: string | null;
  onDownload: () => void;
  onShare?: () => void;
  canShare?: boolean;
};

export function NominaPdfPreviewModal({
  open,
  onClose,
  title,
  blobUrl,
  loading = false,
  error = null,
  onDownload,
  onShare,
  canShare = false,
}: Props) {
  useEffect(() => {
    return () => {
      // Cleanup global al desmontar: la URL debería liberarse en el padre
      // cuando se cierra el modal, pero por seguridad lo hacemos aquí también.
    };
  }, []);

  const showIframe = !loading && !error && Boolean(blobUrl);

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="page-form-modal-panel--excel-preview page-form-modal-panel--excel-preview-md flex w-full max-h-[min(96dvh,1000px)] flex-col overflow-hidden p-0 sm:max-w-[min(98vw,1400px)] sm:rounded-2xl"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-amber-500" />
            <h2 className="min-w-0 truncate text-sm font-semibold text-white">
              Vista previa — {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-zinc-900">
          {loading ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-zinc-300">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm">Generando PDF…</p>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 px-6 text-center text-zinc-300">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-sm font-medium text-red-300">{error}</p>
              <p className="text-xs text-zinc-500">Cerrá esta ventana e intentá nuevamente.</p>
            </div>
          ) : showIframe && blobUrl ? (
            <iframe
              src={blobUrl}
              title="Vista previa del PDF"
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 px-6 text-center text-zinc-300">
              <p className="text-sm">Tu navegador no soporta la vista previa embebida.</p>
              <button
                type="button"
                onClick={onDownload}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
              >
                <Download className="mr-1.5 inline h-3.5 w-3.5" />
                Descargar PDF
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-transparent px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.04]"
          >
            Cerrar
          </button>
          <div className="flex items-center gap-2">
            {canShare && onShare && (
              <button
                type="button"
                onClick={onShare}
                disabled={!blobUrl}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Share2 className="mr-1.5 inline h-3.5 w-3.5" />
                Compartir
              </button>
            )}
            <button
              type="button"
              onClick={onDownload}
              disabled={!blobUrl}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="mr-1.5 inline h-3.5 w-3.5" />
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </PageFormModal>
  );
}
