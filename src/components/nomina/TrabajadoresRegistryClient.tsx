'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ChevronDown, PencilLine, Plus, Search } from 'lucide-react';
import { useBiblioteca, useBibliotecaOptions } from '@/contexts/biblioteca-context';
import { mergeSuggestions } from '@/lib/biblioteca-catalog';
import { areaNominaLabel, getAsignacionNomina, getUbicacionLaboralLabel } from '@/lib/personal-master';
import type { Personal } from '@/lib/types';
import {
  upsertTrabajadorRegistroAction,
  updateTrabajadorEstadoAction,
} from '@/lib/actions/trabajadores-registry';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';

type EstadoLaboral = 'ACTIVO' | 'DESPEDIDO' | 'REPOSO' | 'VACACIONES' | 'REENGANCHADO';

type Props = { trabajadores: Personal[] };

type FormState = {
  id?: string;
  nombre_completo: string;
  cedula: string;
  fecha_nacimiento: string;
  fecha_ingreso: string;
  ajuste_antiguedad_dias: string;
  cargo: string;
  area_detalle: string;
  ubicacion_laboral: string;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  notas: string;
  estado_laboral: EstadoLaboral;
  observacion_estado: string;
};

type EstadoModal = {
  open: boolean;
  id: string;
  nextEstado: EstadoLaboral;
  motivo: string;
  inicio: string;
  fin: string;
  duracion: string;
  despidoFecha: string;
  despidoCausa: string;
  reengancheFecha: string;
  reengancheCargo: string;
  reengancheObservacion: string;
};

const EMPTY_FORM: FormState = {
  nombre_completo: '',
  cedula: '',
  fecha_nacimiento: '',
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  ajuste_antiguedad_dias: '0',
  cargo: '',
  area_detalle: '',
  ubicacion_laboral: '',
  area: 'administracion',
  notas: '',
  estado_laboral: 'ACTIVO',
  observacion_estado: '',
};

function statusTone(estado: EstadoLaboral) {
  if (estado === 'ACTIVO') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (estado === 'REPOSO') return 'text-amber-300 bg-amber-500/10 border-amber-500/25';
  if (estado === 'VACACIONES') return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25';
  if (estado === 'REENGANCHADO') return 'text-orange-300 bg-orange-500/10 border-orange-500/25';
  return 'text-red-300 bg-red-500/10 border-red-500/25';
}

function calcEdad(fechaNacimiento?: string | null): number | null {
  if (!fechaNacimiento) return null;
  const birth = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age < 0 ? null : age;
}

