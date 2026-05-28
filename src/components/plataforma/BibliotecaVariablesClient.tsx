'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import {
  FolderOpen,
  PencilLine,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import {
  deleteBibliotecaCategoriaAction,
  deleteBibliotecaVariableAction,
  upsertBibliotecaCategoriaAction,
  upsertBibliotecaVariableAction,
} from '@/lib/actions/biblioteca-variables';
import {
  buildVariableMetadata,
  emptyMetadataForSlug,
  parseVariableMetadata,
  type BibliotecaVariableMetadata,
} from '@/lib/biblioteca-metadata';
import { getBibliotecaCategorySchema } from '@/lib/biblioteca-schemas';
import type { BibliotecaCategoriaCompleta, BibliotecaModulo } from '@/lib/types';
import { BibliotecaCategoryVariablesView } from '@/components/plataforma/BibliotecaCategoryVariablesView';
import { BibliotecaVariableFormFields } from '@/components/plataforma/BibliotecaVariableFormFields';
import { MODULO_LABEL } from '@/components/plataforma/biblioteca-constants';

type Props = { catalogo: BibliotecaCategoriaCompleta[] };

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function BibliotecaVariablesClient({ catalogo }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(catalogo[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();

  const [catModal, setCatModal] = useState(false);
  const [catForm, setCatForm] = useState({
    id: undefined as string | undefined,
    nombre: '',
    slug: '',
    descripcion: '',
    modulo: 'general' as BibliotecaModulo,
    orden: 0,
  });

  const [varModal, setVarModal] = useState(false);
  const [varCategoriaSlug, setVarCategoriaSlug] = useState('');
  const [varForm, setVarForm] = useState({
    id: undefined as string | undefined,
    categoria_id: '',
    clave: '',
    etiqueta: '',
    valor: '',
    unidad: '',
    descripcion: '',
    orden: 0,
    metadata: {} as BibliotecaVariableMetadata,
  });

  const filteredCatalogo = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return catalogo;
    return catalogo
      .map((cat) => {
        const catMatch =
          cat.nombre.toLowerCase().includes(q) ||
          cat.slug.toLowerCase().includes(q) ||
          (cat.descripcion || '').toLowerCase().includes(q);
        const vars = cat.variables.filter(
          (v) =>
            v.etiqueta.toLowerCase().includes(q) ||
            v.clave.toLowerCase().includes(q) ||
            v.valor.toLowerCase().includes(q) ||
            (v.unidad || '').toLowerCase().includes(q),
        );
        if (catMatch) return cat;
        if (vars.length) return { ...cat, variables: vars };
        return null;
      })
      .filter(Boolean) as BibliotecaCategoriaCompleta[];
  }, [catalogo, search]);

  const categoriaActiva = useMemo(() => {
    const list = filteredCatalogo;
    if (!list.length) return null;
    const found = list.find((c) => c.id === categoriaId);
    return found || list[0];
  }, [filteredCatalogo, categoriaId]);

  const totalVariables = useMemo(
    () => catalogo.reduce((n, c) => n + c.variables.length, 0),
    [catalogo],
  );

  function run(action: () => Promise<{ ok: boolean; message: string }>, onOk?: () => void) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        router.refresh();
        onOk?.();
      } else {
        alert(res.message);
      }
    });
  }

  function openNuevaCategoria() {
    setCatForm({
      id: undefined,
      nombre: '',
      slug: '',
      descripcion: '',
      modulo: 'general',
      orden: catalogo.length * 10,
    });
    setCatModal(true);
  }

  function openEditarCategoria(cat: BibliotecaCategoriaCompleta) {
    setCatForm({
      id: cat.id,
      nombre: cat.nombre,
      slug: cat.slug,
      descripcion: cat.descripcion || '',
      modulo: cat.modulo,
      orden: cat.orden,
    });
    setCatModal(true);
  }

  function openNuevaVariable(catId: string) {
    const cat = catalogo.find((c) => c.id === catId);
    setVarCategoriaSlug(cat?.slug || '');
    setVarForm({
      id: undefined,
      categoria_id: catId,
      clave: '',
      etiqueta: '',
      valor: '',
      unidad: '',
      descripcion: '',
      orden: (cat?.variables.length ?? 0) * 10,
      metadata: emptyMetadataForSlug(cat?.slug || ''),
    });
    setVarModal(true);
  }

  function openEditarVariable(
    v: BibliotecaCategoriaCompleta['variables'][number],
    catId: string,
    catSlug: string,
  ) {
    setVarCategoriaSlug(catSlug);
    setVarForm({
      id: v.id,
      categoria_id: catId,
      clave: v.clave,
      etiqueta: v.etiqueta,
      valor: v.valor,
      unidad: v.unidad || '',
      descripcion: v.descripcion || '',
      orden: v.orden,
      metadata: parseVariableMetadata(v),
    });
    setVarModal(true);
  }

  return (
    <div className="biblioteca-variables-page flex min-h-0 w-full flex-1 flex-col gap-2.5 sm:gap-3">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative min-w-0 w-full flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categoría, variable, clave o valor…"
            className="input-field w-full py-2 pl-9"
          />
        </div>
        <p className="shrink-0 text-xs tabular-nums text-white/40">
          {catalogo.length} categorías · {totalVariables} variables
          {search.trim() ? ` · ${filteredCatalogo.length} en búsqueda` : ''}
        </p>
        <div className="ml-auto flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={openNuevaCategoria}
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/[0.08]"
          >
            <FolderOpen className="h-4 w-4" />
            Nueva categoría
          </button>
          <button
            type="button"
            disabled={!categoriaActiva}
            onClick={() => categoriaActiva && openNuevaVariable(categoriaActiva.id)}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/35 bg-violet-500/15 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-violet-500/25 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Nueva variable
          </button>
        </div>
      </div>

      {catalogo.length === 0 ? (
        <div className="card-glass rounded-xl border border-dashed border-white/[0.12] p-8 text-center">
          <p className="text-sm text-white/60">
            Aún no hay categorías. Ejecuta la migración en Supabase o crea la primera categoría.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 pb-3 sm:pb-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
          <aside className="card-glass flex max-h-[min(46vh,420px)] flex-col overflow-hidden rounded-xl border border-white/[0.08] lg:max-h-none lg:min-h-0">
            <div className="border-b border-white/[0.06] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white/45">
              Categorías
            </div>
            <ul className="flex-1 overflow-y-auto p-2">
              {filteredCatalogo.length === 0 ? (
                <li className="px-2 py-4 text-center text-xs text-white/45">Sin coincidencias.</li>
              ) : (
                filteredCatalogo.map((cat) => {
                  const active = categoriaActiva?.id === cat.id;
                  return (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() => setCategoriaId(cat.id)}
                        className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                          active
                            ? 'border border-violet-500/35 bg-violet-500/15'
                            : 'border border-transparent hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white/90">{cat.nombre}</span>
                          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                            {cat.variables.length}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-white/40">{MODULO_LABEL[cat.modulo]}</span>
                          <span className="text-[9px] text-white/30">
                            {getBibliotecaCategorySchema(cat.slug).label}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </aside>

          <section className="card-glass flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] lg:min-h-0">
            {!categoriaActiva ? (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-white/50">
                Selecciona una categoría.
              </div>
            ) : (
              <BibliotecaCategoryVariablesView
                categoria={categoriaActiva}
                isPending={isPending}
                onEditCategoria={() => openEditarCategoria(categoriaActiva)}
                onDeleteCategoria={() => {
                  if (!confirm('¿Eliminar categoría y todas sus variables?')) return;
                  run(() => deleteBibliotecaCategoriaAction(categoriaActiva.id));
                }}
                onEditVariable={(v) => openEditarVariable(v, categoriaActiva.id, categoriaActiva.slug)}
                onDeleteVariable={(id) => {
                  if (!confirm('¿Eliminar esta variable?')) return;
                  run(() => deleteBibliotecaVariableAction(id));
                }}
              />
            )}
          </section>
        </div>
      )}

      <PageFormModal open={catModal} onClose={() => setCatModal(false)}>
        <form
          className="page-form-modal-panel max-h-[85vh] overflow-y-auto p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                upsertBibliotecaCategoriaAction({
                  id: catForm.id,
                  slug: catForm.slug || undefined,
                  nombre: catForm.nombre,
                  descripcion: catForm.descripcion,
                  modulo: catForm.modulo,
                  orden: catForm.orden,
                }),
              () => setCatModal(false),
            );
          }}
        >
          <h2 className="text-lg font-bold text-white">
            {catForm.id ? 'Editar categoría' : 'Nueva categoría'}
          </h2>
          <div className="mt-4 grid gap-3">
            <Field label="Nombre">
              <input
                className="input-field w-full"
                value={catForm.nombre}
                onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
                required
              />
            </Field>
            <Field label="Slug (clave interna)">
              <input
                className="input-field w-full font-mono text-sm"
                value={catForm.slug}
                onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
                placeholder="ej: cargos"
              />
            </Field>
            <Field label="Módulo vinculado">
              <select
                className="input-field w-full"
                value={catForm.modulo}
                onChange={(e) =>
                  setCatForm({ ...catForm, modulo: e.target.value as BibliotecaModulo })
                }
              >
                {Object.entries(MODULO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descripción">
              <textarea
                className="input-field min-h-[72px] w-full resize-y"
                value={catForm.descripcion}
                onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })}
              />
            </Field>
          </div>
          <PageFormModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setCatModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              Guardar
            </button>
          </PageFormModalFooter>
        </form>
      </PageFormModal>

      <PageFormModal open={varModal} onClose={() => setVarModal(false)}>
        <form
          className="page-form-modal-panel max-h-[85vh] overflow-y-auto p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const schema = getBibliotecaCategorySchema(varCategoriaSlug);
            let valor = varForm.valor;
            if (schema.kind === 'explosive_supply' && varForm.metadata.campo_voladura) {
              valor = varForm.metadata.campo_voladura;
            }
            run(
              () =>
                upsertBibliotecaVariableAction({
                  id: varForm.id,
                  categoria_id: varForm.categoria_id,
                  clave: varForm.clave,
                  etiqueta: varForm.etiqueta,
                  valor,
                  unidad: varForm.unidad,
                  descripcion: varForm.descripcion,
                  orden: varForm.orden,
                  metadata: buildVariableMetadata(varForm.metadata),
                }),
              () => setVarModal(false),
            );
          }}
        >
          {(() => {
            const schema = getBibliotecaCategorySchema(varCategoriaSlug);
            return (
              <>
                <h2 className="text-lg font-bold text-white">
                  {varForm.id ? 'Editar variable' : 'Nueva variable'}
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  <span className={schema.badgeClass}>{schema.label}</span>
                  {' — '}
                  {schema.purpose}
                </p>
              </>
            );
          })()}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label={
                getBibliotecaCategorySchema(varCategoriaSlug).kind === 'labor_role'
                  ? 'Nombre del cargo'
                  : getBibliotecaCategorySchema(varCategoriaSlug).kind === 'explosive_supply'
                    ? 'Nombre del insumo'
                    : 'Etiqueta (nombre visible)'
              }
              className="sm:col-span-2"
            >
              <input
                className="input-field w-full"
                value={varForm.etiqueta}
                onChange={(e) => setVarForm({ ...varForm, etiqueta: e.target.value })}
                required
              />
            </Field>
            <Field label="Clave interna (catálogo)">
              <input
                className="input-field w-full font-mono text-sm"
                value={varForm.clave}
                onChange={(e) => setVarForm({ ...varForm, clave: e.target.value })}
                placeholder="palero, fosforos_lp…"
              />
            </Field>
            <Field label="Orden">
              <input
                type="number"
                className="input-field w-full"
                value={varForm.orden}
                onChange={(e) => setVarForm({ ...varForm, orden: Number(e.target.value) || 0 })}
              />
            </Field>
            <BibliotecaVariableFormFields
              schema={getBibliotecaCategorySchema(varCategoriaSlug)}
              metadata={varForm.metadata}
              valor={varForm.valor}
              unidad={varForm.unidad}
              onMetadataChange={(patch) =>
                setVarForm((p) => ({ ...p, metadata: { ...p.metadata, ...patch } }))
              }
              onValorChange={(valor) => setVarForm((p) => ({ ...p, valor }))}
              onUnidadChange={(unidad) => setVarForm((p) => ({ ...p, unidad }))}
            />
            <Field label="Notas / descripción" className="sm:col-span-2">
              <textarea
                className="input-field min-h-[64px] w-full resize-y"
                value={varForm.descripcion}
                onChange={(e) => setVarForm({ ...varForm, descripcion: e.target.value })}
              />
            </Field>
          </div>
          <PageFormModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setVarModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              Guardar
            </button>
          </PageFormModalFooter>
        </form>
      </PageFormModal>
    </div>
  );
}
