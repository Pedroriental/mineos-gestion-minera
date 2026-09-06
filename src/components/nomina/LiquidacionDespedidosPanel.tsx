'use client';

import { useState, useMemo, useTransition, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, CheckCircle2, AlertTriangle, Upload, Search, X, Eye, Download, Share2,
  Trash2, RotateCcw, Eraser, Save, AlertCircle,
} from 'lucide-react';
import type { Personal } from '@/lib/types';
import { calcularLiquidacionPendiente, type LiquidacionResultado } from '@/lib/nomina-calculo';
import {
  procesarLiquidacionDespedidosAction,
  actualizarLiquidacionPersonalAction,
  eliminarDespedidoAction,
} from '@/lib/actions/nomina-v3';
import {
  downloadLiquidacionPdf,
  previewLiquidacionPdf,
  shareLiquidacionPdf,
  canSharePdf,
  type ShareOutcome,
  type LiquidacionExportRow,
  type LiquidacionExportMeta,
} from '@/lib/nomina/liquidacion-pdf';
import { NominaPdfPreviewModal } from '@/components/nomina/NominaPdfPreviewModal';
import { ImportarDespedidosModal } from '@/components/nomina/ImportarDespedidosModal';
import type { DistribucionParte } from '@/lib/nomina-distribucion';
import { toast } from 'sonner';

type Area = 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';

type Props = {
  area: Area | string;
  personal: Personal[];
  distribucionPartes?: DistribucionParte[];
  onRefresh?: () => void;
  canEdit?: boolean;
};

type LiquidacionOverride = {
  bonificaciones: number;
  montoEditado: number | null;
  cobraSemanaLibre: boolean;
  diasTrabajadosOverride: number | null;
  cerrada: boolean;
};

const DEFAULT_OVERRIDE: LiquidacionOverride = {
  bonificaciones: 0,
  montoEditado: null,
  cobraSemanaLibre: false,
  diasTrabajadosOverride: null,
  cerrada: false,
};

