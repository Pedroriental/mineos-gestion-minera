'use client';

import { memo, useState } from 'react';
import {
  Factory,
  Gem,
  Layers,
  Pickaxe,
  Receipt,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { SolidMetricCard } from './SolidMetricCard';
import type { GlobalData } from './types';

type TabType = 'produccion' | 'extraccion' | 'gastos' | 'asistencia' | 'equipos';

const MOLINOS = [
  { id: 'MOLINO 1', label: 'Molino 1' },
  { id: 'MOLINO 2', label: 'Molino 2' },
  { id: 'MOLINO 3', label: 'Molino 3' },
] as const;

const GASTOS_CATEGORIAS = ['Operación', 'Mantenimiento', 'Insumos', 'Transporte'] as const;

const TAB_ITEMS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: 'produccion', label: 'Producción', icon: <Factory className="h-3 w-3" /> },
  { key: 'extraccion', label: 'Extracción', icon: <Pickaxe className="h-3 w-3" /> },
  { key: 'gastos', label: 'Gastos', icon: <Receipt className="h-3 w-3" /> },
  { key: 'asistencia', label: 'Asistencia', icon: <Users className="h-3 w-3" /> },
  { key: 'equipos', label: 'Equipos', icon: <Wrench className="h-3 w-3" /> },
];

const INPUT_CLASSES =
  'w-full rounded border border-[var(--dashboard-border)] bg-[#111111] px-2 py-1.5 text-[0.7rem] text-[var(--dashboard-text)] placeholder:text-[var(--dashboard-text-muted)] focus:border-[var(--dashboard-accent)] focus:outline-none';

type DashboardMetricsRailProps = {
  globalData: GlobalData;
  activeNodes: number;
};

export const DashboardMetricsRail = memo(function DashboardMetricsRail({ globalData, activeNodes }: DashboardMetricsRailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('produccion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedMolino, setSelectedMolino] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [fechaHora, setFechaHora] = useState(() => new Date().toISOString().slice(0, 16));
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const resetForm = () => {
    setSelectedMolino('');
    setCantidad('');
    setFechaHora(new Date().toISOString().slice(0, 16));
    setMonto('');
    setCategoria('');
    setDescripcion('');
    setActiveTab('produccion');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      tab: activeTab,
      molino: selectedMolino || null,
      cantidad: cantidad ? Number(cantidad) : null,
      monto: monto ? Number(monto) : null,
      categoria: categoria || null,
      descripcion: descripcion || null,
      fechaHora: fechaHora || null,
      timestamp: new Date().toISOString(),
    };

    console.log('[QuickEntry] payload:', JSON.stringify(payload, null, 2));

    // TODO: Replace with Supabase insert
    // await supabase.from('quick_entries').insert(payload);

    setIsSubmitting(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    resetForm();
  };

  return (
    <aside className="dashboard-metrics-rail" aria-labelledby="dashboard-kpi-heading">
      <div className="dashboard-metrics-rail__head">
        <h2 id="dashboard-kpi-heading" className="dashboard-metrics-rail__title">
          Panel operativo
        </h2>
        <p className="dashboard-metrics-rail__desc">Detalle financiero y de planta</p>
      </div>

      <div className="dashboard-metrics-rail__list scroll-y-fade">
        <p className="dashboard-metrics-rail__section">Producción</p>
        <SolidMetricCard
          layout="rail"
          label="Producción Mensual"
          value={globalData.produccionMensual.toLocaleString('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          unit="g Au"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <SolidMetricCard
          layout="rail"
          featured
          label="Oro Total Recuperado"
          value={globalData.oroTotalRecuperado.toLocaleString('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          unit="g Au"
          icon={<Gem className="h-4 w-4" />}
        />
        <SolidMetricCard
          layout="rail"
          label="Balance Plancha 1"
          value={globalData.balancePlancha1.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          unit="g Au"
          icon={<Layers className="h-3.5 w-3.5" />}
        />

        {/* ── Quick Entry Panel ─────────────────────────────── */}
        <p className="dashboard-metrics-rail__section">Entrada Rápida</p>
        <div className="flex flex-col gap-2 overflow-y-auto py-1">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
            # Reporte Rápido / Modo Entrada Rápida
          </p>

          <div className="grid grid-cols-5 gap-1">
            {TAB_ITEMS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={[
                  'flex flex-col items-center gap-0.5 rounded border py-1 px-0.5 text-[0.55rem] font-medium uppercase tracking-wide transition-all',
                  activeTab === key
                    ? 'border-[var(--dashboard-accent)] bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]'
                    : 'border-[var(--dashboard-border)] text-[var(--dashboard-text-muted)] hover:border-[var(--dashboard-accent)]/40 hover:text-[var(--dashboard-text)]',
                ].join(' ')}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {(activeTab === 'produccion' || activeTab === 'extraccion') && (
              <>
                <select
                  value={selectedMolino}
                  onChange={(e) => setSelectedMolino(e.target.value)}
                  className={INPUT_CLASSES}
                >
                  <option value="">Seleccionar Molino / Lote</option>
                  {MOLINOS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Cantidad (kg)"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className={INPUT_CLASSES}
                />
                <input
                  type="datetime-local"
                  value={fechaHora}
                  onChange={(e) => setFechaHora(e.target.value)}
                  className={INPUT_CLASSES}
                />
              </>
            )}

            {activeTab === 'gastos' && (
              <>
                <input
                  type="number"
                  placeholder="Monto ($)"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={INPUT_CLASSES}
                />
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className={INPUT_CLASSES}
                >
                  <option value="">Categoría</option>
                  {GASTOS_CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <textarea
                  placeholder="Descripción"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                  className={`${INPUT_CLASSES} resize-none`}
                />
              </>
            )}

            {(activeTab === 'asistencia' || activeTab === 'equipos') && (
              <div className="flex min-h-[5rem] items-center justify-center text-[0.65rem] text-[var(--dashboard-text-muted)]">
                Módulo en desarrollo
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full rounded bg-yellow-500 py-2 text-[0.75rem] font-bold text-black transition-all hover:bg-yellow-400 disabled:opacity-50"
            >
              {showSuccess ? '✓ Registrado' : isSubmitting ? 'Registrando...' : 'REGISTRAR'}
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
});