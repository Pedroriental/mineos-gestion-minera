'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  areaNominaLabel,
  getAsignacionNomina,
  getUbicacionLaboralLabel,
  normalizeCedula,
  searchPersonalMaster,
} from '@/lib/personal-master';
import { upsertPersonalV3Action } from '@/lib/actions/nomina-v3';
import { useBiblioteca } from '@/contexts/biblioteca-context';
import { tieneEsquemaConRotacion } from '@/lib/rotacion-personal';
import type { Personal } from '@/lib/types';

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
  salario_base: string;
  salario_libre: string;
  bono_transporte: string;
  telefono: string;
  fecha_ingreso: string;
  esquema_rotacion: Personal['esquema_rotacion'];
  rotacion_inicio_fecha: string;
};

function emptyForm(area: Props['area'], esquemaDefault: string): FormState {
  const esquema = (esquemaDefault || 'FIJO_SEMANAL') as Personal['esquema_rotacion'];
  return {
    cedula: '',
    nombre_completo: '',
    cargo: '',
    area_detalle: '',
    salario_base: '',
    salario_libre: '',
    bono_transporte: '',
    telefono: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    esquema_rotacion: esquema,
    rotacion_inicio_fecha: tieneEsquemaConRotacion(esquema)
      ? new Date().toISOString().split('T')[0]
      : '',
  };
}

function personToForm(p: Personal, area: Props['area'], esquemaDefault: string): FormState {
  const esquema = (p.esquema_rotacion || esquemaDefault || 'FIJO_SEMANAL') as Personal['esquema_rotacion'];
  return {
    id: p.id,
    cedula: p.cedula || '',
    nombre_completo: p.nombre_completo || '',
    cargo: p.cargo || '',
    area_detalle: getAsignacionNomina(p) || p.area_detalle || '',
    salario_base: String(p.salario_base ?? ''),
    salario_libre: String(p.salario_libre ?? ''),
    bono_transporte: String(p.bono_transporte ?? ''),
    telefono: p.telefono || '',
    fecha_ingreso: p.fecha_ingreso || new Date().toISOString().split('T')[0],
    esquema_rotacion: esquema,
    rotacion_inicio_fecha: p.rotacion_inicio_fecha || '',
  };
}

export function PersonalQuickAssignModal({
  open,
  onClose,
  area,
  masterCatalog,
  assignedIds,
  onAssigned,
}: Props) {
  const biblioteca = useBiblioteca();
  const esquemaDefault = biblioteca.esquemaDefaultPorArea[area] || 'FIJO_SEMANAL';
  const esquemaOpciones = biblioteca.esquemasPorArea[area] || ['FIJO_SEMANAL'];
  const cargoSuggestions = biblioteca.cargoSuggestions;
  const asignacionSuggestions = biblioteca.asignacionSuggestions;

  const [query, setQuery] = useState('');
  const [form, setForm] = useState(() => emptyForm(area, esquemaDefault));
  const [selected, setSelected] = useState<Personal | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

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
    setForm(emptyForm(area, esquemaDefault));
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
    setForm(personToForm(person, area, esquemaDefault));
    setQuery(person.nombre_completo);
    setShowSuggestions(false);
    setError(null);
  }

  function clearSelection() {
    setSelected(null);
    setForm(emptyForm(area, esquemaDefault));
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
    startTransition(async () => {
      const res = await upsertPersonalV3Action({
        id: form.id,
        cedula: form.cedula.trim(),
        nombre_completo: form.nombre_completo.trim(),
        cargo: form.cargo.trim(),
        area,
        area_detalle: form.area_detalle.trim(),
        salario_base: Number(form.salario_base) || 0,
        salario_libre: Number(form.salario_libre) || 0,
        bono_transporte: Number(form.bono_transporte) || 0,
        telefono: form.telefono.trim(),
        notas: '',
        fecha_ingreso: form.fecha_ingreso,
        esquema_rotacion: form.esquema_rotacion,
        rotacion_inicio_fecha: form.rotacion_inicio_fecha,
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
                placeholder="Capataz, Palero…"
                value={form.cargo}
                onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="input-label">Vertical / sector (asignación nómina)</label>
              <input
                className="input-field"
                placeholder="Ej: Vertical 2"
                value={form.area_detalle}
                onChange={(e) => setForm((p) => ({ ...p, area_detalle: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label flex items-center gap-1.5">
                Salario labor ($)
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500/70">Perfil</span>
              </label>
              <input
                type="number"
                className="input-field bg-zinc-900/50 cursor-not-allowed"
                value={form.salario_base}
                readOnly
                title="Heredado del perfil de compensación asignado al trabajador"
              />
            </div>
            <div>
              <label className="input-label flex items-center gap-1.5">
                Sueldo libre ($)
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500/70">Perfil</span>
              </label>
              <input
                type="number"
                className="input-field bg-zinc-900/50 cursor-not-allowed"
                value={form.salario_libre}
                readOnly
                title="Heredado del perfil de compensación asignado al trabajador"
              />
            </div>
            <div>
              <label className="input-label flex items-center gap-1.5">
                Bono transporte ($)
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500/70">Perfil</span>
              </label>
              <input
                type="number"
                className="input-field bg-zinc-900/50 cursor-not-allowed"
                value={form.bono_transporte}
                readOnly
                title="Heredado del perfil de compensación asignado al trabajador"
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
            <div className="col-span-2">
              <label className="input-label">Esquema de rotación</label>
              <AppSelect
                value={form.esquema_rotacion}
                onChange={(val) => {
                  const esquema = val as Personal['esquema_rotacion'];
                  setForm((p) => ({
                    ...p,
                    esquema_rotacion: esquema,
                    rotacion_inicio_fecha: tieneEsquemaConRotacion(esquema)
                      ? p.rotacion_inicio_fecha || new Date().toISOString().split('T')[0]
                      : '',
                  }));
                }}
                options={esquemaOpciones.map((e) => ({
                  value: e,
                  label: biblioteca.esquemaLabels[e] || e,
                }))}
              />
            </div>
            {tieneEsquemaConRotacion(form.esquema_rotacion) && (
              <div className="col-span-2">
                <label className="input-label">Inicio de ciclo</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.rotacion_inicio_fecha}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, rotacion_inicio_fecha: e.target.value }))
                  }
                />
              </div>
            )}
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