type LiquidacionItem = {
  personal: Personal;
  liquidacion: LiquidacionResultado;
  bonificaciones: number;
  montoEditado: number | null;
  cobraSemanaLibre: boolean;
  diasTrabajadosOverride: number | null;
  cerrada: boolean;
  importedFromPersonal: boolean;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function useDebouncedCallback<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]) as T;
}

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function LiquidacionDespedidosPanel({ area, personal, distribucionPartes, onRefresh, canEdit = true }: Props) {
  const [overrides, setOverrides] = useState<Record<string, LiquidacionOverride>>({});
  const [processing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState<Personal | null>(null);
  const [eliminando, startEliminarTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');

  const despedidos = useMemo(
    () => personal.filter(
      (p) => p.area === area && p.estado_laboral === 'DESPEDIDO',
    ),
    [personal, area],
  );

  const itemsList: LiquidacionItem[] = useMemo(() => {
    return despedidos.map((p) => {
      const despidoFecha = p.despido_fecha ?? p.estado_fin_fecha ?? new Date().toISOString().split('T')[0];

      const defaults = {
        bonificaciones: Number(p.liquidacion_bonificaciones) || 0,
        montoEditado: null as number | null,
        cobraSemanaLibre: !!p.liquidacion_cobra_semana_libre,
        diasTrabajadosOverride: p.liquidacion_dias_trabajados ?? null,
        cerrada: false,
      };
      const ov = overrides[p.id] ?? defaults;
      const liquidacion = calcularLiquidacionPendiente(
        p,
        despidoFecha,
        ov.cobraSemanaLibre,
        ov.diasTrabajadosOverride,
      );
      return {
        personal: p,
        liquidacion,
        bonificaciones: ov.bonificaciones,
        montoEditado: ov.montoEditado,
        cobraSemanaLibre: ov.cobraSemanaLibre,
        diasTrabajadosOverride: ov.diasTrabajadosOverride,
        cerrada: ov.cerrada,
        importedFromPersonal: !overrides[p.id] && (
          p.liquidacion_dias_trabajados !== null && p.liquidacion_dias_trabajados !== undefined
        ),
      };
    });
  }, [despedidos, overrides]);

  const itemsFiltrados = useMemo(() => {
    if (!searchQuery.trim()) return itemsList;
    const q = removeAccents(searchQuery.toLowerCase().trim());
    return itemsList.filter((item) => {
      const nombre = removeAccents(item.personal.nombre_completo.toLowerCase());
      const cedula = item.personal.cedula.toLowerCase();
      const cargo = removeAccents(item.personal.cargo.toLowerCase());
      return nombre.includes(q) || cedula.includes(q) || cargo.includes(q);
    });
  }, [itemsList, searchQuery]);

  useEffect(() => {
    setError(null);
  }, [itemsList.length]);

  const handleBonificacion = useCallback((personalId: string, valor: number) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? DEFAULT_OVERRIDE;
      next[personalId] = { ...existing, bonificaciones: valor };
      return next;
    });
  }, []);

  const handleMontoEditado = useCallback((personalId: string, valor: number | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? DEFAULT_OVERRIDE;
      next[personalId] = { ...existing, montoEditado: valor };
      return next;
    });
  }, []);

  const handleCobraSemanaLibre = useCallback((personalId: string, valor: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? DEFAULT_OVERRIDE;
      next[personalId] = { ...existing, cobraSemanaLibre: valor };
      return next;
    });
  }, []);

  const handleDiasTrabajados = useCallback((personalId: string, valor: number | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const existing = next[personalId] ?? DEFAULT_OVERRIDE;
      next[personalId] = { ...existing, diasTrabajadosOverride: valor };
      return next;
    });
  }, []);

  const montoFinal = (item: LiquidacionItem): number => {
    if (item.montoEditado !== null) return item.montoEditado;
    return parseFloat((item.liquidacion.montoTotal + item.bonificaciones).toFixed(2));
  };

  const totalGeneral = itemsList.reduce((n, item) => n + montoFinal(item), 0);

  const handleCerrar = () => {
    setError(null);
    setSuccess(null);
    const pendientes = itemsList.filter((item) => !item.cerrada);
    if (pendientes.length === 0) return;

    startTransition(async () => {
      const payload = pendientes.map((item) => ({
        personalId: item.personal.id,
        montoLiquidacion: montoFinal(item),
        bonificaciones: item.bonificaciones,
        cobraSemanaLibre: item.cobraSemanaLibre,
        diasTrabajados: item.diasTrabajadosOverride,
        observacion: [
          ...item.liquidacion.semanas.map((s) => `${s.descripcion}: $${s.monto.toFixed(2)}`),
          item.cobraSemanaLibre ? 'Incluye semana libre' : 'Sin semana libre',
        ].join('; '),
        despidoFecha: item.personal.despido_fecha ?? new Date().toISOString().split('T')[0],
      }));

      const distribucionPayload = distribucionPartes && distribucionPartes.length > 0
        ? distribucionPartes.map((d) => ({
            nombre: d.nombre,
            porcentaje: d.porcentaje,
            pagoDirecto: d.pagoDirecto,
          }))
        : undefined;

      const res = await procesarLiquidacionDespedidosAction({
        area,
        liquidaciones: payload,
        distribucion: distribucionPayload,
      });
      if (res.ok) {
        setSuccess(`${pendientes.length} liquidacion(es) procesada(s) correctamente.`);
        setOverrides((prev) => {
          const next = { ...prev };
          for (const item of pendientes) {
            const existing = next[item.personal.id] ?? DEFAULT_OVERRIDE;
            next[item.personal.id] = { ...existing, cerrada: true };
          }
          return next;
        });
        onRefresh?.();
      } else {
        setError(res.message);
      }
    });
  };

  const handleConfirmEliminar = useCallback((p: Personal) => {
    setConfirmEliminar(p);
  }, []);

  const handleEjecutarEliminar = useCallback(() => {
    if (!confirmEliminar) return;
    setError(null);
    startEliminarTransition(async () => {
      const res = await eliminarDespedidoAction(confirmEliminar.id);
      if (res.ok) {
        setSuccess(res.message);
        setConfirmEliminar(null);
        onRefresh?.();
      } else {
        setError(res.message);
      }
    });
  }, [confirmEliminar, onRefresh]);

  const buildLiquidacionPdfPayload = useCallback(() => {
    const pdfRows: LiquidacionExportRow[] = itemsList.map((item) => {
      const salarioBase = Number(item.personal.salario_base) || 0;
      const salarioLibre = Number(item.personal.salario_libre) || salarioBase;
      const porDia = parseFloat((salarioBase / 7).toFixed(2));
      const totalDias = parseFloat((porDia * item.liquidacion.diasParciales).toFixed(2));
      const semanaLibreMonto = item.cobraSemanaLibre ? salarioLibre : 0;
      const totalACobrar = montoFinal(item);
      return {
        personal: {
          nombre_completo: item.personal.nombre_completo,
          cedula: item.personal.cedula,
          cargo: item.personal.cargo,
          area_detalle: item.personal.area_detalle,
        },
        salarioBase,
        porDia,
        diasTrabajados: item.liquidacion.diasParciales,
        totalDias,
        cobraSemanaLibre: item.cobraSemanaLibre,
        semanaLibreMonto,
        bonificaciones: item.bonificaciones,
        totalACobrar,
        despidoFecha: item.personal.despido_fecha ?? '',
        despidoCausa: item.personal.despido_causa,
      };
    });

    const totalGeneral = itemsList.reduce((n, item) => n + montoFinal(item), 0);
    const totalDias = pdfRows.reduce((n, r) => n + r.totalDias, 0);
    const totalLibres = pdfRows.reduce((n, r) => n + r.semanaLibreMonto, 0);
    const totalBonificaciones = pdfRows.reduce((n, r) => n + r.bonificaciones, 0);

    const today = new Date().toISOString().split('T')[0];
    const areaLabel = area === 'mina' ? 'Mina Belén' : area === 'planta' ? 'Molino' : area;

    const meta: LiquidacionExportMeta = {
      area,
      areaLabel,
      fechaGeneracion: new Date().toLocaleString('es-ES'),
      fechaLiquidacion: today,
      workerCount: itemsList.length,
      totalGeneral: parseFloat(totalGeneral.toFixed(2)),
      totalDias: parseFloat(totalDias.toFixed(2)),
      totalLibres: parseFloat(totalLibres.toFixed(2)),
      totalBonificaciones: parseFloat(totalBonificaciones.toFixed(2)),
    };

    const distLineas = distribucionPartes
      ? distribucionPartes.map((d) => {
          const bruto = parseFloat(((totalGeneral * d.porcentaje) / 100).toFixed(2));
          const neto = parseFloat((bruto + d.pagoDirecto).toFixed(2));
          return {
            id: d.id,
            nombre: d.nombre,
            porcentaje: d.porcentaje,
            pagoDirecto: d.pagoDirecto,
            bruto,
            neto,
          };
        })
      : [];

    return { pdfRows, meta, distLineas };
  }, [itemsList, distribucionPartes, area]);

  const [pdfPreview, setPdfPreview] = useState<{
    open: boolean;
    loading: boolean;
    error: string | null;
    blob: Blob | null;
    url: string | null;
    title: string;
  }>({
    open: false,
    loading: false,
    error: null,
    blob: null,
    url: null,
    title: '',
  });
  const [pdfShareSupported, setPdfShareSupported] = useState(false);
  useEffect(() => {
    setPdfShareSupported(canSharePdf());
  }, []);

  const closePdfPreview = useCallback(() => {
    setPdfPreview((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return { open: false, loading: false, error: null, blob: null, url: null, title: '' };
    });
  }, []);

  const handlePreviewLiquidacionPdf = useCallback(async () => {
    if (itemsList.length === 0) {
      toast.error('No hay liquidaciones para exportar.');
      return;
    }
    const { pdfRows, meta, distLineas } = buildLiquidacionPdfPayload();
    setPdfPreview({ open: true, loading: true, error: null, blob: null, url: null, title: `Liquidación · ${meta.areaLabel}` });
    try {
      const { blob, url } = await Promise.race([
        previewLiquidacionPdf(pdfRows, meta, distLineas),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'La generación del PDF tardó demasiado tiempo. Puedes usar el botón de Descargar.',
                ),
              ),
            8000,
          ),
        ),
      ]);
      setPdfPreview((prev) => ({ ...prev, loading: false, blob, url }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo generar el PDF.';
      setPdfPreview((prev) => ({ ...prev, loading: false, error: msg }));
    }
  }, [buildLiquidacionPdfPayload, itemsList.length]);

  const handleDownloadLiquidacionPdf = useCallback(async () => {
    if (itemsList.length === 0) {
      toast.error('No hay liquidaciones para exportar.');
      return;
    }
    const { pdfRows, meta, distLineas } = buildLiquidacionPdfPayload();
    try {
      await downloadLiquidacionPdf(pdfRows, meta, distLineas);
      toast.success('PDF descargado.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo descargar el PDF.';
      toast.error(msg);
    }
  }, [buildLiquidacionPdfPayload, itemsList.length]);

  const handleShareLiquidacionPdf = useCallback(async () => {
    if (itemsList.length === 0) {
      toast.error('No hay liquidaciones para compartir.');
      return;
    }
    const { pdfRows, meta, distLineas } = buildLiquidacionPdfPayload();
    try {
      const outcome: ShareOutcome = await shareLiquidacionPdf(pdfRows, meta, distLineas);
      if (outcome === 'unsupported') toast.error('Tu navegador no soporta compartir PDF.');
      else if (outcome === 'cancelled') toast.info('Compartir cancelado.');
      else if (outcome === 'failed') toast.error('No se pudo compartir el PDF.');
      else toast.success('Compartido.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al compartir.';
      toast.error(msg);
    }
  }, [buildLiquidacionPdfPayload, itemsList.length]);

  if (despedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
        <p className="text-sm text-zinc-500">No hay trabajadores despedidos en {area}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Liquidaciones Pendientes</h3>
          <p className="text-[11px] text-zinc-500">
            {despedidos.length} trabajador(es) despedido(s) — {itemsList.filter((i) => !i.cerrada).length} pendiente(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-amber-400">
            Total: ${totalGeneral.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            disabled={!canEdit}
            title={!canEdit ? 'Modo observador: solo lectura' : undefined}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar Excel
          </button>
          <button
            type="button"
            onClick={handlePreviewLiquidacionPdf}
            disabled={itemsList.length === 0}
            title="Ver PDF"
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadLiquidacionPdf}
            disabled={itemsList.length === 0}
            title="Descargar PDF"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PDF
          </button>
          {pdfShareSupported && (
            <button
              type="button"
              onClick={handleShareLiquidacionPdf}
              disabled={itemsList.length === 0}
              title="Compartir PDF"
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartir
            </button>
          )}
          <button
            type="button"
            onClick={handleCerrar}
            disabled={!canEdit || processing || itemsList.every((i) => i.cerrada)}
            title={!canEdit ? 'Modo observador: solo lectura' : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Cerrar Liquidación
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula o cargo…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-zinc-900/40 pl-8 pr-8 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-amber-500/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-zinc-500">
          {searchQuery
            ? `${itemsFiltrados.length} de ${itemsList.length}`
            : `${itemsList.length} total`}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {itemsFiltrados.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-white/5 bg-zinc-900/30 py-10">
          <Eraser className="h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-500">Sin coincidencias para &ldquo;{searchQuery}&rdquo;</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-[11px] text-amber-400 hover:text-amber-300"
          >
            Limpiar búsqueda
          </button>
        </div>
      )}

      <div className="space-y-2">
        {itemsFiltrados.map((item) => (
          <LiquidacionCard
            key={item.personal.id}
            item={item}
            montoFinal={montoFinal(item)}
            onBonificacion={(v) => handleBonificacion(item.personal.id, v)}
            onMontoEditado={(v) => handleMontoEditado(item.personal.id, v)}
            onCobraSemanaLibre={(v) => handleCobraSemanaLibre(item.personal.id, v)}
            onDiasTrabajados={(v) => handleDiasTrabajados(item.personal.id, v)}
            onEliminar={() => handleConfirmEliminar(item.personal)}
            eliminando={eliminando}
            canEdit={canEdit}
          />
        ))}
      </div>

      {showImportModal && (
        <ImportarDespedidosModal
          area={area as Area}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            onRefresh?.();
          }}
        />
      )}

      <NominaPdfPreviewModal
        open={pdfPreview.open}
        onClose={closePdfPreview}
        title={pdfPreview.title}
        blobUrl={pdfPreview.url}
        loading={pdfPreview.loading}
        error={pdfPreview.error}
        onDownload={handleDownloadLiquidacionPdf}
        onShare={
          pdfShareSupported
            ? handleShareLiquidacionPdf
            : undefined
        }
        canShare={pdfShareSupported}
      />

      {confirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-zinc-900/95 p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Eliminar trabajador</h2>
            </div>
            <p className="mb-4 text-[12px] text-zinc-300">
              ¿Eliminar a <strong>{confirmEliminar.nombre_completo}</strong>{' '}
              (C.I. {confirmEliminar.cedula})?
            </p>
            <p className="mb-4 text-[11px] text-zinc-500">
              Se moverá a histórico y no volverá a aparecer en este panel.
              Los registros de nóminas cerradas se preservan.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmEliminar(null)}
                disabled={eliminando}
                className="rounded border border-white/10 bg-transparent px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEjecutarEliminar}
                disabled={!canEdit || eliminando}
                title={!canEdit ? 'Modo observador: solo lectura' : undefined}
                className="flex items-center gap-1.5 rounded bg-red-500/15 border border-red-500/30 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {eliminando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LiquidacionCard({
  item,
  montoFinal,
  onBonificacion,
  onMontoEditado,
  onCobraSemanaLibre,
  onDiasTrabajados,
  onEliminar,
  eliminando,
  canEdit,
}: {
  item: LiquidacionItem;
  montoFinal: number;
  onBonificacion: (v: number) => void;
  onMontoEditado: (v: number | null) => void;
  onCobraSemanaLibre: (v: boolean) => void;
  onDiasTrabajados: (v: number | null) => void;
  onEliminar: () => void;
  eliminando: boolean;
  canEdit: boolean;
}) {
  const { personal: p, liquidacion, bonificaciones, cobraSemanaLibre, diasTrabajadosOverride, cerrada } = item;
  const [editMode, setEditMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const salarioBase = Number(p.salario_base) || 0;
  const salarioLibre = Number(p.salario_libre) || salarioBase;
  const porDia = salarioBase / 7;
  const totalDias = liquidacion.diasParciales;
  const totalDT = totalDias > 0 ? parseFloat((porDia * totalDias).toFixed(2)) : 0;
  const totalLibre = cobraSemanaLibre ? salarioLibre : 0;

  const autoCalculo = useMemo(() => {
    return calcularLiquidacionPendiente(p, p.despido_fecha ?? '', false, null);
  }, [p]);

  const diasAuto = autoCalculo.diasParciales;
  const diasEditado = diasTrabajadosOverride !== null && diasTrabajadosOverride !== diasAuto;
  const bonoEditado = bonificaciones !== (Number(p.liquidacion_bonificaciones) || 0);
  const libreEditado = cobraSemanaLibre !== !!p.liquidacion_cobra_semana_libre;
  const hayCambios = diasEditado || bonoEditado || libreEditado;

  const debouncedSave = useDebouncedCallback(
    async (campos: { diasTrabajados?: number | null; bonificaciones?: number | null; cobraSemanaLibre?: boolean }) => {
      setSaveState('saving');
      setError(null);
      const res = await actualizarLiquidacionPersonalAction(p.id, campos);
      if (res.ok) {
        setSaveState('saved');
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
      } else {
        setSaveState('error');
        setError(res.message);
      }
    },
    1000,
  );

  const handleDiasChange = (valor: number | null) => {
    onDiasTrabajados(valor);
    if (!cerrada) {
      debouncedSave({ diasTrabajados: valor });
    }
  };

  const handleBonoChange = (valor: number) => {
    onBonificacion(valor);
    if (!cerrada) {
      debouncedSave({ bonificaciones: valor });
    }
  };

  const handleLibreChange = (valor: boolean) => {
    onCobraSemanaLibre(valor);
    if (!cerrada) {
      debouncedSave({ cobraSemanaLibre: valor });
    }
  };

  const handleResetDias = () => {
    handleDiasChange(null);
  };

  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      cerrada
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : 'border-white/5 bg-zinc-900/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-200 truncate">{p.nombre_completo}</p>
            {cerrada && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                Cerrada
              </span>
            )}
            {item.importedFromPersonal && !cerrada && (
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
                importado
              </span>
            )}
            {p.cedula.startsWith('SN-') && (
              <a
                href="/admin/trabajadores?search=SN-"
                target="_blank"
                rel="noreferrer"
                title="Cédula y/o nombre generados automáticamente. Click para editar."
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-medium text-amber-300 hover:bg-amber-500/25 transition-colors"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                Datos incompletos
              </a>
            )}
            {!cerrada && saveState === 'saving' && (
              <span className="flex items-center gap-1 text-[9px] text-zinc-500">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> guardando
              </span>
            )}
            {!cerrada && saveState === 'saved' && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                <Save className="h-2.5 w-2.5" /> guardado
              </span>
            )}
            {!cerrada && saveState === 'error' && (
              <span className="flex items-center gap-1 text-[9px] text-red-400">
                <AlertTriangle className="h-2.5 w-2.5" /> error
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500">
            C.I. {p.cedula} · {p.cargo} · ${salarioBase.toFixed(0)}/sem
          </p>
          <p className="text-[10px] text-zinc-500">
            Despido: {p.despido_fecha ?? '—'}
            {p.despido_causa && (
              <span className="ml-1 rounded bg-amber-500/10 border border-amber-500/20 px-1 text-amber-300">
                {p.despido_causa}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className="text-base font-bold tabular-nums text-amber-400">
            ${montoFinal.toFixed(2)}
          </p>
          <p className="text-[9px] text-zinc-500">
            {totalDias}d · ${porDia.toFixed(2)}/día
            {cobraSemanaLibre ? ' +libre' : ''}
          </p>
          {!cerrada && (
            <button
              type="button"
              onClick={onEliminar}
              disabled={!canEdit || eliminando}
              title={!canEdit ? 'Modo observador: solo lectura' : undefined}
              className="flex items-center gap-1 rounded border border-red-500/20 bg-red-500/5 px-2 py-0.5 text-[9px] font-medium text-red-300 hover:bg-red-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-2.5 w-2.5" />
              Eliminar
            </button>
          )}
        </div>
      </div>

      {error && !cerrada && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-red-400">
          <AlertTriangle className="h-3 w-3" /> {error}
        </div>
      )}

      <div className="mt-2 grid grid-cols-4 gap-1 rounded-md bg-zinc-900/30 px-2 py-1.5 text-center text-[10px]">
        <div>
          <p className="text-zinc-500">$/día</p>
          <p className="tabular-nums text-zinc-300">${porDia.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Días Trab.</p>
          <p className="tabular-nums text-zinc-300">{totalDias}</p>
        </div>
        <div>
          <p className="text-zinc-500">Total/DT</p>
          <p className="tabular-nums text-zinc-300">${totalDT.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Sem. Libre</p>
          <p className="tabular-nums text-zinc-300">${totalLibre.toFixed(2)}</p>
        </div>
      </div>

      {!cerrada && (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className={`flex items-center gap-1.5 ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
              <input
                type="checkbox"
                checked={cobraSemanaLibre}
                onChange={(e) => handleLibreChange(e.target.checked)}
                disabled={!canEdit}
                className="h-3.5 w-3.5 rounded border-white/10 bg-zinc-900/60 text-amber-500 focus:ring-1 focus:ring-amber-500/30 disabled:cursor-not-allowed"
              />
              <span className="text-[10px] text-zinc-300">Cobró semana libre</span>
              <span className="text-[9px] text-zinc-500">(+${salarioLibre.toFixed(2)})</span>
            </label>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-zinc-400">Días Trab.:</label>
              <input
                type="number"
                step="any"
                placeholder={`auto: ${diasAuto}`}
                value={diasTrabajadosOverride ?? ''}
                onChange={(e) => handleDiasChange(e.target.value ? Number(e.target.value) : null)}
                disabled={!canEdit}
                title={!canEdit ? 'Modo observador: solo lectura' : undefined}
                className={`w-20 rounded-md border bg-zinc-900/60 px-2 py-1 text-[11px] text-white outline-none tabular-nums disabled:cursor-not-allowed disabled:opacity-60 ${
                  diasEditado
                    ? 'border-amber-500/50 focus:border-amber-500'
                    : 'border-white/5 focus:border-zinc-500/40'
                }`}
              />
              {diasEditado && (
                <button
                  type="button"
                  onClick={handleResetDias}
                  disabled={!canEdit}
                  title={!canEdit ? 'Modo observador: solo lectura' : `Reset a auto: ${diasAuto}`}
                  className="rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
              {diasEditado && (
                <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
                  editado
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-zinc-400">Bono:</label>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={bonificaciones || ''}
                onChange={(e) => handleBonoChange(Number(e.target.value) || 0)}
                disabled={!canEdit}
                title={!canEdit ? 'Modo observador: solo lectura' : undefined}
                className={`w-20 rounded-md border bg-zinc-900/60 px-2 py-1 text-[11px] text-white outline-none tabular-nums disabled:cursor-not-allowed disabled:opacity-60 ${
                  bonoEditado
                    ? 'border-amber-500/50 focus:border-amber-500'
                    : 'border-white/5 focus:border-zinc-500/40'
                }`}
              />
            </div>
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              disabled={!canEdit}
              title={!canEdit ? 'Modo observador: solo lectura' : undefined}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editMode ? 'Auto' : 'Total fijo'}
            </button>
            {editMode && (
              <input
                type="number"
                step="any"
                placeholder={montoFinal.toFixed(2)}
                value={item.montoEditado ?? ''}
                onChange={(e) => onMontoEditado(e.target.value ? Number(e.target.value) : null)}
                disabled={!canEdit}
                title={!canEdit ? 'Modo observador: solo lectura' : undefined}
                className="w-24 rounded-md border border-white/5 bg-zinc-900/60 px-2 py-1 text-[11px] text-white outline-none focus:border-zinc-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
          </div>
          {hayCambios && saveState === 'idle' && !editMode && (
            <p className="text-[9px] text-zinc-600">Los cambios se guardan automáticamente</p>
          )}
        </div>
      )}
    </div>
  );
}
