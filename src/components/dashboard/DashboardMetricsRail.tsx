'use client';

import { memo, useState, useCallback } from 'react';
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
import { useBibliotecaOptions, useTurnoOptions } from '@/contexts/biblioteca-context';
import type { GlobalData } from './types';

type TabType = 'produccion' | 'extraccion' | 'gastos' | 'asistencia' | 'equipos';

const MOLINOS = [
  { id: 'MOLINO 1', label: 'Molino 1' },
  { id: 'MOLINO 2', label: 'Molino 2' },
  { id: 'MOLINO 3', label: 'Molino 3' },
] as const;

const GASTOS_CATEGORIAS = ['Operación', 'Mantenimiento', 'Insumos', 'Transporte'] as const;

const EQUIPO_EVENTOS = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'calibracion', label: 'Calibración' },
  { value: 'otro', label: 'Otro' },
] as const;

const GUARDIA_TURNOS = [
  { value: 'dia', label: 'Día' },
  { value: 'noche', label: 'Noche' },
] as const;

const TAB_ITEMS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: 'produccion', label: 'Producción', icon: <Factory className="h-3 w-3" /> },
  { key: 'extraccion', label: 'Extracción', icon: <Pickaxe className="h-3 w-3" /> },
  { key: 'gastos', label: 'Gastos', icon: <Receipt className="h-3 w-3" /> },
  { key: 'asistencia', label: 'Asistencia', icon: <Users className="h-3 w-3" /> },
  { key: 'equipos', label: 'Equipos', icon: <Wrench className="h-3 w-3" /> },
];

const IC = 'w-full rounded border border-[var(--dashboard-border)] bg-[#111111] px-2 py-1.5 text-[0.7rem] text-[var(--dashboard-text)] placeholder:text-[var(--dashboard-text-muted)] focus:border-[var(--dashboard-accent)] focus:outline-none';
const SC = IC;
const LC = 'block text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)] mb-0.5';

type DashboardMetricsRailProps = {
  globalData: GlobalData;
  activeNodes: number;
};

