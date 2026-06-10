'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Plus, X, Loader2, Edit2, Cog } from 'lucide-react';
import { SheetIconBadge } from '@/components/mobile';
import type { ProcesamientoPlanta } from '@/lib/types';
import { AppPageToolbar } from '@/components/app/AppPageToolbar';
import { AppSelect } from '@/components/ui/AppSelect';
import { useBibliotecaOptions } from '@/contexts/biblioteca-context';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { CrudPageSkeleton } from '@/components/app/CrudPageSkeleton';
import { useAsyncGuard } from '@/hooks/useAsyncGuard';
import { useGlobalDateRange } from '@/hooks/useGlobalDateRange';
import { MINEOS_BTN_GERENCIAL_NEW, MINEOS_TABLE_ACTION_EDIT } from '@/lib/mineos-visual';

const PESO_SACO_KG = 50;

export default function ProcesamientoPage() {
  const { user } = useAuth();
  const { desde, hasta, hasRange } = useGlobalDateRange();
  const procesoOptions = useBibliotecaOptions('procesamiento_tipo');
  const estadoOptions = useBibliotecaOptions('procesamiento_estado');
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

  const { begin, isStale } = useAsyncGuard();

  const loadData = useCallback(async () => {
    const gen = begin();
    setLoading(true);
    let query = supabase.from('procesamiento_planta').select('*').order('fecha', { ascending: false });
    if (hasRange && desde && hasta) {
      query = query.gte('fecha', desde).lte('fecha', hasta);
    } else {
      query = query.limit(100);
    }
    const { data } = await query;
    if (isStale(gen)) return;
    setData(data || []);
    setLoading(false);
  }, [begin, isStale, hasRange, desde, hasta]);

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
      <AppPageToolbar lead={<p className="text-sm font-light text-white/50">{data.length} procesos registrados</p>}>
        <button onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true); }} className={MINEOS_BTN_GERENCIAL_NEW}>
          <Plus className="w-4 h-4" /> Nuevo Proceso
        </button>
      </AppPageToolbar>

      {/* Table & Cards */}
      {loading ? <CrudPageSkeleton /> : (
        <>
          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {data.map(p => (
              <div key={p.id} className="card-glass p-5 relative">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="badge badge-info mb-2 inline-block">{procesoLabels[p.proceso]}</span>
                    <p className="text-xs text-white/40 mt-0.5">{p.fecha}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${estadoBadge[p.estado]}`}>{p.estado.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-white/[0.03] p-3">
                  <div>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Sacos (×50 kg)</span>
                    <span className="font-semibold text-white/85">{p.sacos_vaciados}</span>
                    <span className="text-xs text-white/40"> (= {p.sacos_vaciados * PESO_SACO_KG} kg)</span>
                  </div>
                  <div>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Peso Proc.</span>
                    <span className="font-semibold text-white/85">{p.peso_procesado_kg} kg</span>
                  </div>
                  <div>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Tenor Est.</span>
                    <span className="font-bold text-[var(--mineos-general-bright)]">{p.tenor_real_gpt ? `${p.tenor_real_gpt} g/t` : '—'}</span>
                  </div>
                  <div>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Tiempo</span>
                    <span className="font-semibold text-white/85">{p.horas_proceso ? `${p.horas_proceso} hrs` : '—'}</span>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-white/10 pt-4">
                  <button onClick={() => { setEditItem(p); setForm({ fecha: p.fecha, sacos_vaciados: String(p.sacos_vaciados), peso_procesado_kg: String(p.peso_procesado_kg), tenor_real_gpt: p.tenor_real_gpt ? String(p.tenor_real_gpt) : '', proceso: p.proceso, horas_proceso: p.horas_proceso ? String(p.horas_proceso) : '', quimicos_utilizados: p.quimicos_utilizados || '', estado: p.estado, observaciones: p.observaciones || '' }); setShowModal(true); }} className={MINEOS_TABLE_ACTION_EDIT} title="Editar"><Edit2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {data.length === 0 && <div className="card-glass py-12 text-center text-white/40">Sin procesos registrados</div>}
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
                      <span className="ml-1 text-xs text-white/40">(= {p.sacos_vaciados * PESO_SACO_KG} kg)</span>
                    </td>
                    <td>{p.peso_procesado_kg}</td>
                    <td className="font-medium text-[var(--mineos-general-bright)]">{p.tenor_real_gpt || '—'}</td>
                    <td>{p.horas_proceso || '—'}</td>
                    <td><span className={`badge ${estadoBadge[p.estado]}`}>{p.estado.replace('_', ' ')}</span></td>
                    <td>
                      <button onClick={() => { setEditItem(p); setForm({ fecha: p.fecha, sacos_vaciados: String(p.sacos_vaciados), peso_procesado_kg: String(p.peso_procesado_kg), tenor_real_gpt: p.tenor_real_gpt ? String(p.tenor_real_gpt) : '', proceso: p.proceso, horas_proceso: p.horas_proceso ? String(p.horas_proceso) : '', quimicos_utilizados: p.quimicos_utilizados || '', estado: p.estado, observaciones: p.observaciones || '' }); setShowModal(true); }} className={MINEOS_TABLE_ACTION_EDIT} title="Editar"><Edit2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-white/40">Sin procesos</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PageFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sheetTitle={editItem ? 'Editar Proceso' : 'Nuevo Proceso'}
        sheetIcon={<SheetIconBadge icon={Cog} />}
        panelClassName="sm:max-w-2xl"
      >
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <h2 className="page-form-modal-title text-xl font-bold tracking-tight">{editItem ? 'Editar Proceso' : 'Nuevo Proceso'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-xl p-2 text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div><label className="input-label">Fecha *</label><AppDatePicker value={form.fecha} onChange={val => setForm({ ...form, fecha: val })} /></div>
              <div>
                <label className="input-label">Proceso *</label>
                <AppSelect
                  value={form.proceso}
                  onChange={(v) => setForm({ ...form, proceso: v as ProcesamientoPlanta['proceso'] })}
                  options={procesoOptions}
                />
              </div>
              <div>
                <label className="input-label">Sacos Vaciados * <span className="text-amber-400/70 font-normal">(unidad = 50 kg)</span></label>
                <input type="text" inputMode="decimal" value={form.sacos_vaciados} onChange={e => setForm(handleSacosChange(e.target.value, form))} className="input-field" />
                {parseFloat(form.sacos_vaciados) > 0 && (
                  <p className="mt-1 text-xs text-white/40">{parseFloat(form.sacos_vaciados)} sacos × 50 kg = <span className="font-semibold text-[var(--mineos-general-bright)]">{(parseFloat(form.sacos_vaciados) * PESO_SACO_KG).toFixed(1)} kg</span></p>
                )}
              </div>
              <div>
                <label className="input-label">Peso Procesado (kg) * <span className="font-normal text-white/40">(auto desde sacos)</span></label>
                <input type="number" step="0.01" value={form.peso_procesado_kg} onChange={e => setForm({ ...form, peso_procesado_kg: e.target.value })} className="input-field" />
              </div>
              <div><label className="input-label">Tenor Real (g/t)</label><input type="number" step="0.0001" value={form.tenor_real_gpt} onChange={e => setForm({ ...form, tenor_real_gpt: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Horas Proceso</label><input type="number" step="0.01" value={form.horas_proceso} onChange={e => setForm({ ...form, horas_proceso: e.target.value })} className="input-field" /></div>
              <div className="col-span-1 md:col-span-2">
                <label className="input-label">Estado</label>
                <AppSelect
                  value={form.estado}
                  onChange={(v) => setForm({ ...form, estado: v as ProcesamientoPlanta['estado'] })}
                  options={estadoOptions}
                />
              </div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Químicos (opcional)</label><input value={form.quimicos_utilizados} onChange={e => setForm({ ...form, quimicos_utilizados: e.target.value })} className="input-field" placeholder="Agua oxigenada, cianuro..." /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Observaciones</label><textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="input-field" rows={2} /></div>
            </div>
            <PageFormModalFooter>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.sacos_vaciados || !form.peso_procesado_kg} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar Proceso' : 'Guardar Proceso'}</button>
            </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}
