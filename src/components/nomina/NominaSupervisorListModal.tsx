'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  AlertTriangle,
  Users,
  Sparkles,
  Upload,
  Camera,
  Loader2,
  Layers,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  MINEOS_BTN_NOMINA_PRIMARY,
  mineosBtnSubtleClass,
  mineosPanel,
} from '@/lib/mineos-visual';
import {
  parseSupervisorListInput,
} from '@/lib/nomina/corte-grupo-engine';
import type { Personal } from '@/lib/types';
import { cn } from '@/lib/utils';

export type SupervisorListAppliedItem = {
  personal: Personal;
  diasTrabajados: number;
  diasGuardiaTotal?: number;
  cobraSemanaLibre?: boolean;
  salarioOverride?: number;
  frenteReportado?: string;
  estadoAsistencia: 'trabajada' | 'libre' | 'no_laborado';
  pagoExtra: number;
  motivoExtra: string;
  bonoTransporteOverride?: number;
  esNuevoExplicito: boolean;
  esDespidoExplicito: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  area: string;
  catalog: Personal[];
  onApplyList: (items: SupervisorListAppliedItem[], mode: 'replace' | 'merge') => void;
  onApplyToCorteMatrix?: (items: SupervisorListAppliedItem[]) => void;
};

/**
 * Preprocesa la imagen en un canvas escalado 2x mejorando contraste para lectura de tablas de WhatsApp/Excel
 */
