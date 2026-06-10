'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  areaNominaLabel,
  ASIGNACION_NOMINA_OPCIONES,
  getAsignacionNomina,
  getUbicacionLaboralLabel,
  isAsignacionNominaValid,
  normalizeCedula,
  searchPersonalMaster,
} from '@/lib/personal-master';
import { upsertPersonalV3Action } from '@/lib/actions/nomina-v3';
import { useBiblioteca } from '@/contexts/biblioteca-context';
import type { PerfilCompensacion, Personal } from '@/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  area: 'administracion' | 'mina' | 'planta' | 'seguridad' | 'transporte';
  masterCatalog: Personal[];
  assignedIds: Set<string>;
  onAssigned: () => void;
};

type FormState = {
  id?: string;
  cedula: string;
  nombre_completo: string;
  cargo: string;
  area_detalle: string;
  perfil_compensacion_id: string;
  salario_base: string;
  bono_transporte: string;
  telefono: string;
  fecha_ingreso: string;
};

function emptyForm(): FormState {
  return {
    cedula: '',
    nombre_completo: '',
    cargo: '',
    area_detalle: '',
    perfil_compensacion_id: '',
    salario_base: '',
    bono_transporte: '',
    telefono: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
  };
}

function resolveAsignacion(person: Personal): string {
  const candidate = getAsignacionNomina(person) || person.area_detalle || '';
  return isAsignacionNominaValid(candidate) ? candidate : '';
}

function personToForm(p: Personal): FormState {
  return {
    id: p.id,
    cedula: p.cedula || '',
    nombre_completo: p.nombre_completo || '',
    cargo: p.cargo || '',
    area_detalle: resolveAsignacion(p),
    perfil_compensacion_id: p.perfil_compensacion_id || '',
    salario_base: String(p.salario_base ?? ''),
    bono_transporte: String(p.bono_transporte ?? ''),
    telefono: p.telefono || '',
    fecha_ingreso: p.fecha_ingreso || new Date().toISOString().split('T')[0],
  };
}

const asignacionOptions = ASIGNACION_NOMINA_OPCIONES.map((value) => ({ value, label: value }));

