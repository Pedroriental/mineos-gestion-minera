'use client';

import { Eye, Download, Share2, Loader2 } from 'lucide-react';

type Props = {
  plantillaNombre: string;
  hasData: boolean;
  loadingPreview?: boolean;
  loadingDownload?: boolean;
  loadingShare?: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onShare?: () => void;
  canShare: boolean;
  /** 'inline' = botones inline, 'toolbar' = toolbar compacto */
  layout?: 'inline' | 'toolbar';
};

export function NominaPlantillaExportActions({
  plantillaNombre,
  hasData,
  loadingPreview = false,
  loadingDownload = false,
  loadingShare = false,
  onPreview,
  onDownload,
  onShare,
  canShare,
  layout = 'inline',
}: Props) {
  const disabled = !hasData;
  const compact = layout === 'toolbar';

  const baseBtn =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const previewBtn = `${baseBtn} border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`;
  const downloadBtn = `${baseBtn} border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700`;
  const shareBtn = `${baseBtn} border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20`;

  return (
    <div
      className={
        compact
          ? 'flex items-center gap-1.5'
          : 'flex flex-wrap items-center gap-2'
      }
      role="group"
      aria-label={`Acciones PDF — ${plantillaNombre}`}
    >
      <button
        type="button"
        onClick={onPreview}
        disabled={disabled || loadingPreview}
        className={previewBtn}
        title="Ver PDF en modal"
      >
        {loadingPreview ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        {compact ? null : 'Ver PDF'}
      </button>

      <button
        type="button"
        onClick={onDownload}
        disabled={disabled || loadingDownload}
        className={downloadBtn}
        title="Descargar PDF"
      >
        {loadingDownload ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {compact ? null : 'Descargar PDF'}
      </button>

      {canShare && onShare && (
        <button
          type="button"
          onClick={onShare}
          disabled={disabled || loadingShare}
          className={shareBtn}
          title="Compartir PDF"
        >
          {loadingShare ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          {compact ? null : 'Compartir'}
        </button>
      )}
    </div>
  );
}
