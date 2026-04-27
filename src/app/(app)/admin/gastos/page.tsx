'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { DollarSign, Plus, Search, X, Loader2, Edit2, Trash2, AlertCircle } from 'lucide-react';
import type { Gasto, CategoriaGasto } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { toast } from 'sonner';

// Server Actions (las importaciones de 'use server' son seguras en 'use client')
import { createGasto, updateGasto, deleteGasto } from '@/lib/actions/gastos';

export default function GastosPage() {
  const { user } = useAuth();
  const canEdit  = useCanEdit();

  const [data,       setData]       = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState<Gasto | null>(null);
  const [formError,  setFormError]  = useState<string | null>(null);

  // useTransition: isPending desactiva el botón mientras el Server Action ejecuta
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    fecha:              new Date().toISOString().split('T')[0],
    categoria_id:       '',
    descripcion:        '',
    monto:              '',
    proveedor:          '',
    factura_referencia: '',
    notas:              '',
  });

  // ── Carga inicial (solo lectura, sigue siendo client-side) ──
  const loadData = useCallback(async () => {
    const [gastosRes, catsRes] = await Promise.all([
      supabase
        .from('gastos')
        .select('*, categorias_gasto(nombre, tipo)')
        .order('fecha', { ascending: false })
        .limit(100),
      supabase.from('categorias_gasto').select('*').eq('activo', true).order('nombre'),
    ]);
    setData(gastosRes.data || []);
    setCategorias(catsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Helpers de formulario ────────────────────────────────────
  const resetForm = () => {
    setForm({
      fecha: new Date().toISOString().split('T')[0],
      categoria_id: '', descripcion: '', monto: '',
      proveedor: '', factura_referencia: '', notas: '',
    });
    setEditItem(null);
    setFormError(null);
  };

  const openNew  = () => { resetForm(); setShowModal(true); };
  const openEdit = (item: Gasto) => {
    setEditItem(item);
    setForm({
      fecha:              item.fecha,
      categoria_id:       item.categoria_id,
      descripcion:        item.descripcion,
      monto:              String(item.monto),
      proveedor:          item.proveedor          || '',
      factura_referencia: item.factura_referencia || '',
      notas:              item.notas              || '',
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); resetForm(); };

  // ── MUTACIÓN via Server Action ───────────────────────────────
  const handleSave = () => {
    setFormError(null);

    const montoNum = parseFloat(form.monto);
    // Validación rápida en cliente para evitar round-trip innecesario
    if (!form.categoria_id) { setFormError('Selecciona una categoría.'); return; }
    if (!form.descripcion.trim()) { setFormError('La descripción es obligatoria.'); return; }
    if (!form.monto || isNaN(montoNum) || montoNum <= 0) {
      setFormError('El monto debe ser un número mayor que cero.');
      return;
    }

    const payload = {
      fecha:              form.fecha,
      categoria_id:       form.categoria_id,
      descripcion:        form.descripcion,
      monto:              montoNum,
      proveedor:          form.proveedor          || null,
      factura_referencia: form.factura_referencia || null,
      notas:              form.notas              || null,
      registrado_por:     user?.id                || null,
      ...(editItem ? { id: editItem.id } : {}),
    };

    startTransition(async () => {
      // Llama al Server Action correspondiente
      const result = editItem
        ? await updateGasto(payload)
        : await createGasto(payload);

      if (result.ok) {
        toast.success(result.message);
        closeModal();
        // Recargar lista local (revalidatePath ya actualizó el servidor)
        loadData();
      } else {
        // Error de validación Zod o error de Supabase
        setFormError(result.message);
        toast.error(result.message);
      }
    });
  };

  // ── ELIMINAR via Server Action ───────────────────────────────
  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    startTransition(async () => {
      const result = await deleteGasto(id);
      if (result.ok) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.message);
      }
    });
  };

  // ── Helpers de presentación ──────────────────────────────────
  const fmt         = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const totalGastos = data.reduce((s, g) => s + Number(g.monto), 0);
  const filtered    = data.filter((g) =>
    g.descripcion.toLowerCase().includes(search.toLowerCase()),
  );

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-red-400" /> Gastos
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Total visible: {fmt(totalGastos)} — {data.length} registros
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={!canEdit || isPending}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          title={!canEdit ? 'Modo observador: solo lectura' : undefined}
        >
          <Plus className="w-4 h-4" /> Registrar Gasto
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar gastos..."
          className="input-field pl-10"
        />
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* VISTA MÓVIL */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map((g) => (
              <div key={g.id} className="card-glass p-4 relative">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">
                      {g.fecha}
                    </span>
                    <h3 className="font-bold text-white/85 mt-2 text-base leading-tight">{g.descripcion}</h3>
                    <p className="text-sm text-white/55 mt-1">
                      <span className="badge badge-neutral scale-90 origin-left">
                        {g.categorias_gasto?.nombre || '—'}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-red-400 text-lg block leading-none">{fmt(g.monto)}</span>
                  </div>
                </div>

                {(g.proveedor || g.factura_referencia) ? (
                  <div className="grid grid-cols-2 gap-2 mb-4 mt-3 text-sm bg-white/[0.05] p-2.5 rounded-lg border border-white/[0.07]">
                    {g.proveedor && (
                      <div className="overflow-hidden">
                        <span className="text-xs text-white/35 block mb-0.5">Proveedor</span>
                        <span className="text-white/70 font-medium truncate block">{g.proveedor}</span>
                      </div>
                    )}
                    {g.factura_referencia && (
                      <div className="overflow-hidden">
                        <span className="text-xs text-white/35 block mb-0.5">Ref. Factura</span>
                        <span className="text-white/70 font-medium truncate block">{g.factura_referencia}</span>
                      </div>
                    )}
                  </div>
                ) : <div className="mb-4" />}

                <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                  <button onClick={() => openEdit(g)} disabled={isPending} className="btn-secondary !py-1.5 !px-3 !text-xs">
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => handleDelete(g.id)} disabled={isPending} className="btn-danger !py-1.5 !px-3 !text-xs">
                    <Trash2 className="w-3.5 h-3.5" /> Borrar
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <EmptyState
                icon={<DollarSign className="w-8 h-8" />}
                title="Sin gastos registrados"
                description={search ? 'No se encontraron resultados.' : 'Registra el primer gasto operativo.'}
                action={canEdit && !search ? { label: 'Registrar primer gasto', onClick: openNew } : undefined}
              />
            )}
          </div>

          {/* VISTA ESCRITORIO */}
          <div className="table-container hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Proveedor</th>
                  <th className="text-right">Monto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td className="text-white/40 whitespace-nowrap">{g.fecha}</td>
                    <td className="text-white/80 font-medium max-w-[250px] truncate" title={g.descripcion}>
                      {g.descripcion}
                    </td>
                    <td><span className="badge badge-neutral">{g.categorias_gasto?.nombre || '—'}</span></td>
                    <td className="text-white/40">{g.proveedor || '—'}</td>
                    <td className="text-right font-semibold text-red-400 whitespace-nowrap">{fmt(g.monto)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(g)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors disabled:opacity-40"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(g.id)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-0">
                      <EmptyState
                        icon={<DollarSign className="w-8 h-8" />}
                        title="Sin gastos registrados"
                        description={search ? 'No coincide ningún resultado.' : 'Registra el primer gasto operativo del período.'}
                        action={canEdit && !search ? { label: 'Registrar primer gasto', onClick: openNew } : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">
                {editItem ? 'Editar Gasto' : 'Nuevo Gasto'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inline error (validación Zod devuelta del servidor) */}
            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            {/* Form fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Fecha *</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">Categoría *</label>
                <select
                  value={form.categoria_id}
                  onChange={(e) => { setForm({ ...form, categoria_id: e.target.value }); setFormError(null); }}
                  className="input-field"
                >
                  <option value="">Seleccionar...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="input-label">Descripción *</label>
                <input
                  value={form.descripcion}
                  onChange={(e) => { setForm({ ...form, descripcion: e.target.value }); setFormError(null); }}
                  className="input-field"
                  placeholder="Ej: Compra de combustible para generador"
                />
              </div>
              <div>
                <label className="input-label">Monto (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.monto}
                  onChange={(e) => { setForm({ ...form, monto: e.target.value }); setFormError(null); }}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="input-label">Proveedor</label>
                <input
                  value={form.proveedor}
                  onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">Ref. Factura</label>
                <input
                  value={form.factura_referencia}
                  onChange={(e) => setForm({ ...form, factura_referencia: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">Notas</label>
                <input
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={closeModal} disabled={isPending} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="btn-primary min-w-[110px] justify-center"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : editItem ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
