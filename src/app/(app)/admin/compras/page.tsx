'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Plus, X, Loader2, Edit2, Check, ShoppingCart } from 'lucide-react';
import { SheetIconBadge } from '@/components/mobile';
import { AppPageToolbar } from '@/components/app/AppPageToolbar';
import { AppSelect } from '@/components/ui/AppSelect';
import { useBibliotecaOptions } from '@/contexts/biblioteca-context';
import type { CompraProgramada } from '@/lib/types';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { MobileCard, MobileCardAction } from '@/components/ui/MobileCard';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { CrudPageSkeleton } from '@/components/app/CrudPageSkeleton';
import { useAsyncGuard } from '@/hooks/useAsyncGuard';

export default function ComprasPage() {
  const { user } = useAuth();
  const prioridadOptions = useBibliotecaOptions('compras_prioridad');
  const [data, setData] = useState<CompraProgramada[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<CompraProgramada | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    descripcion: '', cantidad_requerida: '', unidad_medida: '', fecha_requerida: '',
    prioridad: 'normal' as CompraProgramada['prioridad'], proveedor_sugerido: '', costo_estimado: '', notas: '',
  });

  const { begin, isStale } = useAsyncGuard();

  const loadData = useCallback(async () => {
    const gen = begin();
    setLoading(true);
    const { data } = await supabase.from('compras_programadas').select('*').order('fecha_requerida', { ascending: true });
    if (isStale(gen)) return;
    setData(data || []);
    setLoading(false);
  }, [begin, isStale]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      descripcion: form.descripcion, cantidad_requerida: parseFloat(form.cantidad_requerida) || 0,
      unidad_medida: form.unidad_medida, fecha_requerida: form.fecha_requerida,
      prioridad: form.prioridad, proveedor_sugerido: form.proveedor_sugerido || null,
      costo_estimado: parseFloat(form.costo_estimado) || null, notas: form.notas || null,
      registrado_por: user?.id,
    };
    if (editItem) {
      const { registrado_por, ...updatePayload } = payload;
      await supabase.from('compras_programadas').update(updatePayload).eq('id', editItem.id);
    } else {
      await supabase.from('compras_programadas').insert(payload);
    }
    setSaving(false); setShowModal(false); setEditItem(null); loadData();
  };

  const updateEstado = async (id: string, estado: CompraProgramada['estado']) => {
    await supabase.from('compras_programadas').update({ estado }).eq('id', id);
    loadData();
  };

  const estadoBadge: Record<string, string> = { pendiente: 'badge-warning', aprobada: 'badge-info', en_proceso: 'badge-gold', completada: 'badge-success', cancelada: 'badge-danger' };
  const estadoLabel: Record<string, string> = { pendiente: 'Pendiente', aprobada: 'Aprobada', en_proceso: 'En Proceso', completada: 'Completada', cancelada: 'Cancelada' };

  return (
    <div className="space-y-6">
      <AppPageToolbar lead={<p className="text-white/40 text-sm">{data.filter(c => c.estado !== 'completada' && c.estado !== 'cancelada').length} pendientes</p>}>
        <button onClick={() => { setEditItem(null); setForm({ descripcion: '', cantidad_requerida: '', unidad_medida: '', fecha_requerida: new Date().toISOString().split('T')[0], prioridad: 'normal', proveedor_sugerido: '', costo_estimado: '', notas: '' }); setShowModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva Compra
        </button>
      </AppPageToolbar>

      {/* Table & Cards */}
      {loading ? (
        <CrudPageSkeleton />
      ) : (
        <>
          <div className="block md:hidden space-y-4">
            {data.map(c => (
              <MobileCard
                key={c.id}
                accent="border-l-purple-500"
                header={
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold leading-tight text-white/85">
                        {c.descripcion}
                      </h3>
                      <p className="mt-0.5 text-xs text-white/40">
                        Req: {c.fecha_requerida}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="badge badge-neutral mb-1 block">{c.prioridad}</span>
                      <span className={`badge ${estadoBadge[c.estado]} block`}>{estadoLabel[c.estado]}</span>
                    </div>
                  </div>
                }
                details={[
                  { label: 'Cantidad', value: `${c.cantidad_requerida} ${c.unidad_medida}` },
                  { label: 'Costo Est.', value: c.costo_estimado ? `$${c.costo_estimado}` : '—' },
                  { label: 'Proveedor', value: c.proveedor_sugerido || '—', spanFull: true },
                ]}
                actions={
                  <>
                    {c.estado === 'pendiente' && (
                      <MobileCardAction onClick={() => updateEstado(c.id, 'aprobada')} label="Aprobar" icon={<Check className="h-4 w-4" />} variant="primary" />
                    )}
                    {c.estado === 'aprobada' && (
                      <MobileCardAction onClick={() => updateEstado(c.id, 'completada')} label="Completar" icon={<Check className="h-4 w-4" />} variant="primary" />
                    )}
                    <MobileCardAction
                      onClick={() => {
                        setEditItem(c);
                        setForm({ descripcion: c.descripcion, cantidad_requerida: String(c.cantidad_requerida), unidad_medida: c.unidad_medida, fecha_requerida: c.fecha_requerida, prioridad: c.prioridad, proveedor_sugerido: c.proveedor_sugerido || '', costo_estimado: c.costo_estimado ? String(c.costo_estimado) : '', notas: c.notas || '' });
                        setShowModal(true);
                      }}
                      label="Editar"
                      icon={<Edit2 className="h-4 w-4" />}
                    />
                  </>
                }
              />
            ))}
            {data.length === 0 && <div className="card-glass py-12 text-center text-white/40">Sin compras programadas</div>}
          </div>

          <div className="hidden md:block table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th>Fecha Req.</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id}>
                    <td className="text-white/80 font-medium max-w-[250px] truncate">{c.descripcion}</td>
                    <td className="whitespace-nowrap text-white/65">{c.cantidad_requerida} {c.unidad_medida}</td>
                    <td className="text-white/40 whitespace-nowrap">{c.fecha_requerida}</td>
                    <td><span className="badge badge-neutral">{c.prioridad}</span></td>
                    <td><span className={`badge ${estadoBadge[c.estado]}`}>{estadoLabel[c.estado]}</span></td>
                    <td>
                      <div className="flex gap-1">
                        {c.estado === 'pendiente' && <button onClick={() => updateEstado(c.id, 'aprobada')} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 transition-colors" title="Aprobar"><Check className="w-4 h-4" /></button>}
                        {c.estado === 'aprobada' && <button onClick={() => updateEstado(c.id, 'completada')} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 transition-colors" title="Completar"><Check className="w-4 h-4" /></button>}
                        <button onClick={() => { setEditItem(c); setForm({ descripcion: c.descripcion, cantidad_requerida: String(c.cantidad_requerida), unidad_medida: c.unidad_medida, fecha_requerida: c.fecha_requerida, prioridad: c.prioridad, proveedor_sugerido: c.proveedor_sugerido || '', costo_estimado: c.costo_estimado ? String(c.costo_estimado) : '', notas: c.notas || '' }); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-white/40">Sin compras programadas</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PageFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sheetTitle={editItem ? 'Editar Compra' : 'Nueva Compra'}
        sheetIcon={<SheetIconBadge icon={ShoppingCart} />}
        panelClassName="sm:max-w-2xl"
      >
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <h2 className="page-form-modal-title text-xl font-bold tracking-tight">{editItem ? 'Editar Compra' : 'Nueva Compra'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 rounded-xl text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="col-span-1 md:col-span-2"><label className="input-label">Descripción *</label><input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className="input-field" placeholder="Ej: Brocas de perforación 2.5''" /></div>
              <div><label className="input-label">Cantidad *</label><input type="number" step="0.001" value={form.cantidad_requerida} onChange={e => setForm({ ...form, cantidad_requerida: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Unidad *</label><input value={form.unidad_medida} onChange={e => setForm({ ...form, unidad_medida: e.target.value })} className="input-field" placeholder="kg, unidades..." /></div>
              <div><label className="input-label">Fecha Requerida *</label><AppDatePicker value={form.fecha_requerida} onChange={val => setForm({ ...form, fecha_requerida: val })} /></div>
              <div>
                <label className="input-label">Prioridad</label>
                <AppSelect
                  value={form.prioridad}
                  onChange={(v) => setForm({ ...form, prioridad: v as CompraProgramada['prioridad'] })}
                  options={prioridadOptions}
                />
              </div>
              <div><label className="input-label">Proveedor Sugerido</label><input value={form.proveedor_sugerido} onChange={e => setForm({ ...form, proveedor_sugerido: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Costo Estimado (USD)</label><input type="number" step="0.01" value={form.costo_estimado} onChange={e => setForm({ ...form, costo_estimado: e.target.value })} className="input-field" /></div>
            </div>
            <PageFormModalFooter>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.descripcion || !form.cantidad_requerida} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar Compra' : 'Registrar Compra'}</button>
            </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}