function antiguedadLabel(fechaIngreso?: string | null, ajusteDias?: number | null): string {
  if (!fechaIngreso) return 'Sin fecha de ingreso';
  const start = new Date(`${fechaIngreso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 'Fecha inválida';
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000) + Number(ajusteDias ?? 0));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays - years * 365 - months * 30;
  return `${years}a ${months}m ${days}d`;
}

function addDaysIso(dateIso: string, days: number): string {
  const start = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '';
  const out = new Date(start);
  out.setDate(out.getDate() + days);
  return out.toISOString().slice(0, 10);
}

function diffDaysIso(startIso: string, endIso: string): number | null {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

function emptyEstadoModal(): EstadoModal {
  return {
    open: false,
    id: '',
    nextEstado: 'ACTIVO',
    motivo: '',
    inicio: '',
    fin: '',
    duracion: '',
    despidoFecha: '',
    despidoCausa: '',
    reengancheFecha: '',
    reengancheCargo: '',
    reengancheObservacion: '',
  };
}

export default function TrabajadoresRegistryClient({ trabajadores }: Props) {
  const biblioteca = useBiblioteca();
  const areaOptions = useBibliotecaOptions('areas_nomina');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [docCedula, setDocCedula] = useState<File | null>(null);
  const [fotoCarnet, setFotoCarnet] = useState<File | null>(null);
  const [estadoModal, setEstadoModal] = useState<EstadoModal>(emptyEstadoModal());
  const [estadoMenu, setEstadoMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const cargoOptions = useMemo(
    () =>
      mergeSuggestions(
        biblioteca.cargoSuggestions,
        trabajadores.map((t) => (t.cargo || '').trim()).filter(Boolean),
      ),
    [biblioteca.cargoSuggestions, trabajadores],
  );

  const asignacionOptions = useMemo(() => biblioteca.asignacionSuggestions, [biblioteca.asignacionSuggestions]);

  const ubicacionSugerencias = useMemo(
    () => biblioteca.ubicacionSugerenciasPorArea,
    [biblioteca.ubicacionSugerenciasPorArea],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return trabajadores;
    return trabajadores.filter((t) =>
      [
        t.nombre_completo,
        t.cedula,
        t.cargo,
        t.area_detalle || '',
        getAsignacionNomina(t) || '',
        getUbicacionLaboralLabel(t),
        areaNominaLabel(t.area, biblioteca),
        t.estado_laboral || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [trabajadores, search]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-estado-trigger]') || target.closest('[data-estado-menu]')) return;
      setEstadoMenu(null);
    }
    function onWindowChange() {
      setEstadoMenu(null);
    }
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('scroll', onWindowChange, true);
    window.addEventListener('resize', onWindowChange);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('scroll', onWindowChange, true);
      window.removeEventListener('resize', onWindowChange);
    };
  }, []);

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      ubicacion_laboral: biblioteca.ubicacionDefaultPorArea.administracion || '',
    });
    setDocCedula(null);
    setFotoCarnet(null);
    setOpen(true);
  }

  function openEdit(t: Personal) {
    setForm({
      id: t.id,
      nombre_completo: t.nombre_completo || '',
      cedula: t.cedula || '',
      fecha_nacimiento: t.fecha_nacimiento || '',
      fecha_ingreso: t.fecha_ingreso || new Date().toISOString().slice(0, 10),
      ajuste_antiguedad_dias: String(t.ajuste_antiguedad_dias ?? 0),
      cargo: t.cargo || '',
      area_detalle: t.area_detalle || '',
      ubicacion_laboral: t.ubicacion_laboral || getUbicacionLaboralLabel(t),
      area: t.area || 'administracion',
      notas: t.notas || '',
      estado_laboral: (t.estado_laboral || 'ACTIVO') as EstadoLaboral,
      observacion_estado: t.observacion_estado || '',
    });
    setDocCedula(null);
    setFotoCarnet(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setForm(EMPTY_FORM);
    setDocCedula(null);
    setFotoCarnet(null);
  }

  function submitForm() {
    const fd = new FormData();
    if (form.id) fd.set('id', form.id);
    fd.set('nombre_completo', form.nombre_completo);
    fd.set('cedula', form.cedula);
    fd.set('fecha_nacimiento', form.fecha_nacimiento);
    fd.set('fecha_ingreso', form.fecha_ingreso);
    fd.set('ajuste_antiguedad_dias', form.ajuste_antiguedad_dias);
    fd.set('cargo', form.cargo);
    fd.set('area_detalle', form.area_detalle);
    fd.set('ubicacion_laboral', form.ubicacion_laboral);
    fd.set('area', form.area);
    fd.set('notas', form.notas);
    fd.set('estado_laboral', form.estado_laboral);
    fd.set('observacion_estado', form.observacion_estado);
    if (docCedula) fd.set('doc_cedula', docCedula);
    if (fotoCarnet) fd.set('foto_carnet', fotoCarnet);

    startTransition(async () => {
      const res = await upsertTrabajadorRegistroAction(fd);
      if (!res.ok) return alert(res.message);
      closeModal();
    });
  }

  function handleEstadoSelection(t: Personal, nextEstado: EstadoLaboral) {
    if (nextEstado === (t.estado_laboral || 'ACTIVO')) return;
    if (nextEstado === 'ACTIVO') {
      startTransition(async () => {
        const res = await updateTrabajadorEstadoAction({
          id: t.id,
          estado_laboral: 'ACTIVO',
          observacion_estado: '',
        });
        if (!res.ok) alert(res.message);
      });
      return;
    }
    setEstadoModal({
      open: true,
      id: t.id,
      nextEstado,
      motivo: t.observacion_estado || '',
      inicio: '',
      fin: t.estado_fin_fecha || '',
      duracion: t.estado_duracion_dias ? String(t.estado_duracion_dias) : '',
      despidoFecha: t.despido_fecha || '',
      despidoCausa: t.despido_causa || '',
      reengancheFecha: t.reenganche_fecha || '',
      reengancheCargo: t.reenganche_cargo || t.cargo || '',
      reengancheObservacion: t.reenganche_observacion || '',
    });
  }

  function submitEstadoModal() {
    const payload = {
      id: estadoModal.id,
      estado_laboral: estadoModal.nextEstado,
      observacion_estado: estadoModal.motivo,
      estado_inicio_fecha: estadoModal.inicio || undefined,
      estado_fin_fecha: estadoModal.fin || undefined,
      estado_duracion_dias: estadoModal.duracion ? Number(estadoModal.duracion) : null,
      despido_fecha: estadoModal.nextEstado === 'DESPEDIDO' ? estadoModal.despidoFecha : undefined,
      despido_causa: estadoModal.nextEstado === 'DESPEDIDO' ? estadoModal.despidoCausa : undefined,
      reenganche_fecha: estadoModal.nextEstado === 'REENGANCHADO' ? estadoModal.reengancheFecha : undefined,
      reenganche_cargo: estadoModal.nextEstado === 'REENGANCHADO' ? estadoModal.reengancheCargo : undefined,
      reenganche_observacion: estadoModal.nextEstado === 'REENGANCHADO' ? estadoModal.reengancheObservacion : undefined,
    } as const;

    if (
      estadoModal.nextEstado === 'DESPEDIDO' &&
      (!estadoModal.despidoFecha || !estadoModal.despidoCausa.trim())
    ) {
      alert('Para despido debes indicar fecha y causa.');
      return;
    }
    if (
      estadoModal.nextEstado === 'REENGANCHADO' &&
      (!estadoModal.reengancheFecha || !estadoModal.reengancheCargo.trim())
    ) {
      alert('Para reenganchado debes indicar fecha de reintegro y cargo.');
      return;
    }

    startTransition(async () => {
      const res = await updateTrabajadorEstadoAction(payload);
      if (!res.ok) return alert(res.message);
      setEstadoModal(emptyEstadoModal());
    });
  }

  function onEstadoInicioChange(value: string) {
    setEstadoModal((prev) => {
      const next = { ...prev, inicio: value };
      const dur = Number(next.duracion || '0');
      if (value && Number.isFinite(dur) && dur >= 0) {
        next.fin = addDaysIso(value, dur);
      } else if (value && next.fin) {
        const dd = diffDaysIso(value, next.fin);
        if (dd !== null) next.duracion = String(dd);
      }
      return next;
    });
  }

  function onEstadoFinChange(value: string) {
    setEstadoModal((prev) => {
      const next = { ...prev, fin: value };
      if (next.inicio && value) {
        const dd = diffDaysIso(next.inicio, value);
        if (dd !== null) next.duracion = String(dd);
      }
      return next;
    });
  }

  function onEstadoDuracionChange(value: string) {
    setEstadoModal((prev) => {
      const next = { ...prev, duracion: value };
      const dur = Number(value || '0');
      if (next.inicio && Number.isFinite(dur) && dur >= 0) {
        next.fin = addDaysIso(next.inicio, dur);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-8 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
          <Search className="h-4 w-4 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula, sitio o estado..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
        >
          <Plus className="h-4 w-4" />
          Agregar Trabajador
        </button>
      </div>

      <div className="card-glass overflow-visible rounded-xl border border-white/[0.08]">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/45">
              <tr>
                <th className="px-3 py-2.5">Trabajador</th>
                <th className="px-3 py-2.5">Cédula</th>
                <th className="px-3 py-2.5">Edad</th>
                <th className="px-3 py-2.5">Antiguedad</th>
                <th className="px-3 py-2.5">Cargo</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Observación</th>
                <th className="px-3 py-2.5">Adjuntos</th>
                <th className="px-3 py-2.5 text-right">Editar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const estado = (t.estado_laboral || 'ACTIVO') as EstadoLaboral;
                const isFired = estado === 'DESPEDIDO';
                const isReengaged = estado === 'REENGANCHADO';
                return (
                  <tr
                    key={t.id}
                    className={
                      isFired
                        ? 'border-t border-red-900/50 bg-red-950/20'
                        : isReengaged
                          ? 'border-t border-orange-900/45 bg-orange-950/15'
                          : 'border-t border-white/[0.06]'
                    }
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-white">{t.nombre_completo}</p>
                      <p className="text-[11px] leading-tight text-white/45">{getUbicacionLaboralLabel(t)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-white/80">{t.cedula}</td>
                    <td className="px-3 py-2.5 text-white/70">{calcEdad(t.fecha_nacimiento) ?? '-'}</td>
                    <td className="px-3 py-2.5 text-white/70">{antiguedadLabel(t.fecha_ingreso, t.ajuste_antiguedad_dias)}</td>
                    <td className="px-3 py-2.5 text-white/80">{t.cargo || '-'}</td>
                    <td className="px-3 py-2.5">
                      <div className="relative inline-flex">
                        <button
                          type="button"
                          data-estado-trigger
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuWidth = 160;
                            const x = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
                            const y = rect.bottom + 6;
                            setEstadoMenu((prev) => (prev?.id === t.id ? null : { id: t.id, x, y }));
                          }}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusTone(estado)}`}
                        >
                          <span>{estado}</span>
                          <ChevronDown className="h-3.5 w-3.5 opacity-75" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-white/55">
                      {t.observacion_estado || t.despido_causa || t.notas || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <div className="flex flex-col gap-1">
                        {t.doc_cedula_url ? <a className="text-cyan-300 hover:underline" href={t.doc_cedula_url} target="_blank" rel="noreferrer">Cédula</a> : <span className="text-white/35">Sin cédula</span>}
                        {t.foto_carnet_url ? <a className="text-cyan-300 hover:underline" href={t.foto_carnet_url} target="_blank" rel="noreferrer">Foto</a> : <span className="text-white/35">Sin foto</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => openEdit(t)}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-sm text-white/45" colSpan={9}>
                    No hay trabajadores para mostrar con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {estadoMenu && (
        <div
          data-estado-menu
          className="fixed z-[220] w-40 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur-md"
          style={{ left: `${estadoMenu.x}px`, top: `${estadoMenu.y}px` }}
        >
          {(['ACTIVO', 'REPOSO', 'VACACIONES', 'DESPEDIDO', 'REENGANCHADO'] as EstadoLaboral[]).map((opt) => {
            const worker = filtered.find((w) => w.id === estadoMenu.id);
            const current = ((worker?.estado_laboral || 'ACTIVO') as EstadoLaboral);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setEstadoMenu(null);
                  if (worker) handleEstadoSelection(worker, opt);
                }}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                  opt === current
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'text-white/75 hover:bg-white/5 hover:text-white'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      <PageFormModal open={open} onClose={closeModal} panelClassName="sm:max-w-3xl">
        <h2 className="mb-4 text-lg font-bold text-white">{form.id ? 'Editar trabajador' : 'Nuevo trabajador'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="input-label">Nombre y Apellido *</label>
            <input className="input-field" value={form.nombre_completo} onChange={(e) => setForm((p) => ({ ...p, nombre_completo: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Cédula *</label>
            <input className="input-field" value={form.cedula} onChange={(e) => setForm((p) => ({ ...p, cedula: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Fecha de Nacimiento</label>
            <input className="input-field" type="date" value={form.fecha_nacimiento} onChange={(e) => setForm((p) => ({ ...p, fecha_nacimiento: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Fecha de Ingreso</label>
            <input className="input-field" type="date" value={form.fecha_ingreso} onChange={(e) => setForm((p) => ({ ...p, fecha_ingreso: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Ajuste Antiguedad (días)</label>
            <input className="input-field" type="number" value={form.ajuste_antiguedad_dias} onChange={(e) => setForm((p) => ({ ...p, ajuste_antiguedad_dias: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Cargo *</label>
            <input list="cargo-options" className="input-field" value={form.cargo} onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))} placeholder="Ej: Capataz, Palero, Cocinero" />
            <datalist id="cargo-options">
              {cargoOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="input-label">Asignación Nómina (Vertical/Sector)</label>
            <input list="asignacion-options" className="input-field" value={form.area_detalle} onChange={(e) => setForm((p) => ({ ...p, area_detalle: e.target.value }))} placeholder="Ej: Vertical 2" />
            <datalist id="asignacion-options">
              {asignacionOptions.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="input-label">Área / Sitio laboral</label>
            <input
              list="ubicacion-options"
              className="input-field"
              value={form.ubicacion_laboral}
              onChange={(e) => setForm((p) => ({ ...p, ubicacion_laboral: e.target.value }))}
              placeholder="Ej: Mina Belén, otra mina…"
            />
            <datalist id="ubicacion-options">
              {(ubicacionSugerencias[form.area] || []).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="input-label">Nómina (módulo)</label>
            <select
              className="input-field"
              value={form.area}
              onChange={(e) => {
                const area = e.target.value as FormState['area'];
                setForm((p) => ({
                  ...p,
                  area,
                  ubicacion_laboral: biblioteca.ubicacionDefaultPorArea[area] || p.ubicacion_laboral,
                }));
              }}
            >
              {areaOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-white/35">Define en qué nómina semanal aparece el trabajador.</p>
          </div>
          <div>
            <label className="input-label">Estado Inicial</label>
            <select className="input-field" value={form.estado_laboral} onChange={(e) => setForm((p) => ({ ...p, estado_laboral: e.target.value as EstadoLaboral }))}>
              <option value="ACTIVO">Activo</option>
              <option value="REPOSO">Reposo</option>
              <option value="VACACIONES">Vacaciones</option>
              <option value="DESPEDIDO">Despedido</option>
              <option value="REENGANCHADO">Reenganchado</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="input-label">Observación General</label>
            <textarea className="input-field min-h-[72px]" value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Adjuntar cédula (opcional)</label>
            <input type="file" accept="image/*,.pdf" className="input-field" onChange={(e) => setDocCedula(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="input-label">Foto carnet (opcional)</label>
            <input type="file" accept="image/*" className="input-field" onChange={(e) => setFotoCarnet(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <PageFormModalFooter className="mt-5 flex justify-end gap-2">
          <button onClick={closeModal} className="btn-secondary" disabled={isPending}>Cancelar</button>
          <button onClick={submitForm} className="btn-primary" disabled={isPending}>
            {isPending ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Registrar trabajador'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>

      <PageFormModal open={estadoModal.open} onClose={() => setEstadoModal(emptyEstadoModal())} panelClassName="sm:max-w-xl">
        <h3 className="mb-3 text-lg font-bold text-white">Detalle de estado: {estadoModal.nextEstado}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(estadoModal.nextEstado === 'REPOSO' || estadoModal.nextEstado === 'VACACIONES') && (
            <>
              <div>
                <label className="input-label">Inicio</label>
                <input className="input-field" type="date" value={estadoModal.inicio} onChange={(e) => onEstadoInicioChange(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Fin</label>
                <input className="input-field" type="date" value={estadoModal.fin} onChange={(e) => onEstadoFinChange(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Duración (días)</label>
                <input className="input-field" type="number" value={estadoModal.duracion} onChange={(e) => onEstadoDuracionChange(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Observación</label>
                <textarea className="input-field min-h-[70px]" value={estadoModal.motivo} onChange={(e) => setEstadoModal((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
            </>
          )}
          {estadoModal.nextEstado === 'DESPEDIDO' && (
            <>
              <div>
                <label className="input-label">Fecha de despido *</label>
                <input className="input-field" type="date" value={estadoModal.despidoFecha} onChange={(e) => setEstadoModal((p) => ({ ...p, despidoFecha: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Causa / Observación *</label>
                <textarea className="input-field min-h-[86px]" value={estadoModal.despidoCausa} onChange={(e) => setEstadoModal((p) => ({ ...p, despidoCausa: e.target.value }))} />
              </div>
            </>
          )}
          {estadoModal.nextEstado === 'REENGANCHADO' && (
            <>
              <div>
                <label className="input-label">Fecha de reintegro *</label>
                <input className="input-field" type="date" value={estadoModal.reengancheFecha} onChange={(e) => setEstadoModal((p) => ({ ...p, reengancheFecha: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Cargo de reintegro *</label>
                <input className="input-field" value={estadoModal.reengancheCargo} onChange={(e) => setEstadoModal((p) => ({ ...p, reengancheCargo: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Observación</label>
                <textarea className="input-field min-h-[86px]" value={estadoModal.reengancheObservacion} onChange={(e) => setEstadoModal((p) => ({ ...p, reengancheObservacion: e.target.value }))} />
              </div>
            </>
          )}
        </div>
        <PageFormModalFooter className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setEstadoModal(emptyEstadoModal())}>Cancelar</button>
          <button className="btn-primary" onClick={submitEstadoModal} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar estado'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}