async function preprocessImageForOcr(file: File | Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width < 1400 ? 2 : 1.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Aumentar contraste suave para que texto negro sobre fondo gris/amarillo destaque
    const contrasted = lum < 165 ? Math.max(0, (lum - 165) * 1.45 + 165) : 255;
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function NominaSupervisorListModal({
  open,
  onClose,
  area,
  catalog,
  onApplyList,
  onApplyToCorteMatrix,
}: Props) {
  const [rawText, setRawText] = useState('');
  const [applyMode, setApplyMode] = useState<'replace' | 'merge'>('replace');
  const [manualOverrides, setManualOverrides] = useState<Record<number, string>>({});
  const [diasOverrides, setDiasOverrides] = useState<Record<number, number>>({});
  const [libreOverrides, setLibreOverrides] = useState<Record<number, boolean>>({});
  const [extraOverrides, setExtraOverrides] = useState<Record<number, number>>({});
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const parsedItems = useMemo(
    () => parseSupervisorListInput(rawText, catalog, area),
    [rawText, catalog, area],
  );

  const workerOptions = useMemo(
    () => [
      { value: '', label: '— Seleccionar trabajador manualmente —' },
      ...[...catalog]
        .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
        .map((p) => ({
          value: p.id,
          label: `${p.nombre_completo} (C.I. ${p.cedula || 'S/C'} · ${p.cargo} · $${p.salario_base})`,
        })),
    ],
    [catalog],
  );

  const resolvedItems = useMemo(() => {
    return parsedItems.map((item, idx) => {
      const manualId = manualOverrides[idx];
      const personal = manualId
        ? catalog.find((p) => p.id === manualId) ?? item.matchedPersonal
        : item.matchedPersonal;

      const defaultDias = item.diasGuardiaTotal ?? item.diasTrabajados;
      const effectiveDias = diasOverrides[idx] !== undefined ? diasOverrides[idx] : defaultDias;
      const defaultCobraLibre =
        item.cobraSemanaLibre !== undefined ? item.cobraSemanaLibre : !item.esNuevoExplicito;
      const effectiveCobraLibre =
        libreOverrides[idx] !== undefined ? libreOverrides[idx] : defaultCobraLibre;
      const effectiveExtra =
        extraOverrides[idx] !== undefined ? extraOverrides[idx] : item.pagoExtra;

      return {
        ...item,
        index: idx,
        resolvedPersonal: personal,
        effectiveDias,
        effectiveCobraLibre,
        effectiveExtra,
        excluded: excludedIndices.has(idx),
      };
    });
  }, [
    parsedItems,
    manualOverrides,
    diasOverrides,
    libreOverrides,
    extraOverrides,
    catalog,
    excludedIndices,
  ]);

  const validIncluded = useMemo(
    () => resolvedItems.filter((i) => !i.excluded && i.resolvedPersonal),
    [resolvedItems],
  );

  async function processImageFile(file: File | Blob) {
    setOcrLoading(true);
    setOcrProgress(5);
    try {
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return previewUrl;
      });

      const canvas = await preprocessImageForOcr(file);
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(canvas, 'spa', {
        logger: (m: any) => {
          if (m?.status === 'recognizing text' && typeof m.progress === 'number') {
            setOcrProgress(Math.max(10, Math.round(m.progress * 100)));
          }
        },
      });

      const extracted = (result?.data?.text || '').trim();
      if (!extracted) {
        toast.error('No se detectó texto legible en la imagen.');
        return;
      }

      setRawText((prev) => (prev.trim() ? `${prev}\n${extracted}` : extracted));
      setManualOverrides({});
      setDiasOverrides({});
      setLibreOverrides({});
      setExtraOverrides({});
      setExcludedIndices(new Set());
      toast.success('Foto procesada con éxito. Revisa el cruce de trabajadores a la derecha.');
    } catch (err: any) {
      console.error('[OCR Supervisor]', err);
      toast.error(err?.message || 'Error al leer la foto del supervisor.');
    } finally {
      setOcrLoading(false);
      setOcrProgress(0);
    }
  }

  // Permitir pegar imagen directamente con Ctrl+V cuando el modal está abierto
  useEffect(() => {
    if (!open) return;
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type.startsWith('image/')) {
          const blob = it.getAsFile();
          if (blob) {
            e.preventDefault();
            void processImageFile(blob);
            return;
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
        await processImageFile(file);
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        const text = await file.text();
        setRawText((prev) => (prev ? `${prev}\n${text}` : text));
        toast.success('Archivo leído correctamente.');
      } else {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
        const lines = rows
          .map((r) => (Array.isArray(r) ? r.filter((c) => c !== null && c !== undefined && c !== '').join(' | ') : ''))
          .filter((l) => l.trim().length > 2);
        setRawText((prev) => (prev ? `${prev}\n${lines.join('\n')}` : lines.join('\n')));
        toast.success(`Se extrajeron ${lines.length} filas del archivo Excel.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo leer el archivo.');
    } finally {
      e.target.value = '';
    }
  }

  function buildPayloadItems(): SupervisorListAppliedItem[] {
    return validIncluded.map((i) => {
      const isGuardia = i.effectiveDias > 7 || i.diasGuardiaTotal !== undefined;
      return {
        personal: i.resolvedPersonal!,
        diasTrabajados: i.effectiveDias > 7 ? i.effectiveDias - 7 : i.effectiveDias,
        diasGuardiaTotal: isGuardia ? i.effectiveDias : undefined,
        cobraSemanaLibre: i.effectiveCobraLibre,
        salarioOverride: i.salarioOverride,
        frenteReportado: i.frenteReportado,
        estadoAsistencia: i.effectiveDias === 0 ? 'no_laborado' : i.estadoAsistencia,
        pagoExtra: i.effectiveExtra,
        motivoExtra: i.motivoExtra,
        bonoTransporteOverride: i.bonoTransporteOverride,
        esNuevoExplicito: !i.effectiveCobraLibre,
        esDespidoExplicito: i.esDespidoExplicito,
      };
    });
  }

  function handleConfirmSingleWeek() {
    if (!validIncluded.length) {
      toast.error('No hay trabajadores identificados para aplicar.');
      return;
    }
    onApplyList(buildPayloadItems(), applyMode);
    onClose();
  }

  function handleConfirmCorteMatrix() {
    if (!validIncluded.length) {
      toast.error('No hay trabajadores identificados para llevar al corte.');
      return;
    }
    if (onApplyToCorteMatrix) {
      onApplyToCorteMatrix(buildPayloadItems());
    } else {
      onApplyList(buildPayloadItems(), applyMode);
      onClose();
    }
  }

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="sm:max-w-[96vw] xl:max-w-6xl !p-4 sm:!p-6"
    >
      <div className="space-y-4">
        <div className="border-b border-zinc-800 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="page-form-modal-title text-base font-bold text-white">
              Importar Lista, Foto o Tabla del Supervisor (WhatsApp / Foto / Excel)
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Sube la <strong>foto o captura del cuadro de nómina</strong> (o pégala con <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">Ctrl+V</kbd>), sube un Excel o pega el texto de WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={ocrLoading}
              className={cn(
                MINEOS_BTN_NOMINA_PRIMARY,
                'h-8 px-3 text-xs font-bold inline-flex items-center gap-1.5',
              )}
            >
              {ocrLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {ocrLoading ? `Leyendo Foto (${ocrProgress}%)...` : 'Subir Foto / Captura'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              className={cn(
                mineosBtnSubtleClass('general'),
                'cursor-pointer h-8 px-3 text-xs font-semibold inline-flex items-center gap-1.5',
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              Subir Excel / CSV
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Columna Izquierda: Foto + Texto */}
          <div className="lg:col-span-5 space-y-2.5">
            {ocrLoading && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extrayendo nombres, cédulas y días de la foto...
                  </span>
                  <span>{ocrProgress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full bg-amber-400 transition-all duration-200"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            )}

            {imagePreviewUrl && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                    <ImageIcon className="h-3.5 w-3.5" /> Foto cargada del supervisor
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreviewUrl(null);
                    }}
                    className="text-white/40 hover:text-red-400 inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Quitar vista de foto
                  </button>
                </div>
                <img
                  src={imagePreviewUrl}
                  alt="Reporte supervisor"
                  className="max-h-36 w-full object-contain rounded border border-zinc-800 bg-black"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
                Texto extraído o pegado
              </label>
              {rawText && (
                <button
                  type="button"
                  onClick={() => {
                    setRawText('');
                    setManualOverrides({});
                    setDiasOverrides({});
                    setLibreOverrides({});
                    setExtraOverrides({});
                    setExcludedIndices(new Set());
                  }}
                  className="text-[10px] text-red-400/80 hover:text-red-300 font-semibold"
                >
                  Limpiar texto
                </button>
              )}
            </div>

            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setManualOverrides({});
                setExcludedIndices(new Set());
              }}
              rows={imagePreviewUrl ? 7 : 11}
              placeholder={
                '• Sube una foto arriba o presiona Ctrl+V para pegar una imagen de WhatsApp.\n• O pega texto directo:\n1. Manuel Bermudez 23924471 14d\n2. Geraldine Betancourt 7d (sin libre)\n3. Jose Carvajal 12d\n4. Abraham Ramos +30$ bono'
              }
              className="input-field w-full font-mono text-xs leading-relaxed"
            />

            <div className={cn(mineosPanel('general'), '!p-2.5 space-y-2')}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Modo al aplicar en vista semanal
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApplyMode('replace')}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-all',
                    applyMode === 'replace'
                      ? 'border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] text-[var(--mineos-general-bright)] font-bold'
                      : 'border-[var(--card-border)] bg-[var(--surface-elevated)]/40 text-[var(--text-secondary)]',
                  )}
                >
                  <span className="block">Dejar solo esta lista</span>
                  <span className="text-[9px] font-normal text-[var(--text-muted)]">
                    Arma el grupo exactamente con estos trabajadores
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setApplyMode('merge')}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-all',
                    applyMode === 'merge'
                      ? 'border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] text-[var(--mineos-general-bright)] font-bold'
                      : 'border-[var(--card-border)] bg-[var(--surface-elevated)]/40 text-[var(--text-secondary)]',
                  )}
                >
                  <span className="block">Sumar / Actualizar</span>
                  <span className="text-[9px] font-normal text-[var(--text-muted)]">
                    Mantiene los actuales y actualiza/agrega estos
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Tabla de Emparejamiento y Ajuste Rápido */}
          <div className="lg:col-span-7 flex flex-col min-h-[320px]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
                Trabajadores Identificados ({validIncluded.length} de {resolvedItems.length} filas)
              </span>
              {resolvedItems.length > 0 && (
                <span className="text-[10px] text-white/45">
                  Puedes ajustar días (14d/12d/7d), semana libre o trabajador antes de aplicar
                </span>
              )}
            </div>

            {resolvedItems.length === 0 ? (
              <div
                onClick={() => photoInputRef.current?.click()}
                className="flex-1 cursor-pointer rounded-xl border border-dashed border-zinc-700 hover:border-amber-500/50 bg-[var(--surface-elevated)]/20 p-8 text-center flex flex-col items-center justify-center gap-2.5 transition-colors"
              >
                <Camera className="h-9 w-9 text-amber-400/70" />
                <p className="text-xs font-bold text-white/85">
                  Haz clic aquí para subir la foto de la lista del supervisor o presiona Ctrl+V
                </p>
                <p className="text-[11px] text-[var(--text-muted)] max-w-md">
                  Reconoce automáticamente cuadros como «LISTADO DE TRABAJADORES - NOMINA MINA», cédulas, días de guardia (14, 12, 7) y quién cobra semana libre.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[430px] rounded-xl border border-[var(--card-border)] bg-[var(--surface-elevated)]/20 divide-y divide-[var(--card-border)]/60">
                {resolvedItems.map((item) => {
                  const p = item.resolvedPersonal;
                  return (
                    <div
                      key={item.index}
                      className={cn(
                        'p-2.5 flex flex-col gap-2 transition-colors',
                        item.excluded && 'opacity-40 bg-zinc-950/40',
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p ? (
                              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                {p.nombre_completo} · C.I. {p.cedula} · {p.cargo} ($
                                {item.salarioOverride ?? p.salario_base})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                Sin coincidencia automática ({item.extractedName})
                              </span>
                            )}
                            <span className="text-[9px] text-white/40 font-mono truncate max-w-[260px]">
                              “{item.rawLine}”
                            </span>
                          </div>
                        </div>

                        {!item.excluded && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Días trabajados (Guardia 0..14 o Semana 0..7) */}
                            <label
                              title="Días trabajados reportados (ej. 14, 12 o 7 en guardia de mina)"
                              className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px]"
                            >
                              <span className="text-white/50">Días:</span>
                              <input
                                type="number"
                                min={0}
                                max={14}
                                value={item.effectiveDias}
                                onChange={(e) =>
                                  setDiasOverrides((prev) => ({
                                    ...prev,
                                    [item.index]: Math.max(0, Math.min(14, Number(e.target.value) || 0)),
                                  }))
                                }
                                className="w-10 bg-transparent text-center font-bold text-amber-300 outline-none"
                              />
                            </label>

                            {/* Toggle Cobra Semana Libre */}
                            <button
                              type="button"
                              onClick={() =>
                                setLibreOverrides((prev) => ({
                                  ...prev,
                                  [item.index]: !item.effectiveCobraLibre,
                                }))
                              }
                              className={cn(
                                'rounded border px-2 py-0.5 text-[10px] font-bold transition-colors',
                                item.effectiveCobraLibre
                                  ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                                  : 'border-purple-500/35 bg-purple-500/15 text-purple-300',
                              )}
                            >
                              {item.effectiveCobraLibre ? '✓ Con Sem. Libre' : '✗ Sin Sem. Libre'}
                            </button>

                            {/* Pago Extra / Incentivo */}
                            <label className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px]">
                              <span className="text-white/45">+Extra $:</span>
                              <input
                                type="number"
                                min={0}
                                value={item.effectiveExtra || ''}
                                placeholder="0"
                                onChange={(e) =>
                                  setExtraOverrides((prev) => ({
                                    ...prev,
                                    [item.index]: Math.max(0, Number(e.target.value) || 0),
                                  }))
                                }
                                className="w-11 bg-transparent text-right font-bold text-amber-300 outline-none"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                setExcludedIndices((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.index)) next.delete(item.index);
                                  else next.add(item.index);
                                  return next;
                                })
                              }
                              className="text-[10px] font-semibold text-white/45 hover:text-red-400 px-1.5 py-0.5"
                            >
                              Omitir
                            </button>
                          </div>
                        )}

                        {item.excluded && (
                          <button
                            type="button"
                            onClick={() =>
                              setExcludedIndices((prev) => {
                                const next = new Set(prev);
                                next.delete(item.index);
                                return next;
                              })
                            }
                            className="text-[10px] font-bold text-amber-400 hover:underline px-2 py-0.5"
                          >
                            Volver a incluir
                          </button>
                        )}
                      </div>

                      {!item.excluded && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                            {p ? 'Trabajador asignado:' : 'Seleccionar en catálogo:'}
                          </span>
                          <div className="min-w-[240px] flex-1">
                            <AppSelect
                              value={manualOverrides[item.index] ?? (p?.id || '')}
                              onChange={(val) =>
                                setManualOverrides((prev) => ({ ...prev, [item.index]: val }))
                              }
                              options={workerOptions}
                              placeholder="Buscar trabajador en la base..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <PageFormModalFooter className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={onClose}
          className={cn(mineosBtnSubtleClass('neutral'), 'h-9 px-4 text-xs font-bold')}
        >
          Cancelar
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleConfirmSingleWeek}
            disabled={validIncluded.length === 0}
            className={cn(
              mineosBtnSubtleClass('general'),
              'h-9 px-3.5 text-xs font-bold disabled:opacity-40',
            )}
          >
            Aplicar a Vista de 1 Semana ({validIncluded.length})
          </button>

          {onApplyToCorteMatrix && (
            <button
              type="button"
              onClick={handleConfirmCorteMatrix}
              disabled={validIncluded.length === 0}
              className={cn(
                MINEOS_BTN_NOMINA_PRIMARY,
                'h-9 px-4 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40',
              )}
            >
              <Layers className="h-4 w-4" />
              Llevar a Matriz de Corte 3 Semanas ({validIncluded.length} trab.)
            </button>
          )}
        </div>
      </PageFormModalFooter>
    </PageFormModal>
  );
}
