'use client';

import { useReducer, useState, useTransition, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  LayoutGrid,
  Loader2,
} from 'lucide-react';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppCheckbox } from '@/components/ui/AppCheckbox';
import { AppSelect, type AppSelectOption } from '@/components/ui/AppSelect';
import { RotacionPlantillaPreview, ESTATUS_ROTACION_OPCIONES } from '@/components/nomina/RotacionPlantillaPreview';
import { useBibliotecaOptions } from '@/contexts/biblioteca-context';
import {
  PLANTILLA_COLUMNAS_CATALOGO,
  normalizeColumnasVista,
  type PlantillaColumnaKey,
} from '@/lib/rotacion-plantillas/columnas-vista';
import {
  createEmptySandbox,
  sandboxReducer,
  validateSandbox,
  copyModelStructure,
  PRESET_PLANTILLA_OPCIONES,
  presetPlantilla,
} from '@/lib/rotacion-plantillas/sandbox-state';
import {
  saveRotacionPlantillaAction,
  listRotacionPlantillasAction,
} from '@/lib/actions/rotacion-plantillas';
import {
  mineosBtnSubtleClass,
  mineosLabelAccent,
  mineosModalHeading,
  mineosPanel,
  MINEOS_BTN_NOMINA_PRIMARY,
  mineosIcon,
} from '@/lib/mineos-visual';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  area: string;
  canEdit: boolean;
  initialPlantillaId?: string;
  onSaved?: () => void;
};