export function PersonalQuickAssignModal({
  open,
  onClose,
  area,
  masterCatalog,
  assignedIds,
  onAssigned,
}: Props) {
  const biblioteca = useBiblioteca();
  const cargoSuggestions = biblioteca.cargoSuggestions;

  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selected, setSelected] = useState<Personal | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [perfilesCompensacion, setPerfilesCompensacion] = useState<PerfilCompensacion[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadPerfiles() {
      try {
        const { createClient } = await import('@/lib/supabase-client');
        const supabase = createClient();
        const { data, error: loadError } = await supabase
          .from('perfiles_compensacion')
          .select('*')
          .eq('activo', true)
          .order('nombre');
        if (!loadError && data) {
          setPerfilesCompensacion(data);
        }
      } catch (err) {
        console.error('[PersonalQuickAssign] Error loading perfiles:', err);
      }
    }
    if (open) loadPerfiles();
  }, [open]);

  const hits = useMemo(
    () => searchPersonalMaster(query, masterCatalog, 8),
    [query, masterCatalog],
  );

  const enEstaNomina =
    !!selected && assignedIds.has(selected.id) && selected.area === area;

  const statusLabel = useMemo(() => {
    if (!selected && !form.id) {
      if (query.trim().length >= 2 && hits.length === 0) {
        return { tone: 'new' as const, text: 'Sin coincidencias — completa el formulario para un trabajador nuevo.' };
      }
      return { tone: 'new' as const, text: 'Trabajador nuevo en esta nómina.' };
    }
    if (enEstaNomina) {
      return {
        tone: 'here' as const,
        text: 'Ya está en esta nómina. Puedes actualizar cargo, vertical y salarios.',
      };
    }
    if (selected && selected.area !== area) {
      return {
        tone: 'move' as const,
        text: `Viene de ${areaNominaLabel(selected.area)} (${getUbicacionLaboralLabel(selected)}). Se asignará aquí al guardar.`,
      };
    }
    return {
      tone: 'base' as const,
      text: 'Datos cargados desde la base de trabajadores.',
    };
  }, [selected, form.id, query, hits.length, enEstaNomina, area]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setForm(emptyForm());
    setSelected(null);
    setShowSuggestions(false);
    setError(null);
    setHighlight(0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, area]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function pickPerson(person: Personal) {
    setSelected(person);
    setForm(personToForm(person));
    setQuery(person.nombre_completo);
    setShowSuggestions(false);
    setError(null);
  }

  function clearSelection() {
    setSelected(null);
    setForm(emptyForm());
    setQuery('');
    setShowSuggestions(false);
    searchRef.current?.focus();
  }

  // Auto-selección por cédula exacta al escribir
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const qCed = normalizeCedula(q);
    if (qCed.length < 5) return;
    const exact = masterCatalog.find((p) => normalizeCedula(p.cedula || '') === qCed);
    if (exact && selected?.id !== exact.id) {
      pickPerson(exact);
    }
  }, [query, masterCatalog, selected?.id, area]);

  function save() {
    setError(null);
    if (!form.cedula.trim() || !form.nombre_completo.trim() || !form.cargo.trim()) {
      setError('Cédula, nombre y cargo son obligatorios.');
      return;
    }
    if (!form.perfil_compensacion_id) {
      setError('Selecciona un perfil de compensación.');
      return;
    }
    if (!form.area_detalle) {
      setError('Selecciona la asignación nómina (vertical/sector).');
      return;
    }
    if (!form.salario_base || Number(form.salario_base) <= 0) {
      setError('El sueldo base semanal es obligatorio y debe ser mayor a 0.');
      return;
    }

    startTransition(async () => {
      const res = await upsertPersonalV3Action({
        id: form.id,
        cedula: form.cedula.trim(),
        nombre_completo: form.nombre_completo.trim(),
        cargo: form.cargo.trim(),
        area,
        area_detalle: form.area_detalle,
        perfil_compensacion_id: form.perfil_compensacion_id,
        salario_base: Number(form.salario_base),
        bono_transporte: Number(form.bono_transporte) || 0,
        telefono: form.telefono.trim(),
        notas: '',
        fecha_ingreso: form.fecha_ingreso,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onAssigned();
      onClose();
    });
  }

  const statusColors = {
    new: 'border-amber-500/25 bg-amber-500/10 text-amber-200/90',
    here: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90',
    move: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200/90',
    base: 'border-zinc-700 bg-zinc-900/60 text-white/55',
  };

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="!flex !h-auto !max-h-[min(92dvh,calc(100dvh-2rem))] !w-full !max-w-xl !flex-col !overflow-hidden !p-0"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="shrink-0 border-b border-zinc-800/80 p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Asignar trabajador</h3>
              <p className="mt-1 text-xs text-white/45">
                Busca por nombre o cédula, revisa los datos y guárdalos en esta nómina.
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-4">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-amber-500/80" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                  if (!selected) {
                    setForm((prev) => ({ ...prev, nombre_completo: e.target.value }));
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
              {(selected || form.id) && (
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
              <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                {hits.map(({ person, reason }, index) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onTouchStart={(e) => {
                        e.preventDefault();
                        pickPerson(person);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickPerson(person);
                      }}
                      onClick={() => pickPerson(person)}
                      className={`flex w-full flex-col rounded-md px-3 py-2 text-left ${
                        index === highlight ? 'bg-amber-500/15' : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-sm font-semibold text-white">{person.nombre_completo}</span>
                      <span className="text-[11px] text-white/45">
                        CI {person.cedula} · {getUbicacionLaboralLabel(person)}
                        {reason === 'cedula-exact' && ' · cédula exacta'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="input-label">Nombre completo *</label>
              <input
                className="input-field"
                value={form.nombre_completo}
                onChange={(e) => setForm((p) => ({ ...p, nombre_completo: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">Cédula *</label>
              <input
                className="input-field"
                value={form.cedula}
                onChange={(e) => setForm((p) => ({ ...p, cedula: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">Cargo *</label>
              <input
                className="input-field"
                list="quick-assign-cargo-options"
                placeholder="Capataz, Palero…"
                value={form.cargo}
                onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))}
              />
              <datalist id="quick-assign-cargo-options">
                {cargoSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="col-span-2">
              <label className="input-label">Asignación Nómina (Vertical/Sector) *</label>
              <AppSelect
                value={form.area_detalle}
                onChange={(val) => setForm((p) => ({ ...p, area_detalle: val }))}
                options={asignacionOptions}
                placeholder="Seleccionar vertical/sector"
              />
            </div>
            <div className="col-span-2">
              <label className="input-label">Perfil de Compensación *</label>
              <AppSelect
                value={form.perfil_compensacion_id}
                onChange={(val) => setForm((p) => ({ ...p, perfil_compensacion_id: val }))}
                options={perfilesCompensacion.map((p) => ({ value: p.id, label: p.nombre }))}
                placeholder="Seleccionar perfil"
              />
              <p className="mt-1 text-[10px] text-white/35">
                Define esquema de rotación y reglas de pago. No editable manualmente.
              </p>
            </div>
            <div>
              <label className="input-label">Sueldo Base Semanal (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={form.salario_base}
                onChange={(e) => setForm((p) => ({ ...p, salario_base: e.target.value }))}
                placeholder="Ej: 100.00"
              />
            </div>
            <div>
              <label className="input-label">Bono Transporte (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={form.bono_transporte}
                onChange={(e) => setForm((p) => ({ ...p, bono_transporte: e.target.value }))}
                placeholder="Ej: 20.00"
              />
            </div>
            <div>
              <label className="input-label">Teléfono</label>
              <input
                className="input-field"
                value={form.telefono}
                onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">Fecha ingreso</label>
              <input
                type="date"
                className="input-field"
                value={form.fecha_ingreso}
                onChange={(e) => setForm((p) => ({ ...p, fecha_ingreso: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-800/80 p-5 pt-4">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {enEstaNomina ? 'Actualizar en esta nómina' : 'Guardar y asignar'}
          </button>
        </div>
      </div>
    </PageFormModal>
  );
}
