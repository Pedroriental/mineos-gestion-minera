'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { Wrench, Plus, X, Loader2, Edit2, Trash2 } from 'lucide-react';
import type { Equipo } from '@/lib/types';

export default function EquiposPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [data, setData] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Equipo | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { codigo: '', nombre: '', tipo: 'compresor' as Equipo['tipo'], ubicacion: '', estado: 'operativo' as Equipo['estado'], horas_operacion: '', observaciones: '' };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('equipos').select('*').eq('activo', true).order('nombre');
    setData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, horas_operacion: parseFloat(form.horas_operacion) || 0 };
    if (editItem) {
      await supabase.from('equipos').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('equipos').insert(payload);
    }
    setSaving(false); setShowModal(false); setEditItem(null); setForm(emptyForm); loadData();
  };

  const handleDelete = async (e: React.MouseEvent, id: string, nombre: string) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar el equipo "${nombre}"? El equipo será desactivado y ya no aparecerá en la lista.`)) return;
    await supabase.from('equipos').update({ activo: false }).eq('id', id);
    loadData();
  };

  const openEdit = (item: Equipo) => {
    setEditItem(item);
    setForm({ codigo: item.codigo, nombre: item.nombre, tipo: item.tipo, ubicacion: item.ubicacion || '', estado: item.estado, horas_operacion: String(item.horas_operacion), observaciones: item.observaciones || '' });
    setShowModal(true);
  };

  const tipoLabels: Record<string, string> = { compresor: 'Compresor', perforadora: 'Perforadora', volqueta: 'Volqueta', bomba: 'Bomba', generador: 'Generador', ventilador: 'Ventilador', otro: 'Otro' };
  const estadoBadge: Record<string, string> = { operativo: 'badge-success', en_mantenimiento: 'badge-warning', fuera_servicio: 'badge-danger', en_reparacion: 'badge-info' };
  const estadoLabel: Record<string, string> = { operativo: 'Operativo', en_mantenimiento: 'Mantenimiento', fuera_servicio: 'Fuera Servicio', en_reparacion: 'En Reparación' };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Wrench className="w-6 h-6 text-orange-400" /> Equipos
          </h1>
          <p className="text-white/40 text-sm mt-1">{data.filter(e => e.estado === 'operativo').length} operativos de {data.length}</p>
        </div>
        <button onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true); }} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed" title={!canEdit ? 'Modo observador: solo lectura' : undefined}>
          <Plus className="w-4 h-4" /> Nuevo Equipo
        </button>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {data.map(eq => (
            <div key={eq.id} className="card-glass p-5 cursor-pointer group" onClick={() => openEdit(eq)}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-amber-400">{eq.codigo}</span>
                <span className={`badge ${estadoBadge[eq.estado]}`}>{estadoLabel[eq.estado]}</span>
              </div>
              <h3 className="font-semibold text-white/85 mb-1">{eq.nombre}</h3>
              <p className="text-sm text-white/40">{tipoLabels[eq.tipo]}{eq.ubicacion ? ` — ${eq.ubicacion}` : ''}</p>
              <div className="mt-3 pt-3 border-t border-white/[0.07] flex justify-between items-center text-xs text-white/40">
                <span>{eq.horas_operacion}h operación</span>
                <div className="flex items-center gap-1">
                  <span className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, eq.id, eq.nombre)}
                    className="p-1 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Eliminar equipo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {data.length === 0 && <p className="col-span-3 text-center py-12 text-white/40">Sin equipos registrados</p>}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-2xl bg-[#091820]/98 border border-white/[0.10] rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-white/90">{editItem ? 'Editar Equipo' : 'Nuevo Equipo'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div><label className="input-label">Código *</label><input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className="input-field" placeholder="Ej: COMP-01" /></div>
              <div>
                <label className="input-label">Tipo *</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as Equipo['tipo'] })} className="input-field">
                  {Object.entries(tipoLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Nombre *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="input-field" placeholder="Sullair 185" /></div>
              <div>
                <label className="input-label">Estado</label>
                <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as Equipo['estado'] })} className="input-field">
                  {Object.entries(estadoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="input-label">Horas Operación</label><input type="number" step="0.1" value={form.horas_operacion} onChange={e => setForm({ ...form, horas_operacion: e.target.value })} className="input-field font-semibold text-amber-700" /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Ubicación</label><input value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} className="input-field" placeholder="Zona, Veta o Área" /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Observaciones</label><textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="input-field" rows={2} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/[0.07]">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.codigo || !form.nombre} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar Equipo' : 'Registrar Equipo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
