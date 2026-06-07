'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Plus, X, Edit2, PackageOpen } from 'lucide-react';
import { SheetIconBadge } from '@/components/mobile';
import type { RecepcionMaterial } from '@/lib/types';
import { AppPageToolbar } from '@/components/app/AppPageToolbar';
import { AppSelect } from '@/components/ui/AppSelect';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { CrudPageSkeleton } from '@/components/app/CrudPageSkeleton';
import { MobileCard, MobileCardAction } from '@/components/ui/MobileCard';
import EmptyState from '@/components/EmptyState';
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

  const openEdit = (r: RecepcionMaterial) => {
    setEditItem(r);
    setForm({
      fecha: r.fecha,
      turno: r.turno,
      origen: r.origen,
      sacos_recibidos: String(r.sacos_recibidos),
      peso_estimado_kg: r.peso_estimado_kg ? String(r.peso_estimado_kg) : '',
      tipo_material: r.tipo_material,
      tenor_estimado_gpt: r.tenor_estimado_gpt ? String(r.tenor_estimado_gpt) : '',
      transportista: r.transportista || '',
      observaciones: r.observaciones || '',
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setShowModal(true);
  };

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
  const fmtDate = (fecha?: string | null) => {
    if (!fecha) return '—';
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <AppPageToolbar
        lead={
          <p className="text-white/40 text-sm">
            {totalSacos} sacos recibidos en total <span className="text-white/25">(≈ {totalSacos * PESO_SACO_KG} kg)</span>
          </p>
        }
      >
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva Recepción
        </button>
      </AppPageToolbar>

      {loading ? <CrudPageSkeleton /> : (
        <>
          <div className="block md:hidden space-y-4">
            {data.map(r => (
              <MobileCard
                key={r.id}
                accent="border-l-teal-500"
                header={
                  <div>
                    <h3 className="truncate text-base font-bold leading-tight text-white/85">{r.origen}</h3>
                    <p className="mt-0.5 text-xs text-white/40">{fmtDate(r.fecha)} • {turnoLabel[r.turno]}</p>
                  </div>
                }
                details={[
                  {
                    label: 'Sacos (×50 kg)',
                    value: (
                      <>
                        <span className="font-bold text-amber-400 text-lg">{r.sacos_recibidos}</span>
                        <span className="text-white/35 text-xs ml-1">(= {r.sacos_recibidos * PESO_SACO_KG} kg)</span>
                      </>
                    ),
                  },
                  { label: 'Peso (kg)', value: r.peso_estimado_kg || '—' },
                  { label: 'Tenor Est.', value: r.tenor_estimado_gpt ? `${r.tenor_estimado_gpt} g/t` : '—' },
                  { label: 'Flete', value: r.transportista || '—' },
                ]}
                actions={
                  <MobileCardAction
                    onClick={() => openEdit(r)}
                    label="Editar"
                    icon={<Edit2 className="h-4 w-4" />}
                  />
                }
              />
            ))}
            {data.length === 0 && (
              <EmptyState
                icon={<PackageOpen className="w-8 h-8" />}
                title="Sin recepciones registradas"
                description="Registra la primera recepción de material en planta."
                action={{ label: 'Nueva recepción', onClick: openCreate }}
              />
            )}
          </div>

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
                    <td className="whitespace-nowrap font-medium text-white/70">{fmtDate(r.fecha)}</td>
                    <td className="text-white/50">{turnoLabel[r.turno]}</td>
                    <td className="text-white/80 font-medium">{r.origen}</td>
                    <td className="font-semibold text-amber-400">
                      {r.sacos_recibidos}
                      <span className="text-white/30 text-xs ml-1">(= {r.sacos_recibidos * PESO_SACO_KG} kg)</span>
                    </td>
                    <td className="text-white/65">{r.peso_estimado_kg || '—'}</td>
                    <td className="text-white/65">{r.tenor_estimado_gpt || '—'}</td>
                    <td className="text-white/40">{r.transportista || '—'}</td>
                    <td>
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-0">
                      <EmptyState
                        icon={<PackageOpen className="w-8 h-8" />}
                        title="Sin recepciones registradas"
                        description="Registra la primera recepción de material en planta."
                        action={{ label: 'Nueva recepción', onClick: openCreate }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PageFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sheetTitle={editItem ? 'Editar Recepción' : 'Nueva Recepción'}
        sheetIcon={<SheetIconBadge icon={PackageOpen} tone="accent" />}
        panelClassName="sm:max-w-2xl"
      >
            <div className="mb-6 hidden items-center justify-between lg:flex">
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
                  <p className="text-xs text-slate-400 mt-1">{parseFloat(form.sacos_recibidos)} sacos × 50 kg = <span className="text-amber-600 font-semibold">{(parseFloat(form.sacos_recibidos) * PESO_SACO_KG).toFixed(1)} kg</span></p>
                )}
              </div>
              <div>
                <label className="input-label">Peso Real (kg) <span className="text-slate-400 font-normal">(auto desde sacos)</span></label>
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
