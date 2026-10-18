'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  AlertTriangle,
  UserPlus,
  Users,
  Sparkles,
  Upload,
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
  type ParsedSupervisorItem,
} from '@/lib/nomina/corte-grupo-engine';
import type { Personal } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  area: string;
  catalog: Personal[];
  onApplyList: (
    items: Array<{
      personal: Personal;
      diasTrabajados: number;
      estadoAsistencia: 'trabajada' | 'libre' | 'no_laborado';
      pagoExtra: number;
      motivoExtra: string;
      bonoTransporteOverride?: number;
      esNuevoExplicito: boolean;
      esDespidoExplicito: boolean;
    }>,
    mode: 'replace' | 'merge',
  ) => void;
};

export function NominaSupervisorListModal({
  open,
  onClose,
  area,
  catalog,
  onApplyList,
}: Props) {
  const [rawText, setRawText] = useState('');
  const [applyMode, setApplyMode] = useState<'replace' | 'merge'>('replace');
  const [manualOverrides, setManualOverrides] = useState<Record<number, string>>({});
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

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
          label: `${p.nombre_completo} (${p.cargo} · ${p.area.toUpperCase()})`,
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
      return {
        ...item,
        index: idx,
        resolvedPersonal: personal,
        excluded: excludedIndices.has(idx),
      };
    });
  }, [parsedItems, manualOverrides, catalog, excludedIndices]);

  const validIncluded = useMemo(
    () => resolvedItems.filter((i) => !i.excluded && i.resolvedPersonal),
    [resolvedItems],
  );

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
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
          .map((r) => (Array.isArray(r) ? r.filter(Boolean).join(' ') : ''))
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

  function handleConfirm() {
    if (!validIncluded.length) {
      toast.error('No hay trabajadores identificados para aplicar.');
      return;
    }
    onApplyList(
      validIncluded.map((i) => ({
        personal: i.resolvedPersonal!,
        diasTrabajados: i.diasTrabajados,
        estadoAsistencia: i.estadoAsistencia,
        pagoExtra: i.pagoExtra,
        motivoExtra: i.motivoExtra,
        bonoTransporteOverride: i.bonoTransporteOverride,
        esNuevoExplicito: i.esNuevoExplicito,
        esDespidoExplicito: i.esDespidoExplicito,
      })),
      applyMode,
    );
    onClose();
  }

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="max-w-5xl"
    >
      <div className="space-y-4">
        <div className="border-b border-zinc-800 pb-3">
          <h3 className="page-form-modal-title text-base font-bold text-white">
            Pegar Lista o Reporte del Supervisor
          </h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Pega el mensaje de WhatsApp, tabla de Word/Excel o transcribe la nota de voz. El algoritmo identifica nombres, días trabajados, pagos extra y nuevos ingresos al instante.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
                Lista o mensaje del supervisor
              </label>
              <label className={cn(mineosBtnSubtleClass('general'), 'cursor-pointer h-7 px-2.5 text-[10px] inline-flex items-center gap-1')}>
                <Upload className="h-3 w-3" />
                Subir Excel / CSV
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setManualOverrides({});
                setExcludedIndices(new Set());
              }}
              rows={10}
              placeholder={
                'Ejemplo de lo que puedes pegar:\n1. Pedro Perez\n2. Juan Gomez faltó 2 días\n3. Carlos Ruiz +30$ bono\n4. Luis Rondón 4d (nuevo)\n5. Jose Guaipo con carro 30$'
              }
              className="input-field w-full font-mono text-xs leading-relaxed"
            />
            <div className={cn(mineosPanel('general'), '!p-2.5 space-y-2')}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Modo de aplicación en la semana
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApplyMode('replace')}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 text-left text-[11px] transition-all',
                    applyMode === 'replace'
                      ? 'border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] text-[var(--mineos-general-bright)] font-bold'
                      : 'border-[var(--card-border)] bg-[var(--surface-elevated)]/40 text-[var(--text-secondary)]',
                  )}
                >
                  <span className="block">Dejar solo esta lista</span>
                  <span className="text-[9px] font-normal text-[var(--text-muted)]">
                    Arma la semana exactamente con estos trabajadores
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setApplyMode('merge')}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 text-left text-[11px] transition-all',
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

          <div className="lg:col-span-7 flex flex-col min-h-[280px]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
                Resultado del Emparejamiento ({validIncluded.length} de {resolvedItems.length} líneas)
              </span>
            </div>

            {resolvedItems.length === 0 ? (
              <div className="flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--surface-elevated)]/20 p-8 text-center flex flex-col items-center justify-center gap-2">
                <Users className="h-8 w-8 text-[var(--text-muted)]/40" />
                <p className="text-xs text-[var(--text-muted)]">
                  Pega la lista del supervisor a la izquierda para previsualizar el cruce automático con la base de datos.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[380px] rounded-xl border border-[var(--card-border)] bg-[var(--surface-elevated)]/20 divide-y divide-[var(--card-border)]/60">
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-[var(--text-muted)] bg-zinc-950/60 px-1.5 py-0.5 rounded border border-[var(--card-border)]">
                              “{item.rawLine}”
                            </span>
                            {p ? (
                              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                <CheckCircle2 className="h-3 w-3" />
                                {p.nombre_completo} · {p.cargo} (${p.salario_base})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                                <AlertTriangle className="h-3 w-3" />
                                Sin coincidencia automática
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-bold text-[var(--text-primary)]">
                            {item.estadoAsistencia === 'libre'
                              ? 'Libre'
                              : item.estadoAsistencia === 'no_laborado'
                                ? 'Falta (0d)'
                                : `${item.diasTrabajados} días`}
                          </span>
                          {item.pagoExtra > 0 && (
                            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              +${item.pagoExtra} extra
                            </span>
                          )}
                          {item.bonoTransporteOverride !== undefined && (
                            <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                              Carro ${item.bonoTransporteOverride}
                            </span>
                          )}
                          {item.esNuevoExplicito && (
                            <span className="rounded bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple-300">
                              Nuevo
                            </span>
                          )}
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
                            className="text-[10px] font-semibold text-[var(--text-muted)] hover:text-white px-1.5 py-0.5"
                          >
                            {item.excluded ? 'Incluir' : 'Omitir'}
                          </button>
                        </div>
                      </div>

                      {!item.excluded && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                            {p ? 'Cambiar trabajador:' : 'Asignar trabajador de la base:'}
                          </span>
                          <div className="min-w-[240px] flex-1">
                            <AppSelect
                              value={manualOverrides[item.index] ?? (p?.id || '')}
                              onChange={(val) =>
                                setManualOverrides((prev) => ({ ...prev, [item.index]: val }))
                              }
                              options={workerOptions}
                              placeholder="Buscar en catálogo..."
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
      <PageFormModalFooter className="mt-5 flex justify-end gap-2.5 border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={onClose}
          className={cn(mineosBtnSubtleClass('neutral'), 'h-9 px-4 text-xs font-bold')}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={validIncluded.length === 0}
          className={cn(
            MINEOS_BTN_NOMINA_PRIMARY,
            'h-9 px-4 text-xs font-bold disabled:opacity-40',
          )}
        >
          Aplicar {validIncluded.length} trabajador{validIncluded.length === 1 ? '' : 'es'} a la nómina
        </button>
      </PageFormModalFooter>
    </PageFormModal>
  );
}
