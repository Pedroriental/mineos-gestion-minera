'use client';

import { useEffect, useState, useTransition } from 'react';
import { Building2, Plus, Edit2, Trash2, Loader2, Save, X, RefreshCw } from 'lucide-react';
import {
  listEmpresasInversorasAction,
  createEmpresaInversoraAction,
  updateEmpresaInversoraAction,
  deleteEmpresaInversoraAction,
} from '@/lib/actions/empresas-inversoras';
import type { CompensacionEmpresa } from '@/lib/compensacion-gastos';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

export default function InversoresTab() {
  const [empresas, setEmpresas] = useState<CompensacionEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<CompensacionEmpresa | null>(null);
  const confirm = useConfirm();

  // Form states
  const [nombre, setNombre] = useState('');
  const [nombreCorto, setNombreCorto] = useState('');
  const [porcentaje, setPorcentaje] = useState(0);
  const [color, setColor] = useState('#DAA520');
  const [notas, setNotas] = useState('');

  const cargarEmpresas = () => {
    setLoading(true);
    listEmpresasInversorasAction().then((res) => {
      if (res.ok && res.data) {
        setEmpresas(res.data);
      } else {
        toastError('Error al cargar empresas inversoras');
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    // Evitar setState sincronico en effect para cumplir con las reglas del proyecto
    const init = async () => {
      listEmpresasInversorasAction().then((res) => {
        if (res.ok && res.data) {
          setEmpresas(res.data);
        } else {
          toastError('Error al cargar empresas inversoras');
        }
        setLoading(false);
      });
    };
    init();
  }, []);

  const openAddModal = () => {
    setEditingEmpresa(null);
    setNombre('');
    setNombreCorto('');
    setPorcentaje(0);
    setColor('#DAA520');
    setNotas('');
    setIsModalOpen(true);
  };

  const openEditModal = (emp: CompensacionEmpresa) => {
    setEditingEmpresa(emp);
    setNombre(emp.nombre);
    setNombreCorto(emp.nombre_corto);
    setPorcentaje(emp.porcentaje);
    setColor(emp.color);
    setNotas('');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!nombreCorto.trim() || !/^[a-z0-9_]+$/.test(nombreCorto)) {
      toast.error('El nombre corto solo debe tener minusculas, numeros y guion bajo');
      return;
    }

    const payload = {
      nombre: nombre.trim(),
      nombre_corto: nombreCorto.trim(),
      porcentaje_participacion: Number(porcentaje),
      color,
      activo: true,
      notas: notas.trim() || null,
    };

    startTransition(async () => {
      let res;
      if (editingEmpresa) {
        res = await updateEmpresaInversoraAction(editingEmpresa.id, payload);
      } else {
        res = await createEmpresaInversoraAction(payload);
      }

      if (res.ok) {
        toast.success(res.message || 'Operacion realizada correctamente');
        setIsModalOpen(false);
        cargarEmpresas();
      } else {
        toastError(res.message || 'Error al guardar la empresa inversora');
      }
    });
  };

  const handleDelete = async (emp: CompensacionEmpresa) => {
    const ok = await confirm({
      title: 'Desactivar Empresa Inversora',
      message: `¿Estas seguro de que quieres desactivar a "${emp.nombre}"? Ya no aparecera en las opciones de seleccion para nuevos gastos.`,
      confirmText: 'Desactivar',
      cancelText: 'Cancelar',
    });

    if (!ok) return;

    startTransition(async () => {
      const res = await deleteEmpresaInversoraAction(emp.id);
      if (res.ok) {
        toast.success(res.message || 'Empresa desactivada');
        cargarEmpresas();
      } else {
        toastError(res.message || 'Error al desactivar la empresa');
      }
    });
  };

  const totalPorcentaje = empresas.reduce((sum, e) => sum + e.porcentaje, 0);

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--dashboard-text-muted)]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--dashboard-text)]">
            Empresas Inversoras
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cargarEmpresas}
            className="gastos-page-btn p-2 rounded-lg"
            title="Refrescar lista"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="gastos-page-btn flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar Inversor
          </button>
        </div>
      </div>

      {/* Progress tracking indicator of total % */}
      <div className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-background)]/20 p-3">
        <div className="mb-2 flex items-center justify-between text-[10px]">
          <span className="text-[var(--dashboard-text-muted)] font-medium">Participacion Total Asignada</span>
          <span className={`font-bold ${Math.abs(totalPorcentaje - 100) > 0.01 ? 'text-[var(--mineos-expense-bright)]' : 'text-[var(--mineos-benefit-bright)]'}`}>
            {totalPorcentaje}% / 100%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden flex">
          {empresas.map((emp) => (
            <div
              key={emp.id}
              style={{
                width: `${emp.porcentaje}%`,
                backgroundColor: emp.color,
              }}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
              title={`${emp.nombre}: ${emp.porcentaje}%`}
            />
          ))}
        </div>
        {Math.abs(totalPorcentaje - 100) > 0.01 && (
          <p className="mt-1.5 text-[9px] text-[var(--mineos-expense-bright)]">
            ⚠ La suma de los porcentajes de participacion es {totalPorcentaje}%. Deberia sumar exactamente 100% para un calculo de compensacion preciso.
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-[var(--dashboard-text-muted)] py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando inversores...
        </div>
      ) : empresas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-[11px] text-[var(--dashboard-text-muted)] border border-dashed border-[var(--dashboard-border)] rounded-xl">
          <Building2 className="h-8 w-8 opacity-30" />
          <p>No hay empresas inversoras configuradas.</p>
          <button
            type="button"
            onClick={openAddModal}
            className="text-[var(--dashboard-accent)] hover:underline"
          >
            Crea la primera empresa inversora ahora
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {empresas.map((emp) => (
            <div
              key={emp.id}
              className="group relative flex flex-col justify-between rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-background)]/20 p-4 transition hover:border-[var(--dashboard-accent)]/30 hover:bg-[var(--dashboard-background)]/40"
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-1 h-3 w-3 shrink-0 rounded-full shadow-lg"
                  style={{ backgroundColor: emp.color, boxShadow: `0 0 8px ${emp.color}40` }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-[var(--dashboard-text)] truncate">
                    {emp.nombre}
                  </h3>
                  <code className="text-[9px] text-[var(--dashboard-text-muted)] bg-white/5 rounded px-1.5 py-0.5">
                    {emp.nombre_corto}
                  </code>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black tracking-tight text-[var(--dashboard-text)]">
                    {emp.porcentaje}%
                  </span>
                  <p className="text-[8px] text-[var(--dashboard-text-muted)] uppercase tracking-wider">
                    Participacion
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-[var(--dashboard-border)] pt-3 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => openEditModal(emp)}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded bg-white/5 px-2.5 py-1 text-[9px] font-semibold text-[var(--dashboard-text)] hover:bg-white/10"
                >
                  <Edit2 className="h-2.5 w-2.5" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(emp)}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded bg-[var(--mineos-expense-soft)] px-2.5 py-1 text-[9px] font-semibold text-[var(--mineos-expense-bright)] hover:bg-[var(--mineos-expense-soft)]/80"
                >
                  <Trash2 className="h-2.5 w-2.5" /> Desactivar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-background)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--dashboard-text)]">
                {editingEmpresa ? 'Editar Empresa Inversora' : 'Agregar Empresa Inversora'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--dashboard-text-muted)]">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Los Riasco"
                  className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-background)] px-3 py-2 text-[11px] text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]/50"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--dashboard-text-muted)]">
                    Codigo Corto *
                  </label>
                  <input
                    type="text"
                    required
                    value={nombreCorto}
                    onChange={(e) => setNombreCorto(e.target.value)}
                    placeholder="Ej: los_riascos"
                    disabled={!!editingEmpresa}
                    className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-background)] px-3 py-2 text-[11px] text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]/50 disabled:opacity-50"
                  />
                  <p className="mt-1 text-[8px] text-[var(--dashboard-text-muted)]">
                    Solo minusculas, numeros y guion bajo.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--dashboard-text-muted)]">
                    Participacion (%) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(Number(e.target.value) || 0)}
                    placeholder="Ej: 60"
                    className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-background)] px-3 py-2 text-[11px] text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]/50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--dashboard-text-muted)]">
                  Color Representativo
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-[var(--dashboard-border)] bg-transparent"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-background)] px-3 py-2 text-[11px] text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]/50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--dashboard-text-muted)]">
                  Notas / Observaciones
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Detalles sobre el inversor o la division..."
                  className="h-16 w-full resize-none rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-background)] px-3 py-2 text-[11px] text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--dashboard-border)] pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="rounded-lg bg-white/5 px-4 py-2 text-[10px] font-bold text-[var(--dashboard-text)] hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--dashboard-accent)] px-4 py-2 text-[10px] font-bold text-black hover:bg-[var(--dashboard-accent)]/90"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {editingEmpresa ? 'Guardar Cambios' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
