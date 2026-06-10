'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Search, X } from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';
import {
  areaNominaLabel,
  getAsignacionNomina,
  getEstadoLaboral,
  getUbicacionLaboralLabel,
  isAsignacionNominaValid,
  normalizeCedula,
  searchPersonalMaster,
} from '@/lib/personal-master';
import { assignPersonalToNominaAreaAction } from '@/lib/actions/nomina-v3';
import type { Personal } from '@/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  area: 'administracion' | 'mina' | 'planta' | 'seguridad' | 'transporte';
  masterCatalog: Personal[];
  assignedIds: Set<string>;
  onAssigned: () => void;
};

function workerProfileReady(p: Personal): { ok: true } | { ok: false; message: string } {
  if (!p.perfil_compensacion_id) {
    return {
      ok: false,
      message:
        'Este trabajador no tiene perfil de compensación. Complétalo en Base de Trabajadores antes de asignarlo.',
    };
  }
  const asignacion = getAsignacionNomina(p) || p.area_detalle || '';
  if (!isAsignacionNominaValid(asignacion)) {
    return {
      ok: false,
      message:
        'Este trabajador no tiene una asignación nómina válida. Actualízalo en Base de Trabajadores.',
    };
  }
  if (!p.salario_base || Number(p.salario_base) <= 0) {
    return {
      ok: false,
      message:
        'Este trabajador no tiene sueldo base configurado. Actualízalo en Base de Trabajadores.',
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
  assignedIds,
  onAssigned,
}: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Personal | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const assignableCatalog = useMemo(
    () => masterCatalog.filter((p) => !assignedIds.has(p.id)),
    [masterCatalog, assignedIds],
  );

  const hits = useMemo(
    () => searchPersonalMaster(query, assignableCatalog, 8),
    [query, assignableCatalog],
  );

  const profileCheck = useMemo(
    () => (selected ? workerProfileReady(selected) : null),
    [selected],
  );

  const statusLabel = useMemo(() => {
    if (!selected) {
      if (query.trim().length >= 2 && hits.length === 0) {
        return {
          tone: 'empty' as const,
          text: 'Sin coincidencias en la base. Registra al trabajador en Base de Trabajadores y vuelve aquí.',
        };
      }
      return {
        tone: 'idle' as const,
        text: 'Busca un trabajador existente para vincularlo a esta nómina.',
      };
    }
    if (assignedIds.has(selected.id)) {
      return {
        tone: 'here' as const,
        text: 'Este trabajador ya está en esta nómina.',
      };
    }
    if (selected.area !== area) {
      return {
        tone: 'move' as const,
        text: `Viene de ${areaNominaLabel(selected.area)}. Se moverá a ${areaNominaLabel(area)} al confirmar.`,
      };
    }
    return {
      tone: 'ready' as const,
      text: 'Perfil listo para asignar con los datos registrados en la base.',
    };
  }, [selected, query, hits.length, assignedIds, area]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
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
    setQuery(person.nombre_completo);
    setShowSuggestions(false);
    setError(null);
  }

  function clearSelection() {
    setSelected(null);
    setQuery('');
    setShowSuggestions(false);
    searchRef.current?.focus();
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const qCed = normalizeCedula(q);
    if (qCed.length < 5) return;
    const exact = assignableCatalog.find((p) => normalizeCedula(p.cedula || '') === qCed);
    if (exact && selected?.id !== exact.id) {
      pickPerson(exact);
    }
  }, [query, assignableCatalog, selected?.id]);

  function assign() {
    setError(null);
    if (!selected) {
      setError('Selecciona un trabajador de la lista.');
      return;
    }
    if (assignedIds.has(selected.id)) {
      setError('Este trabajador ya está en esta nómina.');
      return;
    }
    const check = workerProfileReady(selected);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    startTransition(async () => {
      const res = await assignPersonalToNominaAreaAction({
        personalId: selected.id,
        targetArea: area,
        areaDetalle: getAsignacionNomina(selected) || selected.area_detalle || undefined,
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
    idle: 'border-zinc-700 bg-zinc-900/60 text-white/55',
    empty: 'border-amber-500/25 bg-amber-500/10 text-amber-200/90',
    here: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90',
    move: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200/90',
    ready: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90',
  };

  const canAssign = !!selected && !assignedIds.has(selected.id) && profileCheck?.ok;

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
                Busca en la base maestra y vincula un trabajador existente a esta nómina.
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
                  if (selected && e.target.value !== selected.nombre_completo) {
                    setSelected(null);
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
                        CI {person.cedula} · {getUbicacionLaboralLabel(person)} ·{' '}
                        {areaNominaLabel(person.area)}
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

          {statusLabel.tone === 'empty' && (
            <Link
              href="/admin/trabajadores"
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
            >
              Ir a Base de Trabajadores
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}

          {selected && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                Datos del perfil (solo lectura)
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="col-span-2">
                  <dt className="text-[10px] text-white/40">Nombre</dt>
                  <dd className="font-semibold text-white">{selected.nombre_completo}</dd>
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
                  <dt className="text-[10px] text-white/40">Asignación</dt>
                  <dd className="text-white/80">
                    {getAsignacionNomina(selected) || selected.area_detalle || '—'}
                  </dd>
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
                <div>
                  <dt className="text-[10px] text-white/40">Bono transporte</dt>
                  <dd className="tabular-nums text-white/80">
                    {fmtMoney(Number(selected.bono_transporte ?? 0))}
                  </dd>
                </div>
              </dl>

              {profileCheck && !profileCheck.ok && (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs text-amber-200">{profileCheck.message}</p>
                  <Link
                    href="/admin/trabajadores"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
                  >
                    Editar en Base de Trabajadores
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-800/80 p-5 pt-4">
          <button
            type="button"
            onClick={assign}
            disabled={isPending || !canAssign}
            className="btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Asignar a esta nómina
          </button>
        </div>
      </div>
    </PageFormModal>
  );
}
