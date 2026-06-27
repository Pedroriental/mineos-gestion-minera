'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { NominaPdfPreviewModal } from '@/components/nomina/NominaPdfPreviewModal';
import type { Personal } from '@/lib/types';
import {
  buildTrabajadoresListadoData,
  buildTrabajadoresListadoPdfBlob,
  downloadTrabajadoresListadoPdf,
  previewTrabajadoresListadoPdf,
  shareTrabajadoresListadoPdf,
  canSharePdf,
  type ListadoData,
  type ListadoMeta,
  type TrabajadorListadoRow,
  type ShareOutcome,
} from '@/lib/nomina/trabajadores-listado-pdf';

type Props = {
  open: boolean;
  onClose: () => void;
  rows: Personal[];
  area: string;
  areaLabel: string;
};

const AREA_LABELS: Record<string, string> = {
  mina: 'Mina Belén',
  planta: 'Molinos La Fé',
  administracion: 'Administración',
  seguridad: 'Seguridad',
  transporte: 'Transporte',
};

function buildPdfRows(rows: Personal[]): TrabajadorListadoRow[] {
  return rows
    .filter((t) => t.estado_laboral === 'ACTIVO' || t.estado_laboral === 'REENGANCHADO')
    .map((t) => ({
      personalId: t.id,
      nombre_completo: t.nombre_completo,
      cedula: t.cedula,
      cargo: t.cargo || '—',
      area_detalle: t.area_detalle || null,
      cuadrilla: t.cuadrilla || null,
      esquema_rotacion: t.esquema_rotacion || 'FIJO_SEMANAL',
      perfil_nombre: null,
      salario_base: Number(t.salario_base) || 0,
      estado_laboral: t.estado_laboral || 'ACTIVO',
      fecha_ingreso: t.fecha_ingreso || '',
    }));
}

export function TrabajadoresListadoDownloadModal({
  open,
  onClose,
  rows,
  area,
  areaLabel,
}: Props) {
  const [pdfState, setPdfState] = useState<{
    loading: boolean;
    error: string | null;
    blob: Blob | null;
    url: string | null;
    data: ListadoData | null;
    meta: ListadoMeta | null;
  }>({
    loading: false,
    error: null,
    blob: null,
    url: null,
    data: null,
    meta: null,
  });
  const [pdfShareSupported, setPdfShareSupported] = useState(false);

  useEffect(() => {
    setPdfShareSupported(canSharePdf());
  }, []);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setPdfState({
        loading: false,
        error: null,
        blob: null,
        url: null,
        data: null,
        meta: null,
      });
    }
  }, [open]);

  // Generar PDF al abrir
  useEffect(() => {
    if (!open) return;
    if (pdfState.data || pdfState.loading) return;
    const pdfRows = buildPdfRows(rows);
    if (pdfRows.length === 0) {
      setPdfState({
        loading: false,
        error: 'No hay trabajadores activos o reenganchados para listar.',
        blob: null,
        url: null,
        data: null,
        meta: null,
      });
      return;
    }
    setPdfState((prev) => ({ ...prev, loading: true, error: null }));
    const meta: ListadoMeta = { area, areaLabel };
    const data = buildTrabajadoresListadoData(pdfRows, meta);
    (async () => {
      try {
        const { blob, url } = await previewTrabajadoresListadoPdf(data);
        setPdfState({ loading: false, error: null, blob, url, data, meta });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo generar el PDF.';
        setPdfState({ loading: false, error: msg, blob: null, url: null, data: null, meta: null });
      }
    })();
  }, [open, rows, area, areaLabel, pdfState.data, pdfState.loading]);

  async function handleDownload() {
    if (!pdfState.data || !pdfState.meta) return;
    try {
      await downloadTrabajadoresListadoPdf(pdfState.data, pdfState.meta);
      toast.success('PDF descargado.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo descargar el PDF.';
      toast.error(msg);
    }
  }

  async function handleShare() {
    if (!pdfState.data || !pdfState.meta) return;
    try {
      const outcome: ShareOutcome = await shareTrabajadoresListadoPdf(pdfState.data, pdfState.meta);
      if (outcome === 'unsupported') toast.error('Tu navegador no soporta compartir PDF.');
      else if (outcome === 'cancelled') toast.info('Compartir cancelado.');
      else if (outcome === 'failed') toast.error('No se pudo compartir el PDF.');
      else toast.success('Compartido.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al compartir.';
      toast.error(msg);
    }
  }

  return (
    <NominaPdfPreviewModal
      open={open}
      onClose={onClose}
      title={`Listado · ${areaLabel}`}
      blobUrl={pdfState.url}
      loading={pdfState.loading}
      error={pdfState.error}
      onDownload={handleDownload}
      onShare={pdfShareSupported ? handleShare : undefined}
      canShare={pdfShareSupported}
    />
  );
}

export function areaLabelForArea(area: string): string {
  return AREA_LABELS[area] || 'Todas';
}
