'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { FlaskConical, Plus, X, Loader2, Edit2 } from 'lucide-react';
import type { ProcesamientoPlanta } from '@/lib/types';

const PESO_SACO_KG = 50;

export default function ProcesamientoPage() {
  const { user } = useAuth();
  const [data, setData] = useState<ProcesamientoPlanta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ProcesamientoPlanta | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { fecha: new Date().toISOString().split('T')[0], sacos_vaciados: '', peso_procesado_kg: '', tenor_real_gpt: '', proceso: 'molienda' as ProcesamientoPlanta['proceso'], horas_proceso: '', quimicos_utilizados: '', estado: 'en_proceso' as ProcesamientoPlanta['estado'], observaciones: '' };

  const handleSacosChange = (value: string, currentForm: typeof emptyForm) => {
    const sacosN = parseFloat(value) || 0;
    const autoKg = sacosN > 0 ? (sacosN * PESO_SACO_KG).toFixed(1) : '';
    return { ...currentForm, sacos_vaciados: value, peso_procesado_kg: currentForm.peso_procesado_kg || autoKg };
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('procesamiento_planta').select('*').order('fecha', { ascending: false }).limit(100);
    setData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      fecha: form.fecha, sacos_vaciados: parseFloat(form.sacos_vaciados) || 1,
      peso_procesado_kg: parseFloat(form.peso_procesado_kg) || 0, tenor_real_gpt: parseFloat(form.tenor_real_gpt) || null,
      proceso: form.proceso, horas_proceso: parseFloat(form.horas_proceso) || null,
      quimicos_utilizados: form.quimicos_utilizados || null, estado: form.estado,
      observaciones: form.observaciones || null, registrado_por: user?.id,
    };
    if (editItem) { const { registrado_por, ...up } = payload; await supabase.from('procesamiento_planta').update(up).eq('id', editItem.id); }
    else { await supabase.from('procesamiento_planta').insert(payload); }
    setSaving(false); setShowModal(false); setEditItem(null); setForm(emptyForm); loadData();
  };

  const procesoLabels: Record<string, string> = { molienda: 'Molienda', concentracion: 'Concentración', amalgamacion: 'Amalgamación', cianuracion: 'Cianuración', flotacion: 'Flotación', otro: 'Otro' };
  const estadoBadge: Record<string, string> = { en_proceso: 'badge-warning', completado: 'badge-success', enviado_a_quemada: 'badge-gold' };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800 font-medium tracking-tight text-2xl flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-purple-400" /> Procesamiento
          </h1>
          <p className="text-slate-500 text-sm font-light mt-1">{data.length} procesos registrados</p>
        </div>
        <button onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo Proceso
        </button>
      </div>

      {/* Table & Cards */}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-700 animate-spin" /></div> : (
        <>
          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {data.map(p => (
              <div key={p.id} className="card-glass p-5 relative">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="badge badge-info mb-2 inline-block">{procesoLabels[p.proceso]}</span>
                    <p className="text-slate-400 text-xs mt-0.5">{p.fecha}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${estadoBadge[p.estado]}`}>{p.estado.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/10 rounded-lg">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Sacos (×50 kg)</span>
                    <span className="font-semibold text-slate-700">{p.sacos_vaciados}</span>
                    <span className="text-slate-400 text-xs"> (= {p.sacos_vaciados * PESO_SACO_KG} kg)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Peso Proc.</span>
                    <span className="font-semibold text-slate-700">{p.peso_procesado_kg} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Tenor Est.</span>
                    <span className="font-bold text-amber-700">{p.tenor_real_gpt ? `${p.tenor_real_gpt} g/t` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Tiempo</span>
                    <span className="font-semibold text-slate-700">{p.horas_proceso ? `${p.horas_proceso} hrs` : '—'}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#E8E5DE] dark:border-slate-800/50">
                  <button onClick={() => { setEditItem(p); setForm({ fecha: p.fecha, sacos_vaciados: String(p.sacos_vaciados), peso_procesado_kg: String(p.peso_procesado_kg), tenor_real_gpt: p.tenor_real_gpt ? String(p.tenor_real_gpt) : '', proceso: p.proceso, horas_proceso: p.horas_proceso ? String(p.horas_proceso) : '', quimicos_utilizados: p.quimicos_utilizados || '', estado: p.estado, observaciones: p.observaciones || '' }); setShowModal(true); }} className="p-2 rounded-lg bg-gray-50 text-slate-600 hover:bg-gray-100 font-medium text-xs flex items-center gap-1 transition-colors"><Edit2 className="w-4 h-4" /> Editar</button>
                </div>
              </div>
            ))}
            {data.length === 0 && <div className="text-center py-12 text-slate-400 card-glass">Sin procesos registrados</div>}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proceso</th>
                  <th>Sacos (×50 kg)</th>
                  <th>Peso (kg)</th>
                  <th>Tenor (g/t)</th>
                  <th>Horas</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(p => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{p.fecha}</td>
                    <td><span className="badge badge-info">{procesoLabels[p.proceso]}</span></td>
                    <td className="font-semibold">
                      {p.sacos_vaciados}
                      <span className="text-slate-400 text-xs ml-1">(= {p.sacos_vaciados * PESO_SACO_KG} kg)</span>
                    </td>
                    <td>{p.peso_procesado_kg}</td>
                    <td className="text-amber-700 font-medium">{p.tenor_real_gpt || '—'}</td>
                    <td>{p.horas_proceso || '—'}</td>
                    <td><span className={`badge ${estadoBadge[p.estado]}`}>{p.estado.replace('_', ' ')}</span></td>
                    <td>
                      <button onClick={() => { setEditItem(p); setForm({ fecha: p.fecha, sacos_vaciados: String(p.sacos_vaciados), peso_procesado_kg: String(p.peso_procesado_kg), tenor_real_gpt: p.tenor_real_gpt ? String(p.tenor_real_gpt) : '', proceso: p.proceso, horas_proceso: p.horas_proceso ? String(p.horas_proceso) : '', quimicos_utilizados: p.quimicos_utilizados || '', estado: p.estado, observaciones: p.observaciones || '' }); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-500 hover:text-amber-700 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-slate-400">Sin procesos</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-2xl bg-white border border-[#E8E5DE] rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-slate-800">{editItem ? 'Editar Proceso' : 'Nuevo Proceso'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="input-field" /></div>
              <div>
                <label className="input-label">Proceso *</label>
                <select value={form.proceso} onChange={e => setForm({ ...form, proceso: e.target.value as ProcesamientoPlanta['proceso'] })} className="input-field">
                  {Object.entries(procesoLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Sacos Vaciados * <span className="text-amber-400/70 font-normal">(unidad = 50 kg)</span></label>
                <input type="text" inputMode="decimal" value={form.sacos_vaciados} onChange={e => setForm(handleSacosChange(e.target.value, form))} className="input-field" />
                {parseFloat(form.sacos_vaciados) > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{parseFloat(form.sacos_vaciados)} sacos × 50 kg = <span className="text-amber-600 font-semibold">{(parseFloat(form.sacos_vaciados) * PESO_SACO_KG).toFixed(1)} kg</span></p>
                )}
              </div>
              <div>
                <label className="input-label">Peso Procesado (kg) * <span className="text-slate-400 font-normal">(auto desde sacos)</span></label>
                <input type="number" step="0.01" value={form.peso_procesado_kg} onChange={e => setForm({ ...form, peso_procesado_kg: e.target.value })} className="input-field" />
              </div>
              <div><label className="input-label">Tenor Real (g/t)</label><input type="number" step="0.0001" value={form.tenor_real_gpt} onChange={e => setForm({ ...form, tenor_real_gpt: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Horas Proceso</label><input type="number" step="0.01" value={form.horas_proceso} onChange={e => setForm({ ...form, horas_proceso: e.target.value })} className="input-field" /></div>
              <div className="col-span-1 md:col-span-2">
                <label className="input-label">Estado</label>
                <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as ProcesamientoPlanta['estado'] })} className="input-field">
                  <option value="en_proceso">En Proceso</option><option value="completado">Completado</option><option value="enviado_a_quemada">Enviado a Quemada</option>
                </select>
              </div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Químicos (opcional)</label><input value={form.quimicos_utilizados} onChange={e => setForm({ ...form, quimicos_utilizados: e.target.value })} className="input-field" placeholder="Agua oxigenada, cianuro..." /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Observaciones</label><textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="input-field" rows={2} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[#E8E5DE]">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.sacos_vaciados || !form.peso_procesado_kg} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar Proceso' : 'Guardar Proceso'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
