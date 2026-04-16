'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { Shield, Plus, X, Loader2, Edit2 } from 'lucide-react';
import type { MejoraSeguridad } from '@/lib/types';
import EmptyState from '@/components/EmptyState';


export default function SeguridadPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [data, setData] = useState<MejoraSeguridad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MejoraSeguridad | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { fecha: new Date().toISOString().split('T')[0], tipo: 'mejora_proceso' as MejoraSeguridad['tipo'], titulo: '', descripcion: '', area: 'mina' as MejoraSeguridad['area'], prioridad: 'normal' as MejoraSeguridad['prioridad'], estado: 'reportado' as MejoraSeguridad['estado'], responsable: '', costo_estimado: '' };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('mejoras_seguridad').select('*').order('fecha', { ascending: false });
    setData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, costo_estimado: parseFloat(form.costo_estimado) || null, registrado_por: user?.id };
    if (editItem) {
      const { registrado_por, ...up } = payload;
      await supabase.from('mejoras_seguridad').update(up).eq('id', editItem.id);
    } else {
      await supabase.from('mejoras_seguridad').insert(payload);
    }
    setSaving(false); setShowModal(false); setEditItem(null); setForm(emptyForm); loadData();
  };

  const tipoLabel: Record<string, string> = { mejora_infraestructura: 'Infraestructura', mejora_proceso: 'Proceso', incidente: 'Incidente', inspeccion: 'Inspección', capacitacion: 'Capacitación' };
  const tipoBadge: Record<string, string> = { mejora_infraestructura: 'badge-info', mejora_proceso: 'badge-gold', incidente: 'badge-danger', inspeccion: 'badge-neutral', capacitacion: 'badge-success' };
  const estadoBadge: Record<string, string> = { reportado: 'badge-warning', en_proceso: 'badge-info', completado: 'badge-success', descartado: 'badge-neutral' };
  const prioridadBadge: Record<string, string> = { baja: 'badge-neutral', normal: 'badge-info', alta: 'badge-warning', critica: 'badge-danger' };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" /> Mejoras y Seguridad
          </h1>
          <p className="text-white/40 text-sm mt-1">{data.filter(d => d.estado !== 'completado' && d.estado !== 'descartado').length} activos</p>
        </div>
        <button onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true); }} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed" title={!canEdit ? 'Modo observador: solo lectura' : undefined}>
          <Plus className="w-4 h-4" /> Nuevo Registro
        </button>
      </div>

      {/* Table & Cards */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <>
          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {data.map(d => (
              <div key={d.id} className="card-glass p-5 relative border-l-4 border-l-green-600">
                <div className="flex justify-between items-start mb-4">
                  <div className="pr-2">
                    <h3 className="text-white/85 font-bold text-base leading-tight mb-1">{d.titulo}</h3>
                    <p className="text-white/40 text-xs">{d.fecha}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`badge ${prioridadBadge[d.prioridad]} mb-1 block`}>{d.prioridad}</span>
                    <span className={`badge ${estadoBadge[d.estado]} block`}>{d.estado}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 bg-white/[0.05] rounded-lg border border-white/[0.07]">
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Tipo</span>
                    <span className={`badge ${tipoBadge[d.tipo]} inline-block`}>{tipoLabel[d.tipo]}</span>
                  </div>
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Área</span>
                    <span className="font-semibold text-white/70 capitalize">{d.area}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Responsable</span>
                    <span className="font-semibold text-white/70 truncate block">{d.responsable || '—'}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/[0.07]">
                  <button onClick={() => { setEditItem(d); setForm({ fecha: d.fecha, tipo: d.tipo, titulo: d.titulo, descripcion: d.descripcion, area: d.area, prioridad: d.prioridad, estado: d.estado, responsable: d.responsable || '', costo_estimado: d.costo_estimado ? String(d.costo_estimado) : '' }); setShowModal(true); }} className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-white/50 transition-colors font-medium text-xs flex items-center gap-1"><Edit2 className="w-4 h-4" /> Editar</button>
                </div>
              </div>
            ))}
            {data.length === 0 && (
              <EmptyState
                icon={<Shield className="w-8 h-8" />}
                title="Sin registros de seguridad"
                description="Documenta mejoras, incidentes e inspecciones del área."
                action={canEdit ? { label: 'Crear primer registro', onClick: () => { setEditItem(null); setForm(emptyForm); setShowModal(true); } } : undefined}
              />
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Área</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.id}>
                    <td className="text-white/40 whitespace-nowrap">{d.fecha}</td>
                    <td><span className={`badge ${tipoBadge[d.tipo]}`}>{tipoLabel[d.tipo]}</span></td>
                    <td className="text-white/80 font-medium max-w-[250px] truncate">{d.titulo}</td>
                    <td className="capitalize text-white/50">{d.area}</td>
                    <td><span className={`badge ${prioridadBadge[d.prioridad]}`}>{d.prioridad}</span></td>
                    <td><span className={`badge ${estadoBadge[d.estado]}`}>{d.estado}</span></td>
                    <td>
                      <button onClick={() => { setEditItem(d); setForm({ fecha: d.fecha, tipo: d.tipo, titulo: d.titulo, descripcion: d.descripcion, area: d.area, prioridad: d.prioridad, estado: d.estado, responsable: d.responsable || '', costo_estimado: d.costo_estimado ? String(d.costo_estimado) : '' }); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-0">
                      <EmptyState
                        icon={<Shield className="w-8 h-8" />}
                        title="Sin registros"
                        description="Documenta mejoras, incidentes e inspecciones."
                        action={canEdit ? { label: 'Crear primer registro', onClick: () => { setEditItem(null); setForm(emptyForm); setShowModal(true); } } : undefined}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-white/90">{editItem ? 'Editar Registro' : 'Nuevo Registro de Seguridad'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div><label className="input-label">Fecha</label><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="input-field" /></div>
              <div>
                <label className="input-label">Tipo *</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as MejoraSeguridad['tipo'] })} className="input-field">
                  {Object.entries(tipoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Título *</label><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="input-field" placeholder="Ej: Nueva señalización en Galería Norte" /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Descripción *</label><textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className="input-field" rows={3} /></div>
              <div>
                <label className="input-label">Área</label>
                <select value={form.area} onChange={e => setForm({ ...form, area: e.target.value as MejoraSeguridad['area'] })} className="input-field">
                  <option value="mina">Mina</option><option value="planta">Planta</option><option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="input-label">Prioridad</label>
                <select value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value as MejoraSeguridad['prioridad'] })} className="input-field">
                  <option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="critica">Crítica</option>
                </select>
              </div>
              <div>
                <label className="input-label">Estado</label>
                <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as MejoraSeguridad['estado'] })} className="input-field">
                  <option value="reportado">Reportado</option><option value="en_proceso">En Proceso</option><option value="completado">Completado</option><option value="descartado">Descartado</option>
                </select>
              </div>
              <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })} className="input-field" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-zinc-800">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.titulo || !form.descripcion} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar Registro' : 'Guardar Registro'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
