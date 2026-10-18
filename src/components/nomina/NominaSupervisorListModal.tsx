'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  AlertTriangle,
  Sparkles,
  Upload,
  Camera,
  Loader2,
  Layers,
  Trash2,
  Image as ImageIcon,
  UserPlus,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  ASIGNACION_NOMINA_OPCIONES,
  formatNombrePropio,
} from '@/lib/personal-master';
import {
  MINEOS_BTN_NOMINA_PRIMARY,
  mineosBtnSubtleClass,
  mineosPanel,
} from '@/lib/mineos-visual';
import { parseSupervisorListInput } from '@/lib/nomina/corte-grupo-engine';
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

type NewWorkerDraft = {
  index: number;
  selected: boolean;
  nombre_completo: string;
  cedula: string;
  cargo: string;
  area_detalle: string;
  salario_base: number;
  salario_libre: number;
  bono_transporte: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  catalog: Personal[];
  onWorkersCreated?: (workers: Personal[]) => void;
  onApplyList: (items: SupervisorListAppliedItem[], mode: 'replace' | 'merge') => void;
  onApplyToCorteMatrix?: (items: SupervisorListAppliedItem[]) => void;
};

function defaultAsignacionForFrente(
  frente: string | undefined,
  cargo: string | undefined,
  area: string,
): string {
  if (area === 'planta') {
    if (frente === 'M2') return 'Molinos La Fé - Molino 2';
    return 'Molinos La Fé - Guardia';
  }
  if (cargo && /cociner/i.test(cargo)) return 'Mina Belén - Cocina Mina';
  if (cargo && /supervisor/i.test(cargo)) return 'Mina Belén - Administración Mina';
  if (cargo && /compresor/i.test(cargo)) return 'Mina Belén - Compresoristas';
  if (frente === 'V2') return 'Vertical 2PD';
  if (frente === 'V3') return 'Vertical 3PD';
  return 'Vertical 1PD';
}

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
  onWorkersCreated,
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
  const [localCreatedWorkers, setLocalCreatedWorkers] = useState<Personal[]>([]);

  // Ventana de creación de trabajadores nuevos que no existen en la BD
  const [showCreateNewModal, setShowCreateNewModal] = useState(false);
  const [newWorkerDrafts, setNewWorkerDrafts] = useState<Record<number, NewWorkerDraft>>({});
  const [isCreatingWorkers, setIsCreatingWorkers] = useState(false);
  const [pendingActionAfterCreate, setPendingActionAfterCreate] = useState<
    'single_week' | 'corte_matrix' | null
  >(null);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const mergedCatalog = useMemo(() => {
    const byId = new Map<string, Personal>();
    for (const p of catalog) byId.set(p.id, p);
    for (const p of localCreatedWorkers) byId.set(p.id, p);
    return Array.from(byId.values());
  }, [catalog, localCreatedWorkers]);

  const parsedItems = useMemo(
    () => parseSupervisorListInput(rawText, mergedCatalog, area),
    [rawText, mergedCatalog, area],
  );

  const workerOptions = useMemo(
    () => [
      { value: '__create_new__', label: '➕ NO EXISTE EN BASE → Crear como Nuevo Trabajador' },
      ...[...mergedCatalog]
        .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
        .map((p) => ({
          value: p.id,
          label: `${p.nombre_completo} (C.I. ${p.cedula || 'S/C'} · ${p.cargo} · $${p.salario_base})`,
        })),
    ],
    [mergedCatalog],
  );

  const resolvedItems = useMemo(() => {
    return parsedItems.map((item, idx) => {
      const manualId = manualOverrides[idx];
      const forcedNew = manualId === '__create_new__';
      const personal = forcedNew
        ? null
        : manualId
          ? mergedCatalog.find((p) => p.id === manualId) ?? item.matchedPersonal
          : item.matchedPersonal;

      const defaultDias = item.diasGuardiaTotal ?? item.diasTrabajados;
      const effectiveDias = diasOverrides[idx] !== undefined ? diasOverrides[idx] : defaultDias;
      const defaultCobraLibre =
        personal === null
          ? false
          : item.cobraSemanaLibre !== undefined
            ? item.cobraSemanaLibre
            : !item.esNuevoExplicito;
      const effectiveCobraLibre =
        libreOverrides[idx] !== undefined ? libreOverrides[idx] : defaultCobraLibre;
      const effectiveExtra =
        extraOverrides[idx] !== undefined ? extraOverrides[idx] : item.pagoExtra;

      return {
        ...item,
        index: idx,
        resolvedPersonal: personal,
        isMissingInDb: !personal,
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
    mergedCatalog,
    excludedIndices,
  ]);

  const missingItems = useMemo(
    () => resolvedItems.filter((i) => !i.excluded && !i.resolvedPersonal),
    [resolvedItems],
  );

  const validIncluded = useMemo(
    () => resolvedItems.filter((i) => !i.excluded && i.resolvedPersonal),
    [resolvedItems],
  );

  // Sincronizar borradores de trabajadores nuevos cuando cambian los items sin coincidencia
  useEffect(() => {
    if (missingItems.length === 0) return;
    setNewWorkerDrafts((prev) => {
      const next = { ...prev };
      for (const m of missingItems) {
        if (!next[m.index]) {
          const defaultCargo =
            m.cargoOverride || (area === 'planta' ? 'Molinero' : 'Recortero');
          const defaultSueldo =
            m.salarioOverride ??
            (defaultCargo === 'Supervisor'
              ? 175
              : defaultCargo === 'Martillero' || defaultCargo === 'Ayudante Barrenador'
                ? 150
                : 100);
          next[m.index] = {
            index: m.index,
            selected: true,
            nombre_completo: formatNombrePropio(m.extractedName || m.rawLine),
            cedula: m.extractedCedula || '',
            cargo: defaultCargo,
            area_detalle: defaultAsignacionForFrente(m.frenteReportado, defaultCargo, area),
            salario_base: defaultSueldo,
            salario_libre: defaultSueldo,
            bono_transporte: area === 'planta' ? 30 : 0,
          };
        }
      }
      return next;
    });
  }, [missingItems, area]);

  function openCreateMissingModal(nextAction: 'single_week' | 'corte_matrix' | null = null) {
    setPendingActionAfterCreate(nextAction);
    setShowCreateNewModal(true);
  }

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

      const newRaw = rawText.trim() ? `${rawText}\n${extracted}` : extracted;
      setRawText(newRaw);
      setManualOverrides({});
      setDiasOverrides({});
      setLibreOverrides({});
      setExtraOverrides({});
      setExcludedIndices(new Set());

      // Verificar de inmediato si hay trabajadores en la foto que no existen en la BD
      const previewParsed = parseSupervisorListInput(newRaw, mergedCatalog, area);
      const notFoundCount = previewParsed.filter((p) => !p.matchedPersonal).length;
      if (notFoundCount > 0) {
        toast.info(
          `Se detectaron ${notFoundCount} trabajador(es) que no están en la Base de Datos. Puedes crearlos con su sueldo ahora mismo.`,
        );
        setShowCreateNewModal(true);
      } else {
        toast.success('Todos los trabajadores de la foto fueron encontrados en la Base de Datos.');
      }
    } catch (err: any) {
      console.error('[OCR Supervisor]', err);
      toast.error(err?.message || 'Error al leer la foto del supervisor.');
    } finally {
      setOcrLoading(false);
      setOcrProgress(0);
    }
  }

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
  }, [open, rawText, mergedCatalog, area]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
        await processImageFile(file);
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        const text = await file.text();
        const nextText = rawText ? `${rawText}\n${text}` : text;
        setRawText(nextText);
        const previewParsed = parseSupervisorListInput(nextText, mergedCatalog, area);
        if (previewParsed.some((p) => !p.matchedPersonal)) {
          setShowCreateNewModal(true);
        }
        toast.success('Archivo leído correctamente.');
      } else {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
        const lines = rows
          .map((r) =>
            Array.isArray(r)
              ? r.filter((c) => c !== null && c !== undefined && c !== '').join(' | ')
              : '',
          )
          .filter((l) => l.trim().length > 2);
        const nextText = rawText ? `${rawText}\n${lines.join('\n')}` : lines.join('\n');
        setRawText(nextText);
        const previewParsed = parseSupervisorListInput(nextText, mergedCatalog, area);
        if (previewParsed.some((p) => !p.matchedPersonal)) {
          setShowCreateNewModal(true);
        }
        toast.success(`Se extrajeron ${lines.length} filas del archivo Excel.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo leer el archivo.');
    } finally {
      e.target.value = '';
    }
  }

  function buildPayloadItems(
    extraOverridesByIdx?: Record<number, Personal>,
  ): SupervisorListAppliedItem[] {
    const items: SupervisorListAppliedItem[] = [];
    for (const i of resolvedItems) {
      if (i.excluded) continue;
      const p = extraOverridesByIdx?.[i.index] ?? i.resolvedPersonal;
      if (!p) continue;
      const isGuardia = i.effectiveDias > 7 || i.diasGuardiaTotal !== undefined;
      items.push({
        personal: p,
        diasTrabajados: i.effectiveDias > 7 ? i.effectiveDias - 7 : i.effectiveDias,
        diasGuardiaTotal: isGuardia ? i.effectiveDias : undefined,
        cobraSemanaLibre: extraOverridesByIdx?.[i.index] ? false : i.effectiveCobraLibre,
        salarioOverride: p.salario_base || i.salarioOverride,
        frenteReportado: i.frenteReportado,
        estadoAsistencia: i.effectiveDias === 0 ? 'no_laborado' : i.estadoAsistencia,
        pagoExtra: i.effectiveExtra,
        motivoExtra: i.motivoExtra,
        bonoTransporteOverride: i.bonoTransporteOverride,
        esNuevoExplicito: extraOverridesByIdx?.[i.index] ? true : !i.effectiveCobraLibre,
        esDespidoExplicito: i.esDespidoExplicito,
      });
    }
    return items;
  }

  async function handleConfirmCreateNewWorkers() {
    const toCreate = missingItems
      .map((m) => newWorkerDrafts[m.index])
      .filter((d): d is NewWorkerDraft => Boolean(d && d.selected && d.nombre_completo.trim()));

    if (toCreate.length === 0) {
      setShowCreateNewModal(false);
      return;
    }

    setIsCreatingWorkers(true);
    try {
      const response = await fetch('/api/nomina/crear-trabajadores-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workers: toCreate.map((d) => ({
            tempKey: d.index,
            nombre_completo: d.nombre_completo.trim(),
            cedula: d.cedula.trim(),
            cargo: d.cargo.trim() || 'Recortero',
            area,
            area_detalle: d.area_detalle,
            salario_base: Number(d.salario_base) || 100,
            salario_libre: Number(d.salario_libre ?? d.salario_base) || 100,
            bono_transporte: Number(d.bono_transporte) || 0,
          })),
        }),
      });

      const res = await response.json();
      if (!response.ok || !res.ok) {
        throw new Error(res.message || 'No se pudieron registrar los trabajadores nuevos.');
      }

      const createdEntries: Array<{ tempKey: number; personal: Personal }> = Array.isArray(
        res.created,
      )
        ? res.created
        : [];

      const createdPersonals = createdEntries.map((c) => c.personal);
      setLocalCreatedWorkers((prev) => [...prev, ...createdPersonals]);
      onWorkersCreated?.(createdPersonals);

      const newOverrides: Record<number, string> = {};
      const newLibreOverrides: Record<number, boolean> = {};
      const createdByIndex: Record<number, Personal> = {};

      for (const entry of createdEntries) {
        const idx = Number(entry.tempKey);
        newOverrides[idx] = entry.personal.id;
        newLibreOverrides[idx] = false; // Son nuevos ingresos, no cobran semana libre previa
        createdByIndex[idx] = entry.personal;
      }

      setManualOverrides((prev) => ({ ...prev, ...newOverrides }));
      setLibreOverrides((prev) => ({ ...prev, ...newLibreOverrides }));
      setShowCreateNewModal(false);

      toast.success(
        `¡${createdPersonals.length} trabajador(es) nuevo(s) creado(s) en Registro de Trabajadores!`,
      );

      if (pendingActionAfterCreate === 'corte_matrix' && onApplyToCorteMatrix) {
        const payload = buildPayloadItems(createdByIndex);
        setPendingActionAfterCreate(null);
        if (payload.length > 0) {
          onApplyToCorteMatrix(payload);
        }
      } else if (pendingActionAfterCreate === 'single_week') {
        const payload = buildPayloadItems(createdByIndex);
        setPendingActionAfterCreate(null);
        if (payload.length > 0) {
          onApplyList(payload, applyMode);
          onClose();
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear los trabajadores.');
    } finally {
      setIsCreatingWorkers(false);
    }
  }

  function handleConfirmSingleWeek() {
    if (missingItems.length > 0) {
      openCreateMissingModal('single_week');
      return;
    }
    const items = buildPayloadItems();
    if (!items.length) {
      toast.error('No hay trabajadores identificados para aplicar.');
      return;
    }
    onApplyList(items, applyMode);
    onClose();
  }

  function handleConfirmCorteMatrix() {
    if (missingItems.length > 0) {
      openCreateMissingModal('corte_matrix');
      return;
    }
    const items = buildPayloadItems();
    if (!items.length) {
      toast.error('No hay trabajadores identificados para llevar al corte.');
      return;
    }
    if (onApplyToCorteMatrix) {
      onApplyToCorteMatrix(items);
    } else {
      onApplyList(items, applyMode);
      onClose();
    }
  }

  const asignacionOptions = useMemo(
    () => ASIGNACION_NOMINA_OPCIONES.map((v) => ({ value: v, label: v })),
    [],
  );

  return (
    <>
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
                Cruza todos los nombres con la <strong>Base de Datos de Trabajadores</strong>. Si alguno no existe, se abrirá una ventana para <strong>crearlo con su sueldo y cargo</strong> al instante.
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

          {/* Alerta de Trabajadores Nuevos Detectados (No existen en la Base de Datos) */}
          {missingItems.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-200">
                    Se detectaron {missingItems.length} trabajador{missingItems.length === 1 ? '' : 'es'} que NO existen en la Base de Datos
                  </p>
                  <p className="text-[11px] text-amber-300/80">
                    Haz clic en el botón para revisar sus datos (nombre, cédula, cargo y sueldo semanal) y crearlos en el Registro de Trabajadores.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openCreateMissingModal(null)}
                className={cn(
                  MINEOS_BTN_NOMINA_PRIMARY,
                  'h-8 px-3.5 text-xs font-bold inline-flex items-center gap-1.5',
                )}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Revisar y Crear {missingItems.length} Nuevo{missingItems.length === 1 ? '' : 's'} en Base de Datos
              </button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-12">
            {/* Columna Izquierda: Foto + Texto */}
            <div className="lg:col-span-5 space-y-2.5">
              {ocrLoading && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analizando foto y cruzando con Base de Datos...
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
                      onClick={() => setImagePreviewUrl(null)}
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
                  '• Sube una foto arriba o presiona Ctrl+V para pegar una imagen de WhatsApp.\n• O pega texto directo:\n1. Manuel Bermudez 23924471 14d\n2. Pedro Nuevo 30999111 Martillero 150$\n3. Jose Carvajal 12d\n4. Abraham Ramos +30$ bono'
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
                  Análisis contra Base de Datos ({validIncluded.length} existentes · {missingItems.length} nuevos por crear)
                </span>
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
                    El sistema verificará quiénes existen en la Base de Datos y abrirá una ventana para crear a los trabajadores nuevos con su sueldo y cargo.
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
                                  Existe en BD: {p.nombre_completo} · C.I. {p.cedula} · {p.cargo} ($
                                  {item.salarioOverride ?? p.salario_base})
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openCreateMissingModal(null)}
                                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35 hover:bg-amber-500/25"
                                >
                                  <UserPlus className="h-3.5 w-3.5 shrink-0" />
                                  NUEVO TRABAJADOR: {formatNombrePropio(item.extractedName)} (
                                  {item.cargoOverride || 'Recortero'} · $
                                  {item.salarioOverride ?? 100}/sem) → Clic para crear
                                </button>
                              )}
                              <span className="text-[9px] text-white/40 font-mono truncate max-w-[240px]">
                                “{item.rawLine}”
                              </span>
                            </div>
                          </div>

                          {!item.excluded && (
                            <div className="flex flex-wrap items-center gap-1.5">
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
                                      [item.index]: Math.max(
                                        0,
                                        Math.min(14, Number(e.target.value) || 0),
                                      ),
                                    }))
                                  }
                                  className="w-10 bg-transparent text-center font-bold text-amber-300 outline-none"
                                />
                              </label>

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
                              {p ? 'Emparejado con:' : 'Acción en Base de Datos:'}
                            </span>
                            <div className="min-w-[240px] flex-1">
                              <AppSelect
                                value={
                                  manualOverrides[item.index] ??
                                  (p ? p.id : '__create_new__')
                                }
                                onChange={(val) =>
                                  setManualOverrides((prev) => ({ ...prev, [item.index]: val }))
                                }
                                options={workerOptions}
                                placeholder="Buscar en catálogo o crear como nuevo..."
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
            {missingItems.length > 0 && (
              <button
                type="button"
                onClick={() => openCreateMissingModal(null)}
                className="h-9 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 inline-flex items-center gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Crear {missingItems.length} Nuevo{missingItems.length === 1 ? '' : 's'} en Base de Datos
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmSingleWeek}
              disabled={validIncluded.length === 0 && missingItems.length === 0}
              className={cn(
                mineosBtnSubtleClass('general'),
                'h-9 px-3.5 text-xs font-bold disabled:opacity-40',
              )}
            >
              Aplicar a Vista de 1 Semana ({validIncluded.length + missingItems.length})
            </button>

            {onApplyToCorteMatrix && (
              <button
                type="button"
                onClick={handleConfirmCorteMatrix}
                disabled={validIncluded.length === 0 && missingItems.length === 0}
                className={cn(
                  MINEOS_BTN_NOMINA_PRIMARY,
                  'h-9 px-4 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40',
                )}
              >
                <Layers className="h-4 w-4" />
                Llevar a Matriz de Corte 3 Semanas ({validIncluded.length + missingItems.length} trab.)
              </button>
            )}
          </div>
        </PageFormModalFooter>
      </PageFormModal>

      {/* SEGUNDA VENTANA: Crear Trabajadores Nuevos Detectados en el Registro de Trabajadores */}
      <PageFormModal
        open={showCreateNewModal && missingItems.length > 0}
        onClose={() => {
          setShowCreateNewModal(false);
          setPendingActionAfterCreate(null);
        }}
        panelClassName="sm:max-w-[94vw] xl:max-w-5xl !p-4 sm:!p-6"
      >
        <div className="space-y-4">
          <div className="border-b border-zinc-800 pb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="page-form-modal-title text-base font-bold text-white">
                  Trabajadores Nuevos por Crear en el Registro de Trabajadores ({missingItems.length})
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Estos trabajadores de la lista/foto no existen en la base de datos. Revisa o ajusta su <strong>Nombre, Cédula, Cargo y Sueldo Semanal</strong> para crearlos e incluirlos en la nómina.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[420px] rounded-xl border border-[var(--card-border)] bg-zinc-950/60">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-white/65">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">Crear</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Nombre y Apellido *</th>
                  <th className="px-3 py-2.5 min-w-[130px]">Cédula *</th>
                  <th className="px-3 py-2.5 min-w-[140px]">Cargo</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Sector / Frente</th>
                  <th className="px-3 py-2.5 min-w-[110px] text-right">Sueldo Sem. ($) *</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {missingItems.map((m) => {
                  const draft = newWorkerDrafts[m.index];
                  if (!draft) return null;
                  return (
                    <tr key={m.index} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={draft.selected}
                          onChange={(e) =>
                            setNewWorkerDrafts((prev) => ({
                              ...prev,
                              [m.index]: { ...draft, selected: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={draft.nombre_completo}
                          onChange={(e) =>
                            setNewWorkerDrafts((prev) => ({
                              ...prev,
                              [m.index]: { ...draft, nombre_completo: e.target.value },
                            }))
                          }
                          placeholder="Ej: Pedro Pérez"
                          className="input-field h-8 w-full text-xs font-bold text-white"
                        />
                        <span className="block mt-0.5 text-[9px] text-white/35 font-mono truncate max-w-[220px]">
                          Línea: “{m.rawLine}”
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={draft.cedula}
                          onChange={(e) =>
                            setNewWorkerDrafts((prev) => ({
                              ...prev,
                              [m.index]: { ...draft, cedula: e.target.value },
                            }))
                          }
                          placeholder="Ej: 28123456 (o vacío)"
                          className="input-field h-8 w-full text-xs font-mono"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={draft.cargo}
                          onChange={(e) =>
                            setNewWorkerDrafts((prev) => ({
                              ...prev,
                              [m.index]: { ...draft, cargo: e.target.value },
                            }))
                          }
                          placeholder="Ej: Recortero"
                          className="input-field h-8 w-full text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <AppSelect
                          value={draft.area_detalle}
                          onChange={(val) =>
                            setNewWorkerDrafts((prev) => ({
                              ...prev,
                              [m.index]: { ...draft, area_detalle: val },
                            }))
                          }
                          options={asignacionOptions}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <span className="text-amber-400 font-bold">$</span>
                          <input
                            type="number"
                            min={1}
                            step="1"
                            value={draft.salario_base}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setNewWorkerDrafts((prev) => ({
                                ...prev,
                                [m.index]: {
                                  ...draft,
                                  salario_base: val,
                                  salario_libre: val,
                                },
                              }));
                            }}
                            className="input-field h-8 w-20 text-right text-xs font-bold text-amber-300"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <PageFormModalFooter className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-zinc-800 pt-3">
          <button
            type="button"
            onClick={() => {
              setShowCreateNewModal(false);
              setPendingActionAfterCreate(null);
            }}
            disabled={isCreatingWorkers}
            className={cn(mineosBtnSubtleClass('neutral'), 'h-9 px-3.5 text-xs')}
          >
            Volver sin crear aún
          </button>

          <button
            type="button"
            onClick={handleConfirmCreateNewWorkers}
            disabled={isCreatingWorkers}
            className={cn(
              MINEOS_BTN_NOMINA_PRIMARY,
              'h-9 px-4 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40',
            )}
          >
            {isCreatingWorkers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isCreatingWorkers
              ? 'Guardando en Registro de Trabajadores...'
              : `Crear Trabajadores en Base de Datos y Continuar`}
          </button>
        </PageFormModalFooter>
      </PageFormModal>
    </>
  );
}
