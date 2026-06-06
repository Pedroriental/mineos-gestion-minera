'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { Plus, X, Loader2, Edit2, Trash2, Wrench } from 'lucide-react';
import { SheetIconBadge } from '@/components/mobile';
import type { Equipo } from '@/lib/types';
import { AppPageToolbar } from '@/components/app/AppPageToolbar';
import { AppSelect } from '@/components/ui/AppSelect';
import { useBibliotecaOptions } from '@/contexts/biblioteca-context';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { CrudPageSkeleton } from '@/components/app/CrudPageSkeleton';
import { useAsyncGuard } from '@/hooks/useAsyncGuard';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

export default function EquiposPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const tipoOptions = useBibliotecaOptions('equipos_tipo');
  const estadoOptions = useBibliotecaOptions('equipos_estado');
  const [data, setData] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Equipo | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { codigo: '', nombre: '', tipo: 'compresor' as Equipo['tipo'], ubicacion: '', estado: 'operativo' as Equipo['estado'], horas_operacion: '', observaciones: '' };
  const [form, setForm] = useState(emptyForm);
  const confirmDialog = useConfirm();

  const { begin, isStale } = useAsyncGuard();

  const loadData = useCallback(async () => {
    const gen = begin();
    setLoading(true);
    const { data } = await supabase.from('equipos').select('*').eq('activo', true).order('nombre');
    if (isStale(gen)) return;
    setData(data || []);
    setLoading(false);
  }, [begin, isStale]);

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
    if (!(await confirmDialog({
      title: 'Eliminar equipo',
      message: `¿Eliminar el equipo "${nombre}"? El equipo será desactivado y ya no aparecerá en la lista.`,
      variant: 'danger'
    }))) return;
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
      <AppPageToolbar
        lead={
          <p className="text-white/40 text-sm">
            {data.filter(e => e.estado === 'operativo').length} operativos de {data.length}
          </p>
        }
      >
        <button onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true); }} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed" title={!canEdit ? 'Modo observador: solo lectura' : undefined}>
          <Plus className="w-4 h-4" /> Nuevo Equipo
        </button>
      </AppPageToolbar>

      {/* Cards Grid */}
      {loading ? (
        <CrudPageSkeleton rows={6} />
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

      <PageFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sheetTitle={editItem ? 'Editar Equipo' : 'Nuevo Equipo'}
        sheetIcon={<SheetIconBadge icon={Wrench} />}
        panelClassName="sm:max-w-2xl"
      >
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <h2 className="page-form-modal-title text-xl font-bold tracking-tight">{editItem ? 'Editar Equipo' : 'Nuevo Equipo'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 rounded-xl text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div><label className="input-label">Código *</label><input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className="input-field" placeholder="Ej: COMP-01" /></div>
              <div>
                <label className="input-label">Tipo *</label>
                <AppSelect
                  value={form.tipo}
                  onChange={(v) => setForm({ ...form, tipo: v as Equipo['tipo'] })}
                  options={tipoOptions}
                />
              </div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Nombre *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="input-field" placeholder="Sullair 185" /></div>
              <div>
                <label className="input-label">Estado</label>
                <AppSelect
                  value={form.estado}
                  onChange={(v) => setForm({ ...form, estado: v as Equipo['estado'] })}
                  options={estadoOptions}
                />
              </div>
              <div><label className="input-label">Horas Operación</label><input type="number" step="0.1" value={form.horas_operacion} onChange={e => setForm({ ...form, horas_operacion: e.target.value })} className="input-field font-semibold text-amber-700" /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Ubicación</label><input value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} className="input-field" placeholder="Zona, Veta o Área" /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Observaciones</label><textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="input-field" rows={2} /></div>
            </div>
            <PageFormModalFooter>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.codigo || !form.nombre} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar Equipo' : 'Registrar Equipo'}</button>
            </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}
