'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { Users, Plus, Search, X, Loader2, Edit2, Trash2, AlertCircle } from 'lucide-react';
import type { Personal } from '@/lib/types';
import EmptyState from '@/components/EmptyState';


export default function NominaPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [data, setData] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Personal | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    cedula: '', nombre_completo: '', cargo: '', area: 'mina' as Personal['area'],
    salario_base: '', telefono: '', notas: '', fecha_ingreso: new Date().toISOString().split('T')[0],
  });

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('personal').select('*').eq('activo', true).order('nombre_completo');
    setData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setForm({ cedula: '', nombre_completo: '', cargo: '', area: 'mina', salario_base: '', telefono: '', notas: '', fecha_ingreso: new Date().toISOString().split('T')[0] });
    setEditItem(null);
  };

  const openNew = () => { resetForm(); setShowModal(true); };
  const openEdit = (item: Personal) => {
    setEditItem(item);
    setForm({
      cedula: item.cedula, nombre_completo: item.nombre_completo, cargo: item.cargo,
      area: item.area, salario_base: String(item.salario_base), telefono: item.telefono || '',
      notas: item.notas || '', fecha_ingreso: item.fecha_ingreso,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    // ── Inline validation ──
    const salario = parseFloat(form.salario_base);
    if (isNaN(salario) || salario <= 0) {
      setFormError('El salario base debe ser mayor que cero.');
      return;
    }
    if (!form.cedula.trim()) { setFormError('La cédula es obligatoria.'); return; }
    if (!form.nombre_completo.trim()) { setFormError('El nombre es obligatorio.'); return; }
    if (!form.cargo.trim()) { setFormError('El cargo es obligatorio.'); return; }
    setFormError(null);
    setSaving(true);
    const payload = { ...form, salario_base: salario };
    if (editItem) {
      await supabase.from('personal').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('personal').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    resetForm();
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este trabajador?')) return;
    await supabase.from('personal').update({ activo: false }).eq('id', id);
    loadData();
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const filtered = data.filter(p => p.nombre_completo.toLowerCase().includes(search.toLowerCase()) || p.cedula.includes(search));

  const areaLabels: Record<string, string> = { mina: 'Mina', planta: 'Planta', administracion: 'Admin', seguridad: 'Seguridad', transporte: 'Transporte' };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Users className="w-6 h-6 text-amber-400" /> Nómina
          </h1>
          <p className="text-white/40 text-sm mt-1">{data.length} trabajadores activos</p>
        </div>
        <button onClick={openNew} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed" title={!canEdit ? 'Modo observador: solo lectura' : undefined}>
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o cédula..."
          className="input-field pl-10"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <>
          {/* VISTA MÓVIL (Tarjetas) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map(p => (
              <div key={p.id} className="card-glass p-4 relative">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">
                      {p.cedula}
                    </span>
                    <h3 className="font-bold text-white/85 mt-2 text-base leading-tight">{p.nombre_completo}</h3>
                    <p className="text-sm text-white/55 mt-1">{p.cargo} <span className="badge badge-neutral scale-90 origin-left ml-1">{areaLabels[p.area]}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-amber-400 text-lg block leading-none">{fmt(p.salario_base)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 mt-3 text-sm bg-white/[0.05] p-2.5 rounded-lg border border-white/[0.07]">
                  <div>
                    <span className="text-xs text-white/35 block mb-0.5">Ingreso</span>
                    <span className="text-white/70 font-medium">{p.fecha_ingreso}</span>
                  </div>
                  {p.telefono && (
                    <div>
                      <span className="text-xs text-white/35 block mb-0.5">Teléfono</span>
                      <span className="text-white/70 font-medium">{p.telefono}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                  <button onClick={() => openEdit(p)} className="btn-secondary !py-1.5 !px-3 !text-xs"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                  <button onClick={() => handleDelete(p.id)} className="btn-danger !py-1.5 !px-3 !text-xs"><Trash2 className="w-3.5 h-3.5" /> Archivar</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <EmptyState
                icon={<Users className="w-8 h-8" />}
                title="Sin trabajadores"
                description={search ? 'No coincide ningún resultado.' : 'Registra el primer trabajador de la nómina.'}
                action={canEdit && !search ? { label: 'Agregar primer trabajador', onClick: openNew } : undefined}
              />
            )}
          </div>

          {/* VISTA ESCRITORIO (Tabla) */}
          <div className="table-container hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombre</th>
                  <th>Cargo</th>
                  <th>Área</th>
                  <th>Salario</th>
                  <th>Ingreso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-white/50">{p.cedula}</td>
                    <td className="text-white/80 font-medium">{p.nombre_completo}</td>
                    <td className="text-white/50">{p.cargo}</td>
                    <td>
                      <span className="badge badge-neutral">{areaLabels[p.area]}</span>
                    </td>
                    <td className="text-amber-400 font-semibold">{fmt(p.salario_base)}</td>
                    <td className="text-white/40">{p.fecha_ingreso}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-0">
                      <EmptyState
                        icon={<Users className="w-8 h-8" />}
                        title="Sin trabajadores"
                        description={search ? 'No coincide ningún resultado.' : 'Registra el primer trabajador.'}
                        action={canEdit && !search ? { label: 'Agregar primer trabajador', onClick: openNew } : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowModal(false); setFormError(null); }}>
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Trabajador' : 'Nuevo Trabajador'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="input-label">Cédula *</label><input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} className="input-field" required /></div>
              <div><label className="input-label">Fecha Ingreso</label><input type="date" value={form.fecha_ingreso} onChange={e => setForm({ ...form, fecha_ingreso: e.target.value })} className="input-field" /></div>
              <div className="md:col-span-2"><label className="input-label">Nombre Completo *</label><input value={form.nombre_completo} onChange={e => setForm({ ...form, nombre_completo: e.target.value })} className="input-field" required /></div>
              <div><label className="input-label">Cargo *</label><input value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} className="input-field" required /></div>
              <div><label className="input-label">Área *</label>
                <select value={form.area} onChange={e => setForm({ ...form, area: e.target.value as Personal['area'] })} className="input-field">
                  <option value="mina">Mina</option><option value="planta">Planta</option><option value="administracion">Administración</option>
                  <option value="seguridad">Seguridad</option><option value="transporte">Transporte</option>
                </select>
              </div>
              <div><label className="input-label">Salario Base (USD) *</label><input type="number" step="0.01" min="0.01" value={form.salario_base} onChange={e => { setForm({ ...form, salario_base: e.target.value }); setFormError(null); }} className="input-field" placeholder="0.00" required /></div>
              <div><label className="input-label">Teléfono</label><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="input-field" /></div>
              <div className="md:col-span-2"><label className="input-label">Notas</label><textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className="input-field" rows={2} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{editItem ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
