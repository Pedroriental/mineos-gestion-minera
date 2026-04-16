'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { Package, Plus, Search, X, Loader2, Edit2, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import type { InventarioItem, InventarioMovimiento } from '@/lib/types';

export default function InventarioPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [items, setItems] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showMovModal, setShowMovModal] = useState(false);
  const [editItem, setEditItem] = useState<InventarioItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [itemForm, setItemForm] = useState({ codigo: '', nombre: '', categoria: 'herramientas' as InventarioItem['categoria'], unidad_medida: '', stock_minimo: '', costo_unitario_promedio: '', ubicacion: '' });
  const [movForm, setMovForm] = useState({ item_id: '', tipo_movimiento: 'entrada' as InventarioMovimiento['tipo_movimiento'], cantidad: '', costo_unitario: '', referencia: '', destino_area: '' as string, observaciones: '' });

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('inventario_items').select('*').eq('activo', true).order('nombre');
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveItem = async () => {
    setSaving(true);
    const payload = { ...itemForm, stock_minimo: parseFloat(itemForm.stock_minimo) || 0, costo_unitario_promedio: parseFloat(itemForm.costo_unitario_promedio) || 0 };
    if (editItem) {
      await supabase.from('inventario_items').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('inventario_items').insert({ ...payload, stock_actual: 0 });
    }
    setSaving(false); setShowItemModal(false); setEditItem(null); loadData();
  };

  const handleSaveMov = async () => {
    setSaving(true);
    const qty = parseFloat(movForm.cantidad) || 0;
    const cost = parseFloat(movForm.costo_unitario) || 0;
    await supabase.from('inventario_movimientos').insert({
      item_id: movForm.item_id, tipo_movimiento: movForm.tipo_movimiento,
      cantidad: qty, costo_unitario: cost, costo_total: qty * cost,
      referencia: movForm.referencia || null, destino_area: movForm.destino_area || null,
      observaciones: movForm.observaciones || null, registrado_por: user?.id,
    });
    setSaving(false); setShowMovModal(false); loadData();
    setMovForm({ item_id: '', tipo_movimiento: 'entrada', cantidad: '', costo_unitario: '', referencia: '', destino_area: '', observaciones: '' });
  };

  const openEditItem = (item: InventarioItem) => {
    setEditItem(item);
    setItemForm({ codigo: item.codigo, nombre: item.nombre, categoria: item.categoria, unidad_medida: item.unidad_medida, stock_minimo: String(item.stock_minimo), costo_unitario_promedio: String(item.costo_unitario_promedio), ubicacion: item.ubicacion || '' });
    setShowItemModal(true);
  };

  const catLabels: Record<string, string> = { explosivos: 'Explosivos', combustible: 'Combustible', herramientas: 'Herramientas', epp: 'EPP', quimicos: 'Químicos', repuestos: 'Repuestos', otros: 'Otros' };
  const filtered = items.filter(i => i.nombre.toLowerCase().includes(search.toLowerCase()) || i.codigo.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Package className="w-6 h-6 text-amber-400" /> Inventario
          </h1>
          <p className="text-white/40 text-sm mt-1">{items.length} items registrados</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowMovModal(true)} disabled={!canEdit} className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed" title={!canEdit ? 'Modo observador: solo lectura' : undefined}>
            <ArrowUpCircle className="w-4 h-4" /> Movimiento
          </button>
          <button onClick={() => { setEditItem(null); setItemForm({ codigo: '', nombre: '', categoria: 'herramientas', unidad_medida: '', stock_minimo: '', costo_unitario_promedio: '', ubicacion: '' }); setShowItemModal(true); }} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed" title={!canEdit ? 'Modo observador: solo lectura' : undefined}>
            <Plus className="w-4 h-4" /> Nuevo Item
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar items..." className="input-field pl-10" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <>
          {/* VISTA MÓVIL (Tarjetas) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map(item => (
              <div key={item.id} className="card-glass p-4 relative">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm border border-amber-400/20">
                      {item.codigo}
                    </span>
                    <h3 className="font-bold text-white/85 mt-2 text-base leading-tight">{item.nombre}</h3>
                    <p className="text-sm text-white/55 mt-1"><span className="badge badge-neutral scale-90 origin-left">{catLabels[item.categoria] || '—'}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-black text-lg block leading-none flex items-center justify-end gap-1 ${item.stock_actual <= item.stock_minimo ? 'text-red-400' : 'text-white/80'}`}>
                      {item.stock_actual <= item.stock_minimo && <AlertTriangle className="w-4 h-4" />}
                      {item.stock_actual}
                    </span>
                    <span className="text-[10px] text-white/35 uppercase tracking-wide">Stock ({item.unidad_medida})</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs bg-white/[0.05] p-2.5 rounded-lg border border-white/[0.07]">
                  <div>
                    <span className="text-white/35 block mb-0.5">Stock Mínimo</span>
                    <span className="text-white/70 font-medium">{item.stock_minimo}</span>
                  </div>
                  <div>
                    <span className="text-white/35 block mb-0.5">Ubicación</span>
                    <span className="text-white/70 font-medium">{item.ubicacion || '—'}</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                  <button onClick={() => openEditItem(item)} className="btn-secondary !py-1.5 !px-3 !text-xs"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center py-12 text-white/40 card-glass">Sin items en inventario</div>}
          </div>

          {/* VISTA ESCRITORIO (Tabla) */}
          <div className="table-container hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Unidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td className="text-amber-400 font-mono">{item.codigo}</td>
                    <td className="text-white/80 font-medium">{item.nombre}</td>
                    <td><span className="badge badge-neutral">{catLabels[item.categoria]}</span></td>
                    <td className={`font-semibold ${item.stock_actual <= item.stock_minimo ? 'text-red-400' : 'text-white/70'}`}>
                      <span className="flex items-center gap-1.5">
                        {item.stock_actual <= item.stock_minimo && <AlertTriangle className="w-3.5 h-3.5" />}
                        {item.stock_actual}
                      </span>
                    </td>
                    <td className="text-white/40">{item.stock_minimo}</td>
                    <td className="text-white/50">{item.unidad_medida}</td>
                    <td>
                      <button onClick={() => openEditItem(item)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-white/40">Sin items en inventario</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowItemModal(false)}>
          <div className="relative w-full max-w-2xl bg-[#091820]/98 border border-white/[0.10] rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Item' : 'Nuevo Item'}</h2>
              <button onClick={() => setShowItemModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="input-label">Código *</label><input value={itemForm.codigo} onChange={e => setItemForm({ ...itemForm, codigo: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Categoría *</label>
                <select value={itemForm.categoria} onChange={e => setItemForm({ ...itemForm, categoria: e.target.value as InventarioItem['categoria'] })} className="input-field">
                  {Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="md:col-span-2"><label className="input-label">Nombre *</label><input value={itemForm.nombre} onChange={e => setItemForm({ ...itemForm, nombre: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Unidad de Medida *</label><input value={itemForm.unidad_medida} onChange={e => setItemForm({ ...itemForm, unidad_medida: e.target.value })} className="input-field" placeholder="kg, litros, unidades..." /></div>
              <div><label className="input-label">Stock Mínimo</label><input type="number" step="0.001" value={itemForm.stock_minimo} onChange={e => setItemForm({ ...itemForm, stock_minimo: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Costo Unit. Promedio (USD)</label><input type="number" step="0.01" value={itemForm.costo_unitario_promedio} onChange={e => setItemForm({ ...itemForm, costo_unitario_promedio: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Ubicación</label><input value={itemForm.ubicacion} onChange={e => setItemForm({ ...itemForm, ubicacion: e.target.value })} className="input-field" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.07]">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveItem} disabled={saving || !itemForm.codigo || !itemForm.nombre} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowMovModal(false)}>
          <div className="relative w-full max-w-2xl bg-[#091820]/98 border border-white/[0.10] rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">Registrar Movimiento</h2>
              <button onClick={() => setShowMovModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="input-label">Item *</label>
                <select value={movForm.item_id} onChange={e => setMovForm({ ...movForm, item_id: e.target.value })} className="input-field">
                  <option value="">Seleccionar item...</option>
                  {items.map(i => <option key={i.id} value={i.id}>[{i.codigo}] {i.nombre}</option>)}
                </select>
              </div>
              <div><label className="input-label">Tipo *</label>
                <select value={movForm.tipo_movimiento} onChange={e => setMovForm({ ...movForm, tipo_movimiento: e.target.value as InventarioMovimiento['tipo_movimiento'] })} className="input-field">
                  <option value="entrada">⬆ Entrada</option><option value="salida">⬇ Salida</option><option value="ajuste">↔ Ajuste</option>
                </select>
              </div>
              <div><label className="input-label">Cantidad *</label><input type="number" step="0.001" value={movForm.cantidad} onChange={e => setMovForm({ ...movForm, cantidad: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Costo Unitario</label><input type="number" step="0.01" value={movForm.costo_unitario} onChange={e => setMovForm({ ...movForm, costo_unitario: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Destino</label>
                <select value={movForm.destino_area} onChange={e => setMovForm({ ...movForm, destino_area: e.target.value })} className="input-field">
                  <option value="">Sin destino</option><option value="mina">Mina</option><option value="planta">Planta</option><option value="general">General</option>
                </select>
              </div>
              <div className="md:col-span-2"><label className="input-label">Referencia</label><input value={movForm.referencia} onChange={e => setMovForm({ ...movForm, referencia: e.target.value })} className="input-field" placeholder="Factura, orden, disparo..." /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.07]">
              <button onClick={() => setShowMovModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveMov} disabled={saving || !movForm.item_id || !movForm.cantidad} className="btn-primary">{saving ? 'Guardando...' : 'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
