'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import {
  Building2,
  FileText,
  PencilLine,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
} from 'lucide-react';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import {
  deleteFiscalEntidadAction,
  deleteFiscalTextoAction,
  upsertFiscalCuentaAction,
  upsertFiscalEntidadAction,
  upsertFiscalParametroAction,
  upsertFiscalRepresentanteAction,
  upsertFiscalTextoAction,
} from '@/lib/actions/datos-fiscales';
import type {
  FiscalEntidadCompleta,
  FiscalParametro,
  FiscalParametroGrupo,
  FiscalTextoCategoria,
  FiscalTextoLegal,
} from '@/lib/types';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

type Tab = 'entidades' | 'textos' | 'parametros';

type Props = {
  entidades: FiscalEntidadCompleta[];
  textos: FiscalTextoLegal[];
  parametros: FiscalParametro[];
};

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: 'entidades', label: 'Entidades y bancos', icon: Building2 },
  { id: 'textos', label: 'Textos legales', icon: FileText },
  { id: 'parametros', label: 'Parámetros', icon: Settings2 },
];

const CATEGORIA_LABEL: Record<FiscalTextoCategoria, string> = {
  factura: 'Factura',
  balance: 'Balance',
  planilla: 'Planilla',
  general: 'General',
};

const GRUPO_LABEL: Record<FiscalParametroGrupo, string> = {
  tributario: 'Tributario',
  documento: 'Documento',
  numeracion: 'Numeración',
  otro: 'Otro',
};

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
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</span>
      {children}
    </label>
  );
}