export const DashboardMetricsRail = memo(function DashboardMetricsRail({ globalData, activeNodes }: DashboardMetricsRailProps) {
  const turnoOpts = useTurnoOptions(false);
  const molinoOpts = useBibliotecaOptions('planta_molinos');
  const verticalOpts = useBibliotecaOptions('verticales_voladura', { prependEmpty: true });
  const minaOpts = useBibliotecaOptions('minas');

  const [activeTab, setActiveTab] = useState<TabType>('produccion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Producción
  const [pFecha, setPFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pTurno, setPTurno] = useState('dia');
  const [pMolino, setPMolino] = useState('');
  const [pMaterial, setPMaterial] = useState('');
  const [pSacos, setPSacos] = useState('');
  const [pOro, setPOro] = useState('');

  // Extracción
  const [eFecha, setEFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [eTurno, setETurno] = useState('dia');
  const [eVertical, setEVertical] = useState('');
  const [eMina, setEMina] = useState('');
  const [eSacos, setESacos] = useState('');
  const [eDisparo, setEDisparo] = useState('');

  // Gastos
  const [gFecha, setGFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [gMonto, setGMonto] = useState('');
  const [gCategoria, setGCategoria] = useState('');
  const [gDescripcion, setGDescripcion] = useState('');

  // Asistencia
  const [aFecha, setAFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [aTurno, setATurno] = useState('dia');
  const [aJefeSaliente, setAJefeSaliente] = useState('');
  const [aJefeEntrante, setAJefeEntrante] = useState('');
  const [aPersonalMina, setAPersonalMina] = useState('');
  const [aPersonalPlanta, setAPersonalPlanta] = useState('');
  const [aNovedades, setANovedades] = useState('');

  // Equipos
  const [qFecha, setQFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [qTipoEvento, setQTipoEvento] = useState('');
  const [qDescripcion, setQDescripcion] = useState('');
  const [qCosto, setQCosto] = useState('');

  const molinoSelectOptions = molinoOpts.length > 0 ? molinoOpts : MOLINOS.map(m => ({ value: m.id, label: m.label }));

  const resetForm = useCallback(() => {
    setPFecha(new Date().toISOString().slice(0, 10)); setPTurno('dia'); setPMolino(''); setPMaterial(''); setPSacos(''); setPOro('');
    setEFecha(new Date().toISOString().slice(0, 10)); setETurno('dia'); setEVertical(''); setEMina(''); setESacos(''); setEDisparo('');
    setGFecha(new Date().toISOString().slice(0, 10)); setGMonto(''); setGCategoria(''); setGDescripcion('');
    setAFecha(new Date().toISOString().slice(0, 10)); setATurno('dia'); setAJefeSaliente(''); setAJefeEntrante(''); setAPersonalMina(''); setAPersonalPlanta(''); setANovedades('');
    setQFecha(new Date().toISOString().slice(0, 10)); setQTipoEvento(''); setQDescripcion(''); setQCosto('');
    setActiveTab('produccion');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let payload: Record<string, unknown>;

    switch (activeTab) {
      case 'produccion':
        payload = {
          tabla: 'reportes_produccion',
          fecha: pFecha,
          turno: pTurno,
          molino: pMolino,
          material: pMaterial,
          sacos: Number(pSacos) || 0,
          oro_recuperado_g: Number(pOro) || 0,
          timestamp: new Date().toISOString(),
        };
        break;
      case 'extraccion':
        payload = {
          tabla: 'reportes_extraccion',
          fecha: eFecha,
          turno: eTurno,
          vertical: eVertical,
          mina: eMina,
          sacos_extraidos: Number(eSacos) || 0,
          numero_disparo: eDisparo,
          timestamp: new Date().toISOString(),
        };
        break;
      case 'gastos':
        payload = {
          tabla: 'gastos',
          fecha: gFecha,
          monto: Number(gMonto) || 0,
          categoria: gCategoria,
          descripcion: gDescripcion,
          timestamp: new Date().toISOString(),
        };
        break;
      case 'asistencia':
        payload = {
          tabla: 'libro_guardia',
          fecha: aFecha,
          turno: aTurno,
          jefe_saliente: aJefeSaliente,
          jefe_entrante: aJefeEntrante,
          personal_mina: Number(aPersonalMina) || 0,
          personal_planta: Number(aPersonalPlanta) || 0,
          novedades_operativas: aNovedades,
          timestamp: new Date().toISOString(),
        };
        break;
      case 'equipos':
        payload = {
          tabla: 'equipos_historial',
          fecha: qFecha,
          tipo_evento: qTipoEvento,
          descripcion: qDescripcion,
          costo: Number(qCosto) || 0,
          timestamp: new Date().toISOString(),
        };
        break;
    }

    console.log('[QuickEntry] payload:', JSON.stringify(payload, null, 2));

    // TODO: Replace with Supabase insert
    // await supabase.from(payload.tabla as string).insert(payload);

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

          {/* Tab Buttons */}
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

          {/* Dynamic Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
            {/* ── PRODUCCIÓN ── */}
            {activeTab === 'produccion' && (
              <>
                <div>
                  <label className={LC}>Fecha</label>
                  <input type="date" value={pFecha} onChange={e => setPFecha(e.target.value)} className={IC} />
                </div>
                <div>
                  <label className={LC}>Turno</label>
                  <select value={pTurno} onChange={e => setPTurno(e.target.value)} className={SC}>
                    {turnoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Molino / Lote</label>
                  <select value={pMolino} onChange={e => setPMolino(e.target.value)} className={SC}>
                    <option value="">Seleccionar…</option>
                    {molinoSelectOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Material</label>
                  <input type="text" value={pMaterial} onChange={e => setPMaterial(e.target.value)} placeholder="Nombre del material" className={IC} />
                </div>
                <div>
                  <label className={LC}>Sacos</label>
                  <input type="number" min="0" step="1" value={pSacos} onChange={e => setPSacos(e.target.value)} placeholder="0" className={IC} />
                </div>
                <div>
                  <label className={LC}>Oro recuperado (g)</label>
                  <input type="number" min="0" step="0.01" value={pOro} onChange={e => setPOro(e.target.value)} placeholder="0.00" className={IC} />
                </div>
              </>
            )}

            {/* ── EXTRACCIÓN ── */}
            {activeTab === 'extraccion' && (
              <>
                <div>
                  <label className={LC}>Fecha</label>
                  <input type="date" value={eFecha} onChange={e => setEFecha(e.target.value)} className={IC} />
                </div>
                <div>
                  <label className={LC}>Turno</label>
                  <select value={eTurno} onChange={e => setETurno(e.target.value)} className={SC}>
                    {turnoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Vertical</label>
                  <select value={eVertical} onChange={e => setEVertical(e.target.value)} className={SC}>
                    <option value="">— Sin especificar —</option>
                    {verticalOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Mina</label>
                  <select value={eMina} onChange={e => setEMina(e.target.value)} className={SC}>
                    <option value="">Seleccionar…</option>
                    {minaOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Sacos extraídos</label>
                  <input type="number" min="0" step="1" value={eSacos} onChange={e => setESacos(e.target.value)} placeholder="0" className={IC} />
                </div>
                <div>
                  <label className={LC}>N° Disparo</label>
                  <input type="text" value={eDisparo} onChange={e => setEDisparo(e.target.value)} placeholder="Opcional" className={IC} />
                </div>
              </>
            )}

            {/* ── GASTOS ── */}
            {activeTab === 'gastos' && (
              <>
                <div>
                  <label className={LC}>Fecha</label>
                  <input type="date" value={gFecha} onChange={e => setGFecha(e.target.value)} className={IC} />
                </div>
                <div>
                  <label className={LC}>Monto ($)</label>
                  <input type="number" min="0" step="0.01" value={gMonto} onChange={e => setGMonto(e.target.value)} placeholder="0.00" className={IC} />
                </div>
                <div>
                  <label className={LC}>Categoría</label>
                  <select value={gCategoria} onChange={e => setGCategoria(e.target.value)} className={SC}>
                    <option value="">Seleccionar…</option>
                    {GASTOS_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Descripción</label>
                  <textarea value={gDescripcion} onChange={e => setGDescripcion(e.target.value)} placeholder="Detalle del gasto" rows={2} className={`${IC} resize-none`} />
                </div>
              </>
            )}

            {/* ── ASISTENCIA (Libro de Guardia) ── */}
            {activeTab === 'asistencia' && (
              <>
                <div>
                  <label className={LC}>Fecha</label>
                  <input type="date" value={aFecha} onChange={e => setAFecha(e.target.value)} className={IC} />
                </div>
                <div>
                  <label className={LC}>Turno</label>
                  <select value={aTurno} onChange={e => setATurno(e.target.value)} className={SC}>
                    {GUARDIA_TURNOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Jefe saliente</label>
                  <input type="text" value={aJefeSaliente} onChange={e => setAJefeSaliente(e.target.value)} placeholder="Nombre" className={IC} />
                </div>
                <div>
                  <label className={LC}>Jefe entrante</label>
                  <input type="text" value={aJefeEntrante} onChange={e => setAJefeEntrante(e.target.value)} placeholder="Nombre" className={IC} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className={LC}>Personal mina</label>
                    <input type="number" min="0" step="1" value={aPersonalMina} onChange={e => setAPersonalMina(e.target.value)} placeholder="0" className={IC} />
                  </div>
                  <div>
                    <label className={LC}>Personal planta</label>
                    <input type="number" min="0" step="1" value={aPersonalPlanta} onChange={e => setAPersonalPlanta(e.target.value)} placeholder="0" className={IC} />
                  </div>
                </div>
                <div>
                  <label className={LC}>Novedades operativas</label>
                  <textarea value={aNovedades} onChange={e => setANovedades(e.target.value)} placeholder="Novedades del turno" rows={2} className={`${IC} resize-none`} />
                </div>
              </>
            )}

            {/* ── EQUIPOS (Historial) ── */}
            {activeTab === 'equipos' && (
              <>
                <div>
                  <label className={LC}>Fecha</label>
                  <input type="date" value={qFecha} onChange={e => setQFecha(e.target.value)} className={IC} />
                </div>
                <div>
                  <label className={LC}>Tipo de evento</label>
                  <select value={qTipoEvento} onChange={e => setQTipoEvento(e.target.value)} className={SC}>
                    <option value="">Seleccionar…</option>
                    {EQUIPO_EVENTOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Descripción</label>
                  <textarea value={qDescripcion} onChange={e => setQDescripcion(e.target.value)} placeholder="Detalle del evento" rows={2} className={`${IC} resize-none`} />
                </div>
                <div>
                  <label className={LC}>Costo ($)</label>
                  <input type="number" min="0" step="0.01" value={qCosto} onChange={e => setQCosto(e.target.value)} placeholder="0.00" className={IC} />
                </div>
              </>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full rounded bg-yellow-500 py-2 text-[0.75rem] font-bold text-black transition-all hover:bg-yellow-400 disabled:opacity-50"
            >
              {showSuccess ? '✓ Registrado' : isSubmitting ? 'Registrando…' : 'REGISTRAR'}
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
});