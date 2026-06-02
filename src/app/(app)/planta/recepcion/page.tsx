'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Plus, X, Loader2, Edit2 } from 'lucide-react';
import type { RecepcionMaterial } from '@/lib/types';
import { AppPageToolbar } from '@/components/app/AppPageToolbar';
import { AppSelect } from '@/components/ui/AppSelect';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { CrudPageSkeleton } from '@/components/app/CrudPageSkeleton';
import { useAsyncGuard } from '@/hooks/useAsyncGuard';

const PESO_SACO_KG = 50;

const TURNO_OPTIONS = [
  { value: 'dia', label: 'Día' },
  { value: 'noche', label: 'Noche' },
  { value: 'completo', label: 'Completo' },
];

export default function RecepcionPage() {
  const { user } = useAuth();
  const [data, setData] = useState<RecepcionMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<RecepcionMaterial | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { fecha: new Date().toISOString().split('T')[0], turno: 'dia' as RecepcionMaterial['turno'], origen: '', sacos_recibidos: '', peso_estimado_kg: '', tipo_material: 'mineral_bruto', tenor_estimado_gpt: '', transportista: '', observaciones: '' };

  const handleSacosChange = (value: string, currentForm: typeof emptyForm) => {
    const sacosN = parseFloat(value) || 0;
    const autoKg = sacosN > 0 ? (sacosN * PESO_SACO_KG).toFixed(1) : '';
    return {
      ...currentForm,
      sacos_recibidos: value,
      peso_estimado_kg: currentForm.peso_estimado_kg || autoKg,
    };
  };
  const [form, setForm] = useState(emptyForm);

  const { begin, isStale } = useAsyncGuard();

  const loadData = useCallback(async () => {
    const gen = begin();
    setLoading(true);
    const { data } = await supabase.from('recepcion_material').select('*').order('fecha', { ascending: false }).limit(100);
    if (isStale(gen)) return;
    setData(data || []);
    setLoading(false);
  }, [begin, isStale]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      fecha: form.fecha, turno: form.turno, origen: form.origen,
      sacos_recibidos: parseFloat(form.sacos_recibidos) || 1, peso_estimado_kg: parseFloat(form.peso_estimado_kg) || null,
      tipo_material: form.tipo_material, tenor_estimado_gpt: parseFloat(form.tenor_estimado_gpt) || null,
      transportista: form.transportista || null, observaciones: form.observaciones || null, registrado_por: user?.id,
    };
    if (editItem) { const { registrado_por, ...up } = payload; await supabase.from('recepcion_material').update(up).eq('id', editItem.id); }
    else { await supabase.from('recepcion_material').insert(payload); }
    setSaving(false); setShowModal(false); setEditItem(null); setForm(emptyForm); loadData();
  };

  const totalSacos = data.reduce((s, r) => s + r.sacos_recibidos, 0);
  const turnoLabel: Record<string, string> = { dia: '☀ Día', noche: '🌙 Noche', completo: '🔄 Completo' };

  return (
    <div className="space-y-6">
      <AppPageToolbar
        lead={
          <p className="text-white/40 text-sm">
            {totalSacos} sacos recibidos en total <span className="text-white/25">(≈ {totalSacos * PESO_SACO_KG} kg)</span>
          </p>
        }
      >
        <button onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva Recepción
        </button>
      </AppPageToolbar>

      {/* Table & Cards */}
      {loading ? <CrudPageSkeleton /> : (
        <>
          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {data.map(r => (
              <div key={r.id} className="card-glass p-5 relative border-l-4 border-l-teal-500">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-white/85 font-bold text-base">{r.origen}</h3>
                    <p className="text-white/40 text-xs mt-0.5">{r.fecha} • {turnoLabel[r.turno]}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 bg-white/[0.05] rounded-lg border border-white/[0.07]">
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Sacos (×50 kg)</span>
                    <span className="font-bold text-amber-400 text-lg">{r.sacos_recibidos}</span>
                    <span className="text-white/35 text-xs">(= {r.sacos_recibidos * PESO_SACO_KG} kg)</span>
                  </div>
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Peso (kg)</span>
                    <span className="font-semibold text-white/70">{r.peso_estimado_kg || '—'}</span>
                  </div>
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Tenor Est.</span>
                    <span className="font-semibold text-white/70">{r.tenor_estimado_gpt ? `${r.tenor_estimado_gpt} g/t` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Flete</span>
                    <span className="font-semibold text-white/70 truncate block">{r.transportista || '—'}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/[0.07]">
                  <button onClick={() => { setEditItem(r); setForm({ fecha: r.fecha, turno: r.turno, origen: r.origen, sacos_recibidos: String(r.sacos_recibidos), peso_estimado_kg: r.peso_estimado_kg ? String(r.peso_estimado_kg) : '', tipo_material: r.tipo_material, tenor_estimado_gpt: r.tenor_estimado_gpt ? String(r.tenor_estimado_gpt) : '', transportista: r.transportista || '', observaciones: r.observaciones || '' }); setShowModal(true); }} className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-white/50 transition-colors font-medium text-xs flex items-center gap-1"><Edit2 className="w-4 h-4" /> Editar</button>
                </div>
              </div>
            ))}
            {data.length === 0 && <div className="text-center py-12 text-white/40 card-glass">Sin recepciones registradas</div>}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Turno</th>
                  <th>Origen</th>
                  <th>Sacos (×50 kg)</th>
                  <th>Peso (kg)</th>
                  <th>Tenor (g/t)</th>
                  <th>Transportista</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{r.fecha}</td>
                    <td>{turnoLabel[r.turno]}</td>
                    <td className="text-white/80 font-medium">{r.origen}</td>
                    <td className="font-semibold text-amber-400">
                      {r.sacos_recibidos}
                      <span className="text-white/30 text-xs ml-1">(= {r.sacos_recibidos * PESO_SACO_KG} kg)</span>
                    </td>
                    <td className="text-white/65">{r.peso_estimado_kg || '—'}</td>
                    <td className="text-white/65">{r.tenor_estimado_gpt || '—'}</td>
                    <td className="text-white/40">{r.transportista || '—'}</td>
                    <td>
                      <button onClick={() => { setEditItem(r); setForm({ fecha: r.fecha, turno: r.turno, origen: r.origen, sacos_recibidos: String(r.sacos_recibidos), peso_estimado_kg: r.peso_estimado_kg ? String(r.peso_estimado_kg) : '', tipo_material: r.tipo_material, tenor_estimado_gpt: r.tenor_estimado_gpt ? String(r.tenor_estimado_gpt) : '', transportista: r.transportista || '', observaciones: r.observaciones || '' }); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-white/40">Sin recepciones</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PageFormModal open={showModal} onClose={() => setShowModal(false)} panelClassName="sm:max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="page-form-modal-title text-xl font-bold tracking-tight">{editItem ? 'Editar Recepción' : 'Nueva Recepción'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 rounded-xl text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div><label className="input-label">Fecha *</label><AppDatePicker value={form.fecha} onChange={val => setForm({ ...form, fecha: val })} /></div>
              <div>
                <label className="input-label">Turno *</label>
                <AppSelect
                  value={form.turno}
                  onChange={(v) => setForm({ ...form, turno: v as 'dia' | 'noche' | 'completo' })}
                  options={TURNO_OPTIONS}
                />
              </div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Origen *</label><input value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} className="input-field" placeholder="Zona mina, terceros..." /></div>
              <div>
                <label className="input-label">Sacos Recibidos * <span className="text-amber-400/70 font-normal">(unidad = 50 kg)</span></label>
                <input type="text" inputMode="decimal" value={form.sacos_recibidos} onChange={e => setForm(handleSacosChange(e.target.value, form))} className="input-field text-xl font-bold" />
                {parseFloat(form.sacos_recibidos) > 0 && (
                  <p className="text-xs text-white/35 mt-1">{parseFloat(form.sacos_recibidos)} sacos × 50 kg = <span className="text-amber-400/60 font-semibold">{(parseFloat(form.sacos_recibidos) * PESO_SACO_KG).toFixed(1)} kg</span></p>
                )}
              </div>
              <div>
                <label className="input-label">Peso Real (kg) <span className="text-white/30 font-normal">(auto desde sacos)</span></label>
                <input type="number" step="0.01" value={form.peso_estimado_kg} onChange={e => setForm({ ...form, peso_estimado_kg: e.target.value })} className="input-field" />
              </div>
              <div><label className="input-label">Tenor Estimado (g/t)</label><input type="number" step="0.0001" value={form.tenor_estimado_gpt} onChange={e => setForm({ ...form, tenor_estimado_gpt: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Transportista</label><input value={form.transportista} onChange={e => setForm({ ...form, transportista: e.target.value })} className="input-field" /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Observaciones</label><textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="input-field" rows={2} /></div>
            </div>
            <PageFormModalFooter>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.origen || !form.sacos_recibidos} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar Recepción' : 'Registrar Recepción'}</button>
            </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}