export default function DatosFiscalesClient({ entidades, textos, parametros }: Props) {
  const [tab, setTab] = useState<Tab>('entidades');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirmDialog = useConfirm();

  const [entidadModal, setEntidadModal] = useState(false);
  const [entidadForm, setEntidadForm] = useState({
    id: '' as string | undefined,
    nombre_comercial: '',
    razon_social: '',
    rif: '',
    direccion_fiscal: '',
    direccion_operativa: '',
    ciudad: '',
    estado_region: '',
    telefono: '',
    email: '',
    actividad_economica: '',
    es_emisor_principal: false,
    notas: '',
  });

  const [repModal, setRepModal] = useState(false);
  const [repForm, setRepForm] = useState({
    id: '' as string | undefined,
    entidad_id: '',
    nombre_completo: '',
    cedula: '',
    cargo: 'Representante Legal',
    telefono: '',
    email: '',
    es_principal: false,
  });

  const [cuentaModal, setCuentaModal] = useState(false);
  const [cuentaForm, setCuentaForm] = useState({
    id: '' as string | undefined,
    entidad_id: '',
    banco: '',
    tipo_cuenta: 'Corriente',
    numero_cuenta: '',
    titular: '',
    moneda: 'USD',
    es_principal: false,
  });

  const [textoModal, setTextoModal] = useState(false);
  const [textoForm, setTextoForm] = useState({
    id: '' as string | undefined,
    slug: '',
    titulo: '',
    categoria: 'general' as FiscalTextoCategoria,
    contenido: '',
  });

  const [paramModal, setParamModal] = useState(false);
  const [paramForm, setParamForm] = useState({
    id: '' as string | undefined,
    clave: '',
    etiqueta: '',
    valor: '',
    grupo: 'tributario' as FiscalParametroGrupo,
  });

  const filteredEntidades = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entidades;
    return entidades.filter((e) =>
      [e.nombre_comercial, e.razon_social, e.rif, e.ciudad, e.email]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [entidades, search]);

  const filteredTextos = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return textos;
    return textos.filter((t) =>
      [t.titulo, t.slug, t.categoria, t.contenido].join(' ').toLowerCase().includes(q),
    );
  }, [textos, search]);

  const filteredParams = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return parametros;
    return parametros.filter((p) =>
      [p.clave, p.etiqueta, p.valor, p.grupo].join(' ').toLowerCase().includes(q),
    );
  }, [parametros, search]);

  function run(action: () => Promise<{ ok: boolean; message: string }>, onOk?: () => void) {
    startTransition(async () => {
      const res = await action();
      setMsg(res.message);
      if (res.ok) onOk?.();
    });
  }

  function openEntidadCreate() {
    setEntidadForm({
      id: undefined,
      nombre_comercial: '',
      razon_social: '',
      rif: '',
      direccion_fiscal: '',
      direccion_operativa: '',
      ciudad: '',
      estado_region: '',
      telefono: '',
      email: '',
      actividad_economica: '',
      es_emisor_principal: entidades.length === 0,
      notas: '',
    });
    setEntidadModal(true);
  }

  function openEntidadEdit(e: FiscalEntidadCompleta) {
    setEntidadForm({
      id: e.id,
      nombre_comercial: e.nombre_comercial,
      razon_social: e.razon_social,
      rif: e.rif,
      direccion_fiscal: e.direccion_fiscal,
      direccion_operativa: e.direccion_operativa || '',
      ciudad: e.ciudad || '',
      estado_region: e.estado_region || '',
      telefono: e.telefono || '',
      email: e.email || '',
      actividad_economica: e.actividad_economica || '',
      es_emisor_principal: e.es_emisor_principal,
      notas: e.notas || '',
    });
    setEntidadModal(true);
  }

  const addLabel =
    tab === 'entidades' ? 'Nueva entidad' : tab === 'textos' ? 'Nuevo texto' : 'Nuevo parámetro';

  function onAdd() {
    if (tab === 'entidades') openEntidadCreate();
    else if (tab === 'textos') {
      setTextoForm({ id: undefined, slug: '', titulo: '', categoria: 'factura', contenido: '' });
      setTextoModal(true);
    } else {
      setParamForm({ id: undefined, clave: '', etiqueta: '', valor: '', grupo: 'tributario' });
      setParamModal(true);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-6 sm:gap-8">
      <p className="text-sm text-white/55">
        Banco central de razón social, RIF, representantes, cuentas y cláusulas para alimentar facturas,
        balances legales y planillas.
      </p>

      {msg && (
        <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
          {msg}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setSearch('');
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                tab === id
                  ? 'mineos-plat-chip border'
                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white/85'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="input-field w-full pl-9"
            />
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="mineos-plat-btn inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        </div>
      </div>

      {tab === 'entidades' && (
        <div className="flex flex-col gap-4">
          {filteredEntidades.length === 0 ? (
            <Empty hint="Registra la razón social emisora, RIF y dirección fiscal para documentos." />
          ) : (
            filteredEntidades.map((e) => (
              <article
                key={e.id}
                className="card-glass rounded-xl border border-white/[0.08] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-white">{e.nombre_comercial}</h2>
                      {e.es_emisor_principal && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                          <Star className="h-3 w-3" />
                          Emisor principal
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-white/60">{e.razon_social}</p>
                    <p className="mineos-plat-code mt-1 text-xs">RIF {e.rif}</p>
                    <p className="mt-2 text-xs text-white/50">{e.direccion_fiscal}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEntidadEdit(e)}
                      className="rounded-lg border border-white/10 p-2 text-white/60 hover:bg-white/5 hover:text-white"
                      title="Editar entidad"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={async () => {
                        if (!(await confirmDialog({
                          title: 'Eliminar entidad',
                          message: '¿Eliminar esta entidad y sus datos vinculados?',
                          variant: 'danger'
                        }))) return;
                        run(() => deleteFiscalEntidadAction(e.id));
                      }}
                      className="rounded-lg border border-red-500/20 p-2 text-red-300/80 hover:bg-red-500/10"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-white/45">
                        Representantes
                      </h3>
                      <button
                        type="button"
                        className="mineos-plat-link text-[11px] font-semibold"
                        onClick={() => {
                          setRepForm({
                            id: undefined,
                            entidad_id: e.id,
                            nombre_completo: '',
                            cedula: '',
                            cargo: 'Representante Legal',
                            telefono: '',
                            email: '',
                            es_principal: e.representantes.length === 0,
                          });
                          setRepModal(true);
                        }}
                      >
                        + Añadir
                      </button>
                    </div>
                    {e.representantes.length === 0 ? (
                      <p className="text-xs text-white/40">Sin representantes.</p>
                    ) : (
                      <ul className="space-y-2">
                        {e.representantes.map((r) => (
                          <li
                            key={r.id}
                            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/70"
                          >
                            <span className="font-medium text-white/90">{r.nombre_completo}</span>
                            {r.es_principal && (
                              <span className="ml-2 text-[10px] text-amber-300">principal</span>
                            )}
                            <div className="text-white/50">
                              {r.cargo}
                              {r.cedula ? ` · CI ${r.cedula}` : ''}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-white/45">
                        Cuentas bancarias
                      </h3>
                      <button
                        type="button"
                        className="mineos-plat-link text-[11px] font-semibold"
                        onClick={() => {
                          setCuentaForm({
                            id: undefined,
                            entidad_id: e.id,
                            banco: '',
                            tipo_cuenta: 'Corriente',
                            numero_cuenta: '',
                            titular: e.razon_social,
                            moneda: 'USD',
                            es_principal: e.cuentas.length === 0,
                          });
                          setCuentaModal(true);
                        }}
                      >
                        + Añadir
                      </button>
                    </div>
                    {e.cuentas.length === 0 ? (
                      <p className="text-xs text-white/40">Sin cuentas.</p>
                    ) : (
                      <ul className="space-y-2">
                        {e.cuentas.map((c) => (
                          <li
                            key={c.id}
                            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/70"
                          >
                            <span className="font-medium text-white/90">{c.banco}</span>
                            {c.es_principal && (
                              <span className="ml-2 text-[10px] text-amber-300">principal</span>
                            )}
                            <div className="font-mono text-white/55">
                              {c.tipo_cuenta} · {c.numero_cuenta} ({c.moneda})
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {tab === 'textos' && (
        <div className="flex flex-col gap-3">
          {filteredTextos.length === 0 ? (
            <Empty hint="Pie de factura, notas legales de balance o encabezados de planilla." />
          ) : (
            filteredTextos.map((t) => (
              <article
                key={t.id}
                className="card-glass flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/[0.08] p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-white">{t.titulo}</h2>
                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/50">
                      {CATEGORIA_LABEL[t.categoria]}
                    </span>
                    <code className="mineos-plat-code text-[10px]">{t.slug}</code>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-white/55">{t.contenido}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTextoForm({
                        id: t.id,
                        slug: t.slug,
                        titulo: t.titulo,
                        categoria: t.categoria,
                        contenido: t.contenido,
                      });
                      setTextoModal(true);
                    }}
                    className="rounded-lg border border-white/10 p-2 text-white/60 hover:bg-white/5"
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={async () => {
                      if (!(await confirmDialog({
                        title: 'Eliminar texto',
                        message: '¿Eliminar este texto?',
                        variant: 'danger'
                      }))) return;
                      run(() => deleteFiscalTextoAction(t.id));
                    }}
                    className="rounded-lg border border-red-500/20 p-2 text-red-300/80 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {tab === 'parametros' && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/45">
                <th className="px-4 py-3">Etiqueta</th>
                <th className="px-4 py-3">Clave</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Grupo</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filteredParams.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-white/45">
                    Sin parámetros. Ej.: alícuota IVA, prefijo de factura, ciudad de emisión.
                  </td>
                </tr>
              ) : (
                filteredParams.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white/85">{p.etiqueta}</td>
                    <td className="mineos-plat-code px-4 py-3 text-xs">{p.clave}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-white/60" title={p.valor}>
                      {p.valor}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{GRUPO_LABEL[p.grupo]}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setParamForm({
                            id: p.id,
                            clave: p.clave,
                            etiqueta: p.etiqueta,
                            valor: p.valor,
                            grupo: p.grupo,
                          });
                          setParamModal(true);
                        }}
                        className="rounded border border-white/10 p-1.5 text-white/55 hover:text-white"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <PageFormModal open={entidadModal} onClose={() => setEntidadModal(false)}>
        <form
          className="page-form-modal-panel max-h-[85vh] overflow-y-auto p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => upsertFiscalEntidadAction(entidadForm), () => setEntidadModal(false));
          }}
        >
          <h2 className="text-lg font-bold text-white">
            {entidadForm.id ? 'Editar entidad' : 'Nueva entidad'}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nombre comercial" className="sm:col-span-2">
              <input
                className="input-field w-full"
                value={entidadForm.nombre_comercial}
                onChange={(ev) => setEntidadForm({ ...entidadForm, nombre_comercial: ev.target.value })}
                required
              />
            </Field>
            <Field label="Razón social" className="sm:col-span-2">
              <input
                className="input-field w-full"
                value={entidadForm.razon_social}
                onChange={(ev) => setEntidadForm({ ...entidadForm, razon_social: ev.target.value })}
                required
              />
            </Field>
            <Field label="RIF">
              <input
                className="input-field w-full"
                value={entidadForm.rif}
                onChange={(ev) => setEntidadForm({ ...entidadForm, rif: ev.target.value })}
                required
              />
            </Field>
            <Field label="Ciudad">
              <input
                className="input-field w-full"
                value={entidadForm.ciudad}
                onChange={(ev) => setEntidadForm({ ...entidadForm, ciudad: ev.target.value })}
              />
            </Field>
            <Field label="Dirección fiscal" className="sm:col-span-2">
              <textarea
                className="input-field min-h-[72px] w-full resize-y"
                value={entidadForm.direccion_fiscal}
                onChange={(ev) => setEntidadForm({ ...entidadForm, direccion_fiscal: ev.target.value })}
                required
              />
            </Field>
            <Field label="Dirección operativa" className="sm:col-span-2">
              <textarea
                className="input-field min-h-[60px] w-full resize-y"
                value={entidadForm.direccion_operativa}
                onChange={(ev) => setEntidadForm({ ...entidadForm, direccion_operativa: ev.target.value })}
              />
            </Field>
            <Field label="Teléfono">
              <input
                className="input-field w-full"
                value={entidadForm.telefono}
                onChange={(ev) => setEntidadForm({ ...entidadForm, telefono: ev.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className="input-field w-full"
                value={entidadForm.email}
                onChange={(ev) => setEntidadForm({ ...entidadForm, email: ev.target.value })}
              />
            </Field>
            <Field label="Actividad económica" className="sm:col-span-2">
              <input
                className="input-field w-full"
                value={entidadForm.actividad_economica}
                onChange={(ev) => setEntidadForm({ ...entidadForm, actividad_economica: ev.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 sm:col-span-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={entidadForm.es_emisor_principal}
                onChange={(ev) =>
                  setEntidadForm({ ...entidadForm, es_emisor_principal: ev.target.checked })
                }
              />
              Usar como emisor principal en facturas y documentos
            </label>
          </div>
          <PageFormModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setEntidadModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              Guardar
            </button>
          </PageFormModalFooter>
        </form>
      </PageFormModal>

      <PageFormModal open={repModal} onClose={() => setRepModal(false)}>
        <form
          className="page-form-modal-panel p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => upsertFiscalRepresentanteAction(repForm), () => setRepModal(false));
          }}
        >
          <h2 className="text-lg font-bold text-white">Representante legal</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nombre completo" className="sm:col-span-2">
              <input
                className="input-field w-full"
                value={repForm.nombre_completo}
                onChange={(ev) => setRepForm({ ...repForm, nombre_completo: ev.target.value })}
                required
              />
            </Field>
            <Field label="Cédula">
              <input
                className="input-field w-full"
                value={repForm.cedula}
                onChange={(ev) => setRepForm({ ...repForm, cedula: ev.target.value })}
              />
            </Field>
            <Field label="Cargo">
              <input
                className="input-field w-full"
                value={repForm.cargo}
                onChange={(ev) => setRepForm({ ...repForm, cargo: ev.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 sm:col-span-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={repForm.es_principal}
                onChange={(ev) => setRepForm({ ...repForm, es_principal: ev.target.checked })}
              />
              Representante principal
            </label>
          </div>
          <PageFormModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setRepModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              Guardar
            </button>
          </PageFormModalFooter>
        </form>
      </PageFormModal>

      <PageFormModal open={cuentaModal} onClose={() => setCuentaModal(false)}>
        <form
          className="page-form-modal-panel p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => upsertFiscalCuentaAction(cuentaForm), () => setCuentaModal(false));
          }}
        >
          <h2 className="text-lg font-bold text-white">Cuenta bancaria</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Banco" className="sm:col-span-2">
              <input
                className="input-field w-full"
                value={cuentaForm.banco}
                onChange={(ev) => setCuentaForm({ ...cuentaForm, banco: ev.target.value })}
                required
              />
            </Field>
            <Field label="Número de cuenta">
              <input
                className="input-field w-full"
                value={cuentaForm.numero_cuenta}
                onChange={(ev) => setCuentaForm({ ...cuentaForm, numero_cuenta: ev.target.value })}
                required
              />
            </Field>
            <Field label="Moneda">
              <input
                className="input-field w-full"
                value={cuentaForm.moneda}
                onChange={(ev) => setCuentaForm({ ...cuentaForm, moneda: ev.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 sm:col-span-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={cuentaForm.es_principal}
                onChange={(ev) => setCuentaForm({ ...cuentaForm, es_principal: ev.target.checked })}
              />
              Cuenta principal para cobros
            </label>
          </div>
          <PageFormModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setCuentaModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              Guardar
            </button>
          </PageFormModalFooter>
        </form>
      </PageFormModal>

      <PageFormModal open={textoModal} onClose={() => setTextoModal(false)}>
        <form
          className="page-form-modal-panel max-h-[85vh] overflow-y-auto p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => upsertFiscalTextoAction(textoForm), () => setTextoModal(false));
          }}
        >
          <h2 className="text-lg font-bold text-white">
            {textoForm.id ? 'Editar texto legal' : 'Nuevo texto legal'}
          </h2>
          <div className="mt-4 grid gap-3">
            <Field label="Título">
              <input
                className="input-field w-full"
                value={textoForm.titulo}
                onChange={(ev) => setTextoForm({ ...textoForm, titulo: ev.target.value })}
                required
              />
            </Field>
            <Field label="Clave (slug)">
              <input
                className="input-field w-full font-mono text-sm"
                value={textoForm.slug}
                onChange={(ev) => setTextoForm({ ...textoForm, slug: ev.target.value })}
                placeholder="pie_factura"
                required
              />
            </Field>
            <Field label="Categoría">
              <select
                className="input-field w-full"
                value={textoForm.categoria}
                onChange={(ev) =>
                  setTextoForm({ ...textoForm, categoria: ev.target.value as FiscalTextoCategoria })
                }
              >
                {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contenido">
              <textarea
                className="input-field min-h-[140px] w-full resize-y font-mono text-sm"
                value={textoForm.contenido}
                onChange={(ev) => setTextoForm({ ...textoForm, contenido: ev.target.value })}
              />
            </Field>
          </div>
          <PageFormModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setTextoModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              Guardar
            </button>
          </PageFormModalFooter>
        </form>
      </PageFormModal>

      <PageFormModal open={paramModal} onClose={() => setParamModal(false)}>
        <form
          className="page-form-modal-panel p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => upsertFiscalParametroAction(paramForm), () => {
              setParamModal(false);
              setParamForm({ id: undefined, clave: '', etiqueta: '', valor: '', grupo: 'tributario' });
            });
          }}
        >
          <h2 className="text-lg font-bold text-white">
            {paramForm.id ? 'Editar parámetro' : 'Nuevo parámetro'}
          </h2>
          <div className="mt-4 grid gap-3">
            <Field label="Etiqueta visible">
              <input
                className="input-field w-full"
                value={paramForm.etiqueta}
                onChange={(ev) => setParamForm({ ...paramForm, etiqueta: ev.target.value })}
                required
              />
            </Field>
            <Field label="Clave interna">
              <input
                className="input-field w-full font-mono"
                value={paramForm.clave}
                onChange={(ev) => setParamForm({ ...paramForm, clave: ev.target.value })}
                required
              />
            </Field>
            <Field label="Valor">
              <textarea
                className="input-field min-h-[80px] w-full resize-y"
                value={paramForm.valor}
                onChange={(ev) => setParamForm({ ...paramForm, valor: ev.target.value })}
              />
            </Field>
            <Field label="Grupo">
              <select
                className="input-field w-full"
                value={paramForm.grupo}
                onChange={(ev) =>
                  setParamForm({ ...paramForm, grupo: ev.target.value as FiscalParametroGrupo })
                }
              >
                {Object.entries(GRUPO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <PageFormModalFooter>
            <button type="button" className="btn-secondary" onClick={() => setParamModal(false)}>
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

function Empty({ hint }: { hint: string }) {
  return (
    <div className="card-glass rounded-xl border border-dashed border-white/[0.12] p-8 text-center">
      <p className="text-sm text-white/55">{hint}</p>
    </div>
  );
}
