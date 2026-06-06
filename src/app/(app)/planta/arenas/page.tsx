'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Plus, X, Trash2, Droplets, FlaskConical, Cog, AlertCircle, Waves } from 'lucide-react';
import type { VentaArenas } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { AppPageToolbar } from '@/components/app/AppPageToolbar';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { SheetIconBadge } from '@/components/mobile';
import { MobileCard, MobileCardAction } from '@/components/ui/MobileCard';
import { CrudPageSkeleton } from '@/components/app/CrudPageSkeleton';
import { useAsyncGuard } from '@/hooks/useAsyncGuard';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { mineosCell, mineosKpiValue, mineosModalDivider, mineosModalHeading, mineosPanel } from '@/lib/mineos-visual';


const emptyForm = {
  fecha: new Date().toISOString().split('T')[0],
  comprador: '',
  negociacion: '',
  cantidad_ton: '',
  precio_por_ton: '',
  humedad_pct: '',
  pct_recuperacion_planta: '',
  pct_molino: '',
  observaciones: '',
};

export default function ArenasPage() {
  const { user } = useAuth();
  const [data, setData] = useState<VentaArenas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const confirmDialog = useConfirm();

  const f = (k: keyof typeof emptyForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const { begin, isStale } = useAsyncGuard();

  const loadData = useCallback(async () => {
    const gen = begin();
    setLoading(true);
    const { data } = await supabase.from('venta_arenas').select('*').order('fecha', { ascending: false }).limit(100);
    if (isStale(gen)) return;
    setData(data || []);
    setLoading(false);
  }, [begin, isStale]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormError(null);
  };

  const handleSave = async () => {
    const ton = parseFloat(form.cantidad_ton);
    const precio = parseFloat(form.precio_por_ton);
    if (!form.comprador.trim()) { setFormError('El comprador es obligatorio.'); return; }
    if (isNaN(ton) || ton <= 0) { setFormError('La cantidad en toneladas debe ser mayor que cero.'); return; }
    if (isNaN(precio) || precio <= 0) { setFormError('El precio por tonelada debe ser mayor que cero.'); return; }
    if (form.humedad_pct && (parseFloat(form.humedad_pct) < 0 || parseFloat(form.humedad_pct) > 100)) {
      setFormError('Humedad debe estar entre 0 y 100.');
      return;
    }
    setFormError(null);
    setSaving(true);
    await supabase.from('venta_arenas').insert({
      fecha: form.fecha,
      comprador: form.comprador,
      cantidad_kg: ton,                          // columna existente, ahora guarda toneladas
      precio_por_kg: precio,                     // columna existente, ahora guarda precio/ton
      total_venta: ton * precio,
      factura_referencia: form.negociacion || null,
      negociacion: form.negociacion || null,
      humedad_pct: parseFloat(form.humedad_pct) || null,
      pct_recuperacion_planta: parseFloat(form.pct_recuperacion_planta) || null,
      pct_molino: parseFloat(form.pct_molino) || null,
      observaciones: form.observaciones || null,
      registrado_por: user?.id,
    });
    setSaving(false); closeModal(); setForm(emptyForm); loadData();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({
      title: 'Eliminar venta',
      message: '¿Eliminar esta venta?',
      variant: 'danger'
    }))) return;
    await supabase.from('venta_arenas').delete().eq('id', id);
    loadData();
  };

  const fmt    = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtNum = (n: number, d = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);
  const totalVentas  = data.reduce((s, v) => s + Number(v.total_venta), 0);
  const totalTon     = data.reduce((s, v) => s + Number(v.cantidad_kg), 0);
  const liveTotal    = (parseFloat(form.cantidad_ton) || 0) * (parseFloat(form.precio_por_ton) || 0);

  const negociacion = (v: VentaArenas) => v.negociacion || v.factura_referencia || '—';

  return (
    <div className="space-y-6">
      <AppPageToolbar
        lead={
          <p className="text-white/40 text-sm">
            <span className={`${mineosKpiValue('benefit')} font-semibold`}>{fmt(totalVentas)}</span> vendido —{' '}
            <span className={`${mineosCell('general')} font-semibold`}>{fmtNum(totalTon)} t</span> totales
          </p>
        }
      >
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva Venta
        </button>
      </AppPageToolbar>

      {loading ? <CrudPageSkeleton /> : (
        <>
          <div className="block md:hidden space-y-4">
            {data.map(v => (
              <MobileCard
                key={v.id}
                accent="border-l-cyan-500"
                header={
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold leading-snug text-white/85">{v.comprador}</h3>
                      <p className="mt-0.5 text-xs text-white/40">{v.fecha}</p>
                      {negociacion(v) !== '—' && (
                        <span className="mt-1 block text-[10px] font-semibold text-white/35">{negociacion(v)}</span>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="mb-0.5 block text-[10px] font-bold uppercase text-emerald-400/60">Total</span>
                      <span className={`text-xl font-black ${mineosKpiValue('benefit')}`}>{fmt(v.total_venta)}</span>
                    </div>
                  </div>
                }
                details={[
                  { label: 'Toneladas', value: `${fmtNum(v.cantidad_kg)} t` },
                  { label: 'Precio/t', value: fmt(v.precio_por_kg) },
                  ...(v.humedad_pct != null ? [{ label: 'Humedad', value: `${fmtNum(v.humedad_pct)}%` }] : []),
                  ...(v.pct_recuperacion_planta != null ? [{ label: 'Rec. Planta', value: <span className="font-semibold text-amber-400/80">{fmtNum(v.pct_recuperacion_planta)}%</span> }] : []),
                  ...(v.pct_molino != null ? [{ label: '% Molino', value: <span className={`font-semibold ${mineosCell('benefit')}`}>{fmtNum(v.pct_molino)}%</span> }] : []),
                ]}
                actions={
                  <MobileCardAction
                    onClick={() => handleDelete(v.id)}
                    label="Eliminar"
                    icon={<Trash2 className="h-4 w-4" />}
                    variant="danger"
                  />
                }
              />
            ))}
            {data.length === 0 && (
              <EmptyState
                icon={<Waves className="w-8 h-8" />}
                title="Sin ventas registradas"
                description="Registra la primera venta de arenas (Relave) del período."
                action={{ label: 'Registrar primera venta', onClick: openCreate }}
              />
            )}
          </div>

          <div className="hidden md:block table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comprador</th>
                  <th>Negociación</th>
                  <th className="text-right">Toneladas</th>
                  <th className="text-right">Precio/t</th>
                  <th className="text-right">Humedad %</th>
                  <th className="text-right">Rec. Planta %</th>
                  <th className="text-right">% Molino</th>
                  <th className="text-right">Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(v => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap text-white/40">{v.fecha}</td>
                    <td className="text-white/80 font-medium">{v.comprador}</td>
                    <td className="text-white/50 text-sm">{negociacion(v)}</td>
                    <td className="text-right font-semibold text-white/80">{fmtNum(v.cantidad_kg)} <span className="text-white/35 text-xs font-normal">t</span></td>
                    <td className="text-right text-white/55">{fmt(v.precio_por_kg)}</td>
                    <td className="text-right">
                      {v.humedad_pct != null ? <span className="badge badge-info">{fmtNum(v.humedad_pct)}%</span> : <span className="text-white/25">—</span>}
                    </td>
                    <td className="text-right">
                      {v.pct_recuperacion_planta != null ? <span className="badge badge-warning">{fmtNum(v.pct_recuperacion_planta)}%</span> : <span className="text-white/25">—</span>}
                    </td>
                    <td className="text-right">
                      {v.pct_molino != null ? <span className="badge badge-neutral">{fmtNum(v.pct_molino)}%</span> : <span className="text-white/25">—</span>}
                    </td>
                    <td className={`text-right font-bold ${mineosKpiValue('benefit')}`}>{fmt(v.total_venta)}</td>
                    <td>
                      <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-0">
                      <EmptyState
                        icon={<Waves className="w-8 h-8" />}
                        title="Sin ventas registradas"
                        description="Registra la primera venta de arenas."
                        action={{ label: 'Registrar primera venta', onClick: openCreate }}
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
        onClose={closeModal}
        sheetTitle="Nueva Venta de Arenas"
        sheetIcon={<SheetIconBadge icon={Waves} tone="info" />}
        panelClassName="sm:max-w-2xl"
      >
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <h2 className="page-form-modal-title text-xl font-bold tracking-tight">Nueva Venta de Arenas</h2>
              <button type="button" onClick={closeModal} className="p-2 rounded-xl text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div><label className="input-label">Fecha *</label><AppDatePicker value={form.fecha} onChange={(val) => f('fecha', val)} /></div>
              <div><label className="input-label">Comprador *</label><input value={form.comprador} onChange={e => f('comprador', e.target.value)} className="input-field" placeholder="Nombre del comprador" /></div>
              <div className="col-span-1 md:col-span-2">
                <label className="input-label">Negociación</label>
                <input value={form.negociacion} onChange={e => f('negociacion', e.target.value)} className="input-field" placeholder="Ej: Contrato directo, precio fijo, spot market..." />
              </div>

              <div>
                <label className="input-label">Cantidad (toneladas) *</label>
                <input type="number" step="0.001" value={form.cantidad_ton} onChange={e => f('cantidad_ton', e.target.value)} className="input-field" placeholder="0.000" />
              </div>
              <div>
                <label className="input-label">Precio por tonelada (USD) *</label>
                <input type="number" step="0.01" value={form.precio_por_ton} onChange={e => f('precio_por_ton', e.target.value)} className="input-field" placeholder="0.00" />
              </div>

              {liveTotal > 0 && (
                <div className={`col-span-1 md:col-span-2 flex items-center justify-between py-4 px-5 ${mineosPanel('benefit')}`}>
                  <span className={`text-sm font-medium ${mineosCell('benefit')} opacity-80`}>Total estimado</span>
                  <span className={`text-3xl font-black tracking-tight ${mineosKpiValue('benefit')}`}>{fmt(liveTotal)}</span>
                </div>
              )}

              <div className="col-span-1 md:col-span-2">
                <h3 className={mineosModalHeading('general')}>
                  <span>Parámetros Técnicos</span>
                  <span className={mineosModalDivider('general')} />
                </h3>
              </div>

              <div>
                <label className="input-label flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5 mineos-icon-general" /> Humedad (%)</label>
                <input type="number" step="0.1" min="0" max="100" value={form.humedad_pct} onChange={e => f('humedad_pct', e.target.value)} className="input-field" placeholder="0.0" />
              </div>
              <div>
                <label className="input-label flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5 text-amber-400" /> % Recuperación Planta</label>
                <input type="number" step="0.01" min="0" max="100" value={form.pct_recuperacion_planta} onChange={e => f('pct_recuperacion_planta', e.target.value)} className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="input-label flex items-center gap-1.5"><Cog className="h-3.5 w-3.5 mineos-icon-benefit" /> % para el Molino</label>
                <input type="number" step="0.01" min="0" max="100" value={form.pct_molino} onChange={e => f('pct_molino', e.target.value)} className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="input-label">Observaciones</label>
                <input value={form.observaciones} onChange={e => f('observaciones', e.target.value)} className="input-field" placeholder="Notas adicionales" />
              </div>
            </div>

            <PageFormModalFooter>
              <button type="button" onClick={closeModal} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Registrar Venta'}
              </button>
            </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}
