'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageFormModal } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { useBiblioteca, useBibliotecaOptions } from '@/contexts/biblioteca-context';
import {
  areaNominaLabel,
  displayNombrePersonal,
  formatNombrePropio,
  getEstadoLaboral,
  getUbicacionLaboralLabel,
  isAsignacionNominaValid,
  normalizeCedula,
  searchPersonalMaster,
} from '@/lib/personal-master';
import {
  assignPersonalToNominaAreaAction,
  createAndAssignPersonalNominaAction,
} from '@/lib/actions/nomina-v3';
import type { PerfilCompensacion, Personal } from '@/lib/types';
import {
  estadoObservadoOpcionesPorEsquema,
  fechaInicioRotacionDesdeEstadoObservado,
} from '@/lib/nomina/perfil-ciclo-reglas';

type Props = {
  open: boolean;
  onClose: () => void;
  area: 'administracion' | 'mina' | 'planta' | 'seguridad' | 'transporte';
  masterCatalog: Personal[];
  perfilesCompensacion: PerfilCompensacion[];
  assignedIds: Set<string>;
  onAssigned: (personalId: string, areaDetalle: string, createdPersonal?: Personal) => void;
  preselectedPersonalId?: string | null;
  /** Asignaciones actuales de los trabajadores ya cargados (personalId -> areaDetalle) */
  currentAssignments?: Record<string, string>;
};

type Mode = 'search' | 'create';

const EMPTY_CREATE = {
  nombre_completo: '',
  cedula: '',
  cargo: '',
  perfil_compensacion_id: '',
  salario_base: '',
  salario_libre: '',
  bono_transporte: '',
  fecha_nacimiento: '',
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  ajuste_antiguedad_dias: '0',
  ubicacion_laboral: '',
  notas: '',
  rotacion_inicio_fecha: '',
  rotacion_estado_referencia_semana: new Date().toISOString().slice(0, 10),
  rotacion_estado_referencia_posicion: '',
};