export function RotacionPlantillaSandboxModal({
  open,
  onClose,
  area,
  canEdit,
  initialPlantillaId,
  onSaved,
}: Props) {
  const [sandbox, dispatch] = useReducer(sandboxReducer, area, createEmptySandbox);
  const [editId, setEditId] = useState<string | undefined>();
  const [savedPlantillas, setSavedPlantillas] = useState<RotacionPlantillaRecord[]>([]);
  const [modelCopyKey, setModelCopyKey] = useState('');
  const [pending, startTransition] = useTransition();
  const [selectedCuadrillaId, setSelectedCuadrillaId] = useState<string>('');

  const asignacionOptions = useBibliotecaOptions('asignacion_nomina');

  const cuadrillaActiva = useMemo(() => {
    const found = sandbox.cuadrillas.find((c) => c.id === selectedCuadrillaId);
    return found ?? sandbox.cuadrillas[0] ?? null;
  }, [sandbox.cuadrillas, selectedCuadrillaId]);

  useEffect(() => {
    if (!cuadrillaActiva) return;
    if (!selectedCuadrillaId || !sandbox.cuadrillas.some((c) => c.id === selectedCuadrillaId)) {
      setSelectedCuadrillaId(cuadrillaActiva.id);
    }
  }, [cuadrillaActiva, selectedCuadrillaId, sandbox.cuadrillas]);

  const asignacionSelectOptions = useMemo(
    () => [
      { value: '', label: '— Asignación nómina (opcional) —' },
      ...asignacionOptions,
    ],
    [asignacionOptions],
  );

  const estatusSelectOptions = useMemo(
    () => ESTATUS_ROTACION_OPCIONES.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const list = await listRotacionPlantillasAction(area);
      setSavedPlantillas(list);
      if (initialPlantillaId) {
        const target = list.find((p) => p.id === initialPlantillaId);
        if (target) {
          dispatch({
            type: 'LOAD',
            payload: {
              ...target,
              cuadrillas: target.cuadrillas.map((c) => ({ ...c, filas: [] })),
            },
          });
          setEditId(target.id);
          setSelectedCuadrillaId(target.cuadrillas[0]?.id ?? '');
        }
      }
    });
  }, [open, area, initialPlantillaId]);

  const modelCopyOptions = useMemo(() => {
    const opts: AppSelectOption[] = [
      { value: '__hdr_std', label: '— Estandarizados —' },
      ...PRESET_PLANTILLA_OPCIONES.map((p) => ({
        value: `preset:${p.key}`,
        label: p.label,
      })),
    ];
    const guardadas = savedPlantillas.filter((p) => p.id !== editId);
    if (guardadas.length) {
      opts.push({ value: '__hdr_saved', label: '— Plantillas guardadas —' });
      opts.push(
        ...guardadas.map((p) => ({
          value: `saved:${p.id}`,
          label: p.nombre,
        })),
      );
    }
    return opts;
  }, [savedPlantillas, editId]);

  function handleSave() {
    const err = validateSandbox(sandbox);
    if (err) {
      toast.error(err);
      return;
    }
    const sandboxSinPersonal = {
      ...sandbox,
      cuadrillas: sandbox.cuadrillas.map((c) => ({ ...c, filas: [] })),
    };
    startTransition(async () => {
      const res = await saveRotacionPlantillaAction(sandboxSinPersonal, editId);
      if (res.ok) {
        toast.success(res.message);
        onSaved?.();
        handleClose();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleCopyModel(value: string) {
    setModelCopyKey('');
    if (!value || value.startsWith('__')) return;

    let source = null as ReturnType<typeof presetPlantilla> | RotacionPlantillaRecord | null;
    if (value.startsWith('preset:')) {
      const tipo = value.slice('preset:'.length) as (typeof PRESET_PLANTILLA_OPCIONES)[number]['key'];
      if (PRESET_PLANTILLA_OPCIONES.some((p) => p.key === tipo)) {
        source = presetPlantilla(tipo, area);
      }
    } else if (value.startsWith('saved:')) {
      const id = value.slice('saved:'.length);
      source = savedPlantillas.find((p) => p.id === id) ?? null;
    }
    if (!source) return;

    const next = copyModelStructure(sandbox, source);
    dispatch({ type: 'COPY_MODEL', payload: source });
    setSelectedCuadrillaId(next.cuadrillas[0]?.id ?? '');
    toast.success('Estructura del modelo aplicada (nombre y descripción sin cambios).');
  }

  function handleClose() {
    dispatch({ type: 'RESET', payload: { area } });
    setEditId(undefined);
    setModelCopyKey('');
    setSelectedCuadrillaId('');
    onClose();
  }

  const cuadrillaId = cuadrillaActiva?.id;

  const columnasActivas = useMemo(
    () => normalizeColumnasVista(cuadrillaActiva?.columnasVista ?? sandbox.columnasVista),
    [cuadrillaActiva?.columnasVista, sandbox.columnasVista],
  );

  function toggleColumna(key: PlantillaColumnaKey, checked: boolean) {
    if (!cuadrillaId) return;
    const next = checked
      ? [...columnasActivas, key]
      : columnasActivas.filter((k) => k !== key);
    if (!next.length) {
      toast.error('Debe quedar al menos una columna visible.');
      return;
    }
    dispatch({ type: 'SET_CUADRILLA_COLUMNAS', payload: { id: cuadrillaId, columnasVista: next } });
  }

  return (
    <PageFormModal
      open={open}
      onClose={handleClose}
      panelClassName="max-w-[min(98vw,100rem)] w-full max-h-[94vh] flex flex-col p-0 overflow-hidden sm:max-w-[min(98vw,100rem)]"
      sheetTitle={editId ? 'Editar plantilla de rotación' : 'Nueva plantilla de rotación'}
      sheetIcon={<LayoutGrid className={cn('h-5 w-5', mineosIcon('general'))} />}
    >
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex max-h-[45vh] min-h-0 flex-col border-b border-[var(--card-border)] bg-[var(--card-bg)] lg:max-h-none lg:w-[min(440px,34%)] lg:shrink-0 lg:border-b-0 lg:border-r lg:border-[var(--card-border)]">
          <div className="shrink-0 border-b border-[var(--card-border)] px-4 py-3">
            <h2 className={mineosModalHeading('general')}>
              <LayoutGrid className={cn('h-4 w-4', mineosIcon('general'))} />
              Configuración de plantilla
            </h2>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Cuadrillas, semanas y columnas visibles de la planilla.
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            <div className={cn(mineosPanel('neutral'), '!p-2.5')}>
              <label className={cn('mb-2 block text-[10px] font-bold uppercase', mineosLabelAccent('general'))}>
                Nombre plantilla
              </label>
              <input
                value={sandbox.nombre}
                onChange={(e) => dispatch({ type: 'SET_META', payload: { nombre: e.target.value } })}
                disabled={!canEdit}
                placeholder="Ej: Mina Belén — Rotación completa"
                className="input-field w-full text-sm"
              />
            </div>

            <div className={cn(mineosPanel('neutral'), '!mt-1 !p-2.5')}>
              <label className={cn('mb-2 block text-[10px] font-bold uppercase', mineosLabelAccent('general'))}>
                Descripción de plantilla
              </label>
              <textarea
                value={sandbox.descripcion}
                onChange={(e) => dispatch({ type: 'SET_META', payload: { descripcion: e.target.value } })}
                disabled={!canEdit}
                rows={3}
                placeholder="Ej: 2 semanas trabajadas, 1 semana libre pagada…"
                className="input-field w-full resize-none text-sm"
              />
            </div>

            <div className={cn(mineosPanel('neutral'), '!p-2')}>
              <span className={cn('mb-1.5 block text-[9px] font-bold uppercase', mineosLabelAccent('neutral'))}>
                {cuadrillaActiva ? `Columnas — ${cuadrillaActiva.nombre}` : 'Columnas planilla'}
              </span>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {PLANTILLA_COLUMNAS_CATALOGO.map((col) => (
                  <AppCheckbox
                    key={col.key}
                    size="sm"
                    checked={columnasActivas.includes(col.key)}
                    disabled={!canEdit}
                    onChange={(checked) => toggleColumna(col.key, checked)}
                    className="text-[10px] leading-tight"
                  >
                    <span className="truncate">{col.label}</span>
                  </AppCheckbox>
                ))}
              </div>
            </div>

            {canEdit && (
              <div>
                <label className={cn('mb-1.5 block text-[10px] font-bold uppercase', mineosLabelAccent('general'))}>
                  Copiar modelo de plantilla
                </label>
                <AppSelect
                  value={modelCopyKey}
                  onChange={handleCopyModel}
                  options={modelCopyOptions}
                  placeholder="Seleccionar modelo…"
                />
              </div>
            )}

            {/* Cuadrillas */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={cn('text-[10px] font-bold uppercase', mineosLabelAccent('neutral'))}>
                  Cuadrillas / secciones
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'ADD_CUADRILLA' })}
                    className={cn(mineosBtnSubtleClass('general'), 'text-[10px]')}
                  >
                    <Plus className="h-3.5 w-3.5" /> Cuadrilla
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sandbox.cuadrillas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCuadrillaId(c.id)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                      c.id === cuadrillaId
                        ? 'border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] text-[var(--mineos-general-bright)]'
                        : 'border-[var(--card-border)] text-[var(--text-muted)] hover:border-[var(--mineos-general-border)]',
                    )}
                  >
                    {c.nombre}
                    <span className="ml-1 opacity-60">({c.filas.length})</span>
                  </button>
                ))}
              </div>
            </div>

            {cuadrillaActiva && cuadrillaId && (
              <>
                <div className={cn(mineosPanel('neutral'), 'space-y-2 !p-2.5')}>
                  <label className={cn('block text-[10px] font-bold uppercase', mineosLabelAccent('neutral'))}>
                    Cuadrilla activa
                  </label>
                  <input
                    value={cuadrillaActiva.nombre}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_CUADRILLA',
                        payload: { id: cuadrillaId, nombre: e.target.value },
                      })
                    }
                    disabled={!canEdit}
                    className="input-field w-full text-xs"
                  />
                  <AppSelect
                    value={cuadrillaActiva.asignacionKey}
                    onChange={(v) =>
                      dispatch({
                        type: 'UPDATE_CUADRILLA',
                        payload: { id: cuadrillaId, asignacionKey: v },
                      })
                    }
                    disabled={!canEdit}
                    options={asignacionSelectOptions}
                    placeholder="— Asignación nómina (opcional) —"
                  />
                  {canEdit && sandbox.cuadrillas.length > 1 && (
                    <div className="flex justify-end gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'REORDER_CUADRILLA', payload: { id: cuadrillaId, direction: 'up' } })
                        }
                        className="rounded p-1 text-white/40 hover:text-white"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'REORDER_CUADRILLA', payload: { id: cuadrillaId, direction: 'down' } })
                        }
                        className="rounded p-1 text-white/40 hover:text-white"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatch({ type: 'REMOVE_CUADRILLA', payload: { id: cuadrillaId } });
                          setSelectedCuadrillaId(sandbox.cuadrillas.find((c) => c.id !== cuadrillaId)?.id ?? '');
                        }}
                        className="rounded p-1 text-red-400/70 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className={cn('text-[10px] font-bold uppercase', mineosLabelAccent('neutral'))}>
                      Semanas — {cuadrillaActiva.nombre}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'ADD_SEMANA', payload: { cuadrillaId } })}
                        className={cn(mineosBtnSubtleClass('general'), 'text-[10px]')}
                      >
                        <Plus className="h-3.5 w-3.5" /> Semana
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {cuadrillaActiva.semanas.map((sem) => (
                      <div
                        key={sem.id}
                        className={cn(mineosPanel('neutral'), 'space-y-2 !p-2')}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            value={sem.nombre}
                            onChange={(e) =>
                              dispatch({
                                type: 'UPDATE_SEMANA',
                                payload: { cuadrillaId, id: sem.id, nombre: e.target.value },
                              })
                            }
                            disabled={!canEdit}
                            className="input-field min-w-0 flex-1 text-xs"
                            placeholder="Título columna (ej. Semana Libre)"
                          />
                          {canEdit && (
                            <div className="flex shrink-0 gap-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  dispatch({
                                    type: 'REORDER_SEMANA',
                                    payload: { cuadrillaId, id: sem.id, direction: 'up' },
                                  })
                                }
                                className="rounded p-1 text-white/40 hover:text-white"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  dispatch({
                                    type: 'REORDER_SEMANA',
                                    payload: { cuadrillaId, id: sem.id, direction: 'down' },
                                  })
                                }
                                className="rounded p-1 text-white/40 hover:text-white"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  dispatch({ type: 'REMOVE_SEMANA', payload: { cuadrillaId, id: sem.id } })
                                }
                                className="rounded p-1 text-red-400/70 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <AppSelect
                          value={sem.estatusDefault}
                          onChange={(v) =>
                            dispatch({
                              type: 'UPDATE_SEMANA',
                              payload: {
                                cuadrillaId,
                                id: sem.id,
                                estatusDefault: v as typeof sem.estatusDefault,
                              },
                            })
                          }
                          disabled={!canEdit}
                          options={estatusSelectOptions}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

        <div className="flex min-h-[320px] flex-1 flex-col p-4 lg:min-h-0 lg:min-w-0">
          <RotacionPlantillaPreview sandbox={sandbox} />
        </div>
      </div>

      <PageFormModalFooter className="flex shrink-0 justify-end !gap-2 !border-t !border-[var(--card-border)] !py-1.5 !pt-2 !mt-0 px-3">
        <button type="button" onClick={handleClose} className="btn-secondary h-8 px-3 text-xs">
          Cerrar
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className={cn(MINEOS_BTN_NOMINA_PRIMARY, 'inline-flex h-8 items-center gap-1.5 px-3 text-xs')}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editId ? 'Actualizar plantilla' : 'Guardar plantilla'}
          </button>
        )}
      </PageFormModalFooter>
    </PageFormModal>
  );
}