function workerProfileReady(p: Personal): { ok: true } | { ok: false; message: string } {
  if (!p.perfil_compensacion_id) {
    return {
      ok: false,
      message: 'Falta perfil de compensación. Complétalo en la ficha o créala aquí con «Nuevo».',
    };
  }
  if (!p.salario_base || Number(p.salario_base) <= 0) {
    return {
      ok: false,
      message: 'Falta sueldo base. Complétalo en la ficha o créala aquí con «Nuevo».',
    };
  }
  return { ok: true };
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function PersonalQuickAssignModal({
  open,
  onClose,
  area,
  masterCatalog,
  perfilesCompensacion,
  assignedIds,
  onAssigned,
  preselectedPersonalId,
  currentAssignments,
}: Props) {
  const biblioteca = useBiblioteca();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Personal | null>(null);
  const [asignacionNomina, setAsignacionNomina] = useState('');
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const asignacionBiblioteca = useBibliotecaOptions('asignacion_nomina');

  const asignacionOptions = useMemo(
    () => asignacionBiblioteca.map((opt) => ({ value: opt.value, label: opt.label })),
    [asignacionBiblioteca],
  );

  const perfilOptions = useMemo(
    () => perfilesCompensacion.map((p) => ({ value: p.id, label: p.nombre })),
    [perfilesCompensacion],
  );
  const selectedCreatePerfil = useMemo(
    () => perfilesCompensacion.find((p) => p.id === createForm.perfil_compensacion_id) ?? null,
    [perfilesCompensacion, createForm.perfil_compensacion_id],
  );
  const createPerfilTieneRotacion =
    !!selectedCreatePerfil &&
    selectedCreatePerfil.esquema_rotacion_default !== 'FIJO_SEMANAL' &&
    selectedCreatePerfil.esquema_rotacion_default !== 'MOLINO_FIJO';
  const rotacionEstadoOptions = useMemo(
    () =>
      selectedCreatePerfil
        ? estadoObservadoOpcionesPorEsquema(selectedCreatePerfil.esquema_rotacion_default).map((o) => ({
            value: String(o.posicion),
            label: o.label,
          }))
        : [],
    [selectedCreatePerfil],
  );
  const rotacionInicioDeducido = useMemo(() => {
    if (
      !createPerfilTieneRotacion ||
      !selectedCreatePerfil ||
      !createForm.rotacion_estado_referencia_semana ||
      createForm.rotacion_estado_referencia_posicion === ''
    ) {
      return '';
    }
    return (
      fechaInicioRotacionDesdeEstadoObservado(
        createForm.rotacion_estado_referencia_semana,
        selectedCreatePerfil.esquema_rotacion_default,
        Number(createForm.rotacion_estado_referencia_posicion),
      ) ?? ''
    );
  }, [
    createPerfilTieneRotacion,
    selectedCreatePerfil,
    createForm.rotacion_estado_referencia_semana,
    createForm.rotacion_estado_referencia_posicion,
  ]);

  const asignacionOk = (v: string) => isAsignacionNominaValid(v, biblioteca);

  const searchableCatalog = useMemo(() => masterCatalog, [masterCatalog]);

  const hits = useMemo(
    () => searchPersonalMaster(query, searchableCatalog, 8).map((h) => ({
      ...h,
      isAssigned: assignedIds.has(h.person.id),
    })),
    [query, searchableCatalog, assignedIds],
  );

  const profileCheck = useMemo(
    () => (selected ? workerProfileReady(selected) : null),
    [selected],
  );

  const statusLabel = useMemo(() => {
    if (mode === 'create') {
      if (!createForm.nombre_completo.trim() || !createForm.cedula.trim()) {
        return { tone: 'idle' as const, text: 'Complete la ficha y la asignación para registrar al trabajador.' };
      }
      if (!createForm.perfil_compensacion_id || !createForm.salario_base) {
        return { tone: 'idle' as const, text: 'Indique perfil de compensación y sueldo base semanal.' };
      }
      if (!asignacionOk(asignacionNomina)) {
        return { tone: 'idle' as const, text: 'Seleccione la asignación nómina para esta semana.' };
      }
      return { tone: 'ready' as const, text: 'Listo para crear la ficha y agregarla a esta nómina.' };
    }

    if (!selected) {
      if (query.trim().length >= 2 && hits.length === 0) {
        return {
          tone: 'empty' as const,
          text: 'Sin coincidencias en Base de Trabajadores. Use la pestaña «Nuevo» para crear la ficha aquí.',
        };
      }
      return {
        tone: 'idle' as const,
        text: 'Busque en Base de Trabajadores y elija la asignación para esta semana.',
      };
    }
    if (assignedIds.has(selected.id)) {
      return { tone: 'here' as const, text: 'Este trabajador ya está en la nómina de esta semana.' };
    }
    if (selected.area !== area) {
      return {
        tone: 'move' as const,
        text: `Viene de ${areaNominaLabel(selected.area)}. Se moverá a ${areaNominaLabel(area)} al confirmar.`,
      };
    }
    if (assignedIds.has(selected.id)) {
      if (!asignacionOk(asignacionNomina)) {
        return { tone: 'idle' as const, text: 'Seleccione la asignación (vertical/sector) para esta semana.' };
      }
      const currentDetalle = currentAssignments?.[selected.id];
      if (currentDetalle && asignacionNomina === currentDetalle) {
        return {
          tone: 'here' as const,
          text: 'Este trabajador ya está en la nómina con esa asignación. Cambie el sector para actualizar.',
        };
      }
      return {
        tone: 'ready' as const,
        text: 'Se actualizará la asignación de este trabajador para esta semana.',
      };
    }
    if (!asignacionOk(asignacionNomina)) {
      return { tone: 'idle' as const, text: 'Seleccione la asignación (vertical/sector) para esta semana.' };
    }
    return { tone: 'ready' as const, text: 'Listo para vincular con la asignación indicada.' };
  }, [
    mode,
    selected,
    query,
    hits.length,
    assignedIds,
    area,
    asignacionNomina,
    biblioteca,
    createForm,
  ]);

  useEffect(() => {
    if (!open) return;
    setMode('search');
    setQuery('');
    setSelected(null);
    setAsignacionNomina('');
    setCreateForm(EMPTY_CREATE);
    setShowSuggestions(false);
    setError(null);
    setHighlight(0);

    // Si se abre para reasignar un trabajador ya cargado, preseleccionarlo.
    if (preselectedPersonalId) {
      const person = masterCatalog.find((p) => p.id === preselectedPersonalId);
      if (person) {
        setSelected(person);
        setQuery(displayNombrePersonal(person));
        const currentDetalle = currentAssignments?.[person.id];
        if (currentDetalle && isAsignacionNominaValid(currentDetalle, biblioteca)) {
          setAsignacionNomina(currentDetalle);
        }
      }
    }

    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, area, preselectedPersonalId, masterCatalog, currentAssignments, biblioteca]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function pickPerson(person: Personal) {
    setSelected(person);
    setQuery(displayNombrePersonal(person));
    const currentDetalle = currentAssignments?.[person.id];
    if (currentDetalle && isAsignacionNominaValid(currentDetalle, biblioteca)) {
      setAsignacionNomina(currentDetalle);
    } else {
      setAsignacionNomina('');
    }
    setShowSuggestions(false);
    setError(null);
  }

  function clearSelection() {
    setSelected(null);
    setAsignacionNomina('');
    setQuery('');
    setShowSuggestions(false);
    searchRef.current?.focus();
  }

  useEffect(() => {
    if (mode !== 'search') return;
    const q = query.trim();
    if (q.length < 3) return;
    const qCed = normalizeCedula(q);
    if (qCed.length < 5) return;
    const exact = searchableCatalog.find((p) => normalizeCedula(p.cedula || '') === qCed);
    if (exact && selected?.id !== exact.id) {
      pickPerson(exact);
    }
  }, [query, searchableCatalog, selected?.id, mode]);

  function finishAssign(
    personalId: string,
    areaDetalle: string,
    message: string,
    createdPersonal?: Personal,
  ) {
    toast.success(message);
    onAssigned(personalId, areaDetalle, createdPersonal || selected || undefined);
    onClose();
  }

  async function assignExisting() {
    setError(null);
    if (!selected) {
      setError('Selecciona un trabajador de la lista.');
      return;
    }
    if (!asignacionOk(asignacionNomina)) {
      setError('Selecciona una asignación nómina (vertical/sector).');
      return;
    }
    if (assignedIds.has(selected.id) && asignacionNomina === (currentAssignments?.[selected.id] || '')) {
      setError('La asignación es igual a la actual. Cambia el sector para actualizar.');
      return;
    }
    const check = workerProfileReady(selected);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    setIsSaving(true);
    try {
      const res = await assignPersonalToNominaAreaAction({
        personalId: selected.id,
        targetArea: area,
        areaDetalle: asignacionNomina,
      });
      if (!res.ok) {
        setError(res.message);
        toast.error(res.message);
        return;
      }
      finishAssign(selected.id, asignacionNomina, res.message, selected);
    } catch (err: any) {
      console.error('[PersonalQuickAssignModal] assignExisting error:', err);
      const msg = err?.message || 'Error al asignar trabajador.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  async function createNew() {
    setError(null);
    if (!createForm.nombre_completo.trim() || !createForm.cedula.trim()) {
      setError('Nombre y cédula son obligatorios.');
      return;
    }
    if (!createForm.perfil_compensacion_id) {
      setError('Selecciona un perfil de compensación.');
      return;
    }
    if (!createForm.salario_base || Number(createForm.salario_base) <= 0) {
      setError('Indica un sueldo base semanal mayor a 0.');
      return;
    }
    if (!asignacionOk(asignacionNomina)) {
      setError('Selecciona una asignación nómina (vertical/sector).');
      return;
    }

    setIsSaving(true);
    try {
      const res = await createAndAssignPersonalNominaAction({
        cedula: createForm.cedula.trim(),
        nombre_completo: createForm.nombre_completo.trim(),
        cargo: createForm.cargo.trim(),
        targetArea: area,
        areaDetalle: asignacionNomina,
        perfil_compensacion_id: createForm.perfil_compensacion_id,
        salario_base: Number(createForm.salario_base),
        salario_libre: createForm.salario_libre ? Number(createForm.salario_libre) : 0,
        bono_transporte: createForm.bono_transporte ? Number(createForm.bono_transporte) : 0,
        rotacion_inicio_fecha: createForm.rotacion_inicio_fecha || null,
        rotacion_estado_referencia_semana: createForm.rotacion_estado_referencia_semana || null,
        rotacion_estado_referencia_posicion:
          createForm.rotacion_estado_referencia_posicion === ''
            ? null
            : Number(createForm.rotacion_estado_referencia_posicion),
        fecha_nacimiento: createForm.fecha_nacimiento || null,
        fecha_ingreso: createForm.fecha_ingreso || null,
        ajuste_antiguedad_dias: Number(createForm.ajuste_antiguedad_dias || 0),
        ubicacion_laboral: createForm.ubicacion_laboral.trim(),
        notas: createForm.notas.trim(),
      });
      if (!res.ok || !res.personalId) {
        setError(res.message);
        toast.error(res.message);
        return;
      }
      finishAssign(
        res.personalId,
        asignacionNomina,
        res.message,
        (res as any).data?.personal as Personal | undefined,
      );
    } catch (err: any) {
      console.error('[PersonalQuickAssignModal] createNew error:', err);
      const msg = err?.message || 'Error al crear trabajador.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  function submit() {
    if (mode === 'create') createNew();
    else assignExisting();
  }

  const statusColors = {
    idle: 'border-zinc-700 bg-zinc-900/60 text-white/55',
    empty: 'border-amber-500/25 bg-amber-500/10 text-amber-200/90',
    here: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90',
    move: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200/90',
    ready: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90',
  };

  const canSubmit =
    mode === 'create'
      ? Boolean(
          createForm.nombre_completo.trim() &&
            createForm.cedula.trim() &&
            createForm.perfil_compensacion_id &&
            Number(createForm.salario_base) > 0 &&
            asignacionOk(asignacionNomina),
        )
      : Boolean(
          selected &&
            profileCheck?.ok &&
            asignacionOk(asignacionNomina) &&
            (!assignedIds.has(selected.id) ||
              asignacionNomina !== (currentAssignments?.[selected.id] || '')),
        );

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="!flex !h-auto !max-h-[min(92dvh,calc(100dvh-2rem))] !w-full !max-w-3xl !flex-col !overflow-hidden !p-0"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="shrink-0 border-b border-zinc-800/80 p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Trabajador</h3>
              <p className="mt-1 text-xs text-white/45">
                Busque en Base de Trabajadores o cree una ficha nueva y asígnela a esta semana.
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('search');
                setError(null);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${
                mode === 'search' ? 'bg-amber-500/15 text-amber-300' : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setError(null);
                setSelected(null);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${
                mode === 'create' ? 'bg-amber-500/15 text-amber-300' : 'text-white/45 hover:text-white/70'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Nuevo
            </button>
          </div>

          {mode === 'search' && (
            <div className="relative mt-4">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-amber-500/80" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                    if (selected && e.target.value !== displayNombrePersonal(selected)) {
                      setSelected(null);
                      setAsignacionNomina('');
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Buscar por cédula, nombre o apellido…"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (showSuggestions) setShowSuggestions(false);
                      else onClose();
                      return;
                    }
                    if (!showSuggestions || hits.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlight((i) => Math.min(i + 1, hits.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlight((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      pickPerson(hits[highlight].person);
                    }
                  }}
                />
                {selected && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/40 hover:text-white/70"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {showSuggestions && query.trim().length >= 2 && hits.length > 0 && (
                <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                  {hits.map(({ person, reason, isAssigned }, index) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickPerson(person);
                        }}
                        onClick={() => pickPerson(person)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left ${
                          index === highlight ? 'bg-amber-500/15' : 'hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-white">{displayNombrePersonal(person)}</span>
                          <span className="text-[11px] text-white/45">
                            CI {person.cedula} · {getUbicacionLaboralLabel(person)} · {areaNominaLabel(person.area)}
                            {reason === 'cedula-exact' && ' · cédula exacta'}
                          </span>
                        </div>
                        {isAssigned && (
                          <span className="ml-2 shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200/90">
                            Ya en esta semana
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 overscroll-contain">
          {error && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <p
            className={`mb-4 rounded-lg border px-3 py-2 text-xs leading-relaxed ${statusColors[statusLabel.tone]}`}
          >
            {statusLabel.text}
          </p>

          <div className="mb-4">
            <label className="input-label">Asignación Nómina (Vertical / Sector) *</label>
            <AppSelect
              value={asignacionNomina}
              onChange={setAsignacionNomina}
              options={asignacionOptions}
              placeholder="Seleccionar asignación para esta semana"
            />
            <p className="mt-1 text-[10px] text-white/35">
              Obligatorio en cada carga. No se reutiliza la asignación anterior del trabajador.
            </p>
          </div>

          {mode === 'create' ? (
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Nueva ficha</p>
              <div>
                <label className="input-label">Nombre y apellido *</label>
                <input
                  className="input-field"
                  value={createForm.nombre_completo}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, nombre_completo: e.target.value }))
                  }
                  placeholder="Ej: Alexander Villasmil"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="input-label">Cédula *</label>
                  <input
                    className="input-field"
                    value={createForm.cedula}
                    onChange={(e) => setCreateForm((f) => ({ ...f, cedula: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="input-label">Cargo</label>
                  <input
                    className="input-field"
                    value={createForm.cargo}
                    onChange={(e) => setCreateForm((f) => ({ ...f, cargo: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="input-label">Fecha de nacimiento</label>
                  <AppDatePicker
                    value={createForm.fecha_nacimiento}
                    onChange={(v) => setCreateForm((f) => ({ ...f, fecha_nacimiento: v }))}
                  />
                </div>
                <div>
                  <label className="input-label">Fecha de ingreso</label>
                  <AppDatePicker
                    value={createForm.fecha_ingreso}
                    onChange={(v) => setCreateForm((f) => ({ ...f, fecha_ingreso: v }))}
                  />
                </div>
                <div>
                  <label className="input-label">Ajuste antigüedad (días)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={createForm.ajuste_antiguedad_dias}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, ajuste_antiguedad_dias: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="input-label">Área / sitio laboral</label>
                  <input
                    className="input-field"
                    value={createForm.ubicacion_laboral}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, ubicacion_laboral: e.target.value }))
                    }
                    placeholder={biblioteca.ubicacionDefaultPorArea[area] || 'Opcional'}
                  />
                </div>
              </div>
              <div>
                <label className="input-label">Perfil de compensación *</label>
                {perfilOptions.length ? (
                  <AppSelect
                    value={createForm.perfil_compensacion_id}
                    onChange={(v) => setCreateForm((f) => ({ ...f, perfil_compensacion_id: v }))}
                    options={perfilOptions}
                    placeholder="Seleccionar perfil"
                  />
                ) : (
                  <p className="text-xs text-amber-300/90">No hay perfiles activos. Configúrelos en administración.</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="input-label">Sueldo base semanal (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={createForm.salario_base}
                    onChange={(e) => setCreateForm((f) => ({ ...f, salario_base: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="input-label">Sueldo libre / tarifa plana</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={createForm.salario_libre}
                    onChange={(e) => setCreateForm((f) => ({ ...f, salario_libre: e.target.value }))}
                    placeholder="Vacío = sueldo base"
                  />
                </div>
                <div>
                  <label className="input-label">Bono transporte</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={createForm.bono_transporte}
                    onChange={(e) => setCreateForm((f) => ({ ...f, bono_transporte: e.target.value }))}
                  />
                </div>
                {createPerfilTieneRotacion ? (
                  <div className="sm:col-span-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-elevated)] p-3">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">Asistente de rotación</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                      Indica una semana conocida y el estado observado. MineOS deduce el inicio del ciclo.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="input-label">Semana de referencia</label>
                        <AppDatePicker
                          value={createForm.rotacion_estado_referencia_semana}
                          onChange={(v) =>
                            setCreateForm((f) => ({
                              ...f,
                              rotacion_estado_referencia_semana: v,
                              rotacion_inicio_fecha: '',
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="input-label">Estado observado</label>
                        <AppSelect
                          value={createForm.rotacion_estado_referencia_posicion}
                          onChange={(v) =>
                            setCreateForm((f) => ({
                              ...f,
                              rotacion_estado_referencia_posicion: v,
                              rotacion_inicio_fecha: '',
                            }))
                          }
                          options={rotacionEstadoOptions}
                          placeholder="Seleccionar estado"
                        />
                      </div>
                    </div>
                    <div className="mt-3 rounded-md border border-[var(--card-border)] bg-black/10 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                      Inicio deducido:{' '}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {rotacionInicioDeducido || createForm.rotacion_inicio_fecha || 'pendiente'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              <div>
                <label className="input-label">Observación general</label>
                <textarea
                  className="input-field h-20 resize-none text-xs"
                  value={createForm.notas}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notas: e.target.value }))}
                  placeholder="Notas internas sobre el trabajador"
                />
              </div>
            </div>
          ) : (
            selected && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Ficha en Base de Trabajadores
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="col-span-2">
                    <dt className="text-[10px] text-white/40">Nombre</dt>
                    <dd className="font-semibold text-white">{displayNombrePersonal(selected)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-white/40">Cédula</dt>
                    <dd className="text-white/80">{selected.cedula}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-white/40">Estado</dt>
                    <dd className="text-white/80">{getEstadoLaboral(selected)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-white/40">Cargo</dt>
                    <dd className="text-white/80">{selected.cargo || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-white/40">Nómina actual</dt>
                    <dd className="text-white/80">{areaNominaLabel(selected.area)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-white/40">Sueldo base</dt>
                    <dd className="tabular-nums text-white/80">
                      {selected.salario_base ? fmtMoney(Number(selected.salario_base)) : '—'}
                    </dd>
                  </div>
                </dl>

                {profileCheck && !profileCheck.ok && (
                  <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <p className="text-xs text-amber-200">{profileCheck.message}</p>
                    <button
                      type="button"
                      onClick={() => setMode('create')}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
                    >
                      <Plus className="h-3 w-3" />
                      Completar con pestaña Nuevo
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-800/80 p-5 pt-4">
          <button
            type="button"
            onClick={submit}
            disabled={isSaving || !canSubmit}
            className="btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'create'
              ? 'Crear y agregar a nómina'
              : selected && assignedIds.has(selected.id)
                ? 'Actualizar asignación'
                : 'Asignar a esta nómina'}
          </button>
        </div>
      </div>
    </PageFormModal>
  );
}
