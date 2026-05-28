'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import type { FilterOptions, ReportModule, DateRange } from '@/lib/reports/report-types';
import {
  fetchProduccionReport,
  fetchNominaReport,
  fetchVoladurasReport,
  fetchQuemadoReport,
  fetchExtraccionReport,
  fetchGastosReport,
  fetchBalanceReport,
} from '@/lib/actions/report-actions';
import {
  aggregateProduccion,
  aggregateNomina,
  aggregateVoladuras,
  aggregateQuemado,
  aggregateExtraccion,
  aggregateGastos,
  aggregateBalance,
} from '@/lib/reports/report-engine';
import { downloadReportPDF } from '@/lib/reports/report-pdf-generator';
import { downloadReportCSV } from '@/lib/reports/report-csv-generator';
import {
  Loader2,
  Calendar,
  Download,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  Coins,
  Users,
  Flame,
  Zap,
  Receipt,
  Calculator,
  HardHat,
  Beaker,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ReportesClientProps {
  initialOptions: FilterOptions;
}

export default function ReportesClient({ initialOptions }: ReportesClientProps) {
  const [activeTab, setActiveTab] = useState<ReportModule>('produccion');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── 1. Date Range States ──────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange>({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  // ── 2. Filter States per Module ──────────────────────────
  // Producción
  const [selectedMolinos, setSelectedMolinos] = useState<string[]>([]);
  const [selectedMateriales, setSelectedMateriales] = useState<string[]>([]);
  const [selectedTurnosProd, setSelectedTurnosProd] = useState<string[]>([]);
  const [groupByProd, setGroupByProd] = useState<'dia' | 'semana' | 'mes' | 'molino' | 'material'>('dia');

  // Nómina
  const [selectedAreasNom, setSelectedAreasNom] = useState<string[]>([]);
  const [selectedCargosNom, setSelectedCargosNom] = useState<string[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [groupByNom, setGroupByNom] = useState<'semana' | 'mes' | 'area' | 'cargo' | 'trabajador'>('semana');

  // Voladuras
  const [selectedMinasVol, setSelectedMinasVol] = useState<string[]>([]);
  const [selectedVerticalesVol, setSelectedVerticalesVol] = useState<string[]>([]);
  const [selectedTurnosVol, setSelectedTurnosVol] = useState<string[]>([]);
  const [groupByVol, setGroupByVol] = useState<'dia' | 'semana' | 'mina'>('dia');

  // Quemado
  const [selectedTurnosQuem, setSelectedTurnosQuem] = useState<string[]>([]);
  const [groupByQuem, setGroupByQuem] = useState<'dia' | 'semana' | 'mes'>('dia');

  // Extracción
  const [selectedMinasExt, setSelectedMinasExt] = useState<string[]>([]);
  const [selectedVerticalesExt, setSelectedVerticalesExt] = useState<string[]>([]);
  const [selectedTurnosExt, setSelectedTurnosExt] = useState<string[]>([]);
  const [groupByExt, setGroupByExt] = useState<'dia' | 'semana' | 'mina'>('dia');

  // Gastos
  const [selectedCategoriasGst, setSelectedCategoriasGst] = useState<string[]>([]);
  const [selectedTiposGst, setSelectedTiposGst] = useState<string[]>([]);
  const [searchProveedor, setSearchProveedor] = useState<string>('');
  const [groupByGst, setGroupByGst] = useState<'dia' | 'semana' | 'mes' | 'categoria'>('dia');

  // Balance General
  const [groupByBal, setGroupByBal] = useState<'semana' | 'mes'>('semana');
  const [goldPriceInput, setGoldPriceInput] = useState<number>(75.0); // Valor estimado p/gramo

  // ── 3. Data States ────────────────────────────────────────
  const [rawData, setRawData] = useState<any>(null);

  // Limpiar datos al cambiar de pestaña para evitar agregaciones incorrectas de datos obsoletos
  useEffect(() => {
    setRawData(null);
  }, [activeTab]);

  // ── 4. Trigger Data Fetching on filter changes ──────────
  useEffect(() => {
    setError(null);
    startTransition(async () => {
      try {
        let fetched: any = null;
        if (activeTab === 'produccion') {
          fetched = await fetchProduccionReport({
            dateRange,
            molinos: selectedMolinos,
            materiales: selectedMateriales,
            turnos: selectedTurnosProd as any,
          });
        } else if (activeTab === 'nomina') {
          fetched = await fetchNominaReport({
            dateRange,
            areas: selectedAreasNom as any,
            cargos: selectedCargosNom,
            personalId: selectedWorkerId,
          });
        } else if (activeTab === 'voladuras') {
          fetched = await fetchVoladurasReport({
            dateRange,
            minas: selectedMinasVol,
            verticales: selectedVerticalesVol,
            turnos: selectedTurnosVol as any,
          });
        } else if (activeTab === 'quemado') {
          fetched = await fetchQuemadoReport({
            dateRange,
            turnos: selectedTurnosQuem as any,
          });
        } else if (activeTab === 'extraccion') {
          fetched = await fetchExtraccionReport({
            dateRange,
            minas: selectedMinasExt,
            verticales: selectedVerticalesExt,
            turnos: selectedTurnosExt as any,
          });
        } else if (activeTab === 'gastos') {
          fetched = await fetchGastosReport({
            dateRange,
            categorias: selectedCategoriasGst,
            tipos: selectedTiposGst as any,
            proveedor: searchProveedor,
          });
        } else if (activeTab === 'balance') {
          fetched = await fetchBalanceReport({
            dateRange,
          });
        }
        setRawData(fetched);
      } catch (err: any) {
        console.error('Error fetching report data:', err);
        setError('No se pudieron obtener los datos filtrados de la base de datos.');
      }
    });
  }, [
    activeTab,
    dateRange,
    // Producción dependency array
    selectedMolinos,
    selectedMateriales,
    selectedTurnosProd,
    // Nómina dependency array
    selectedAreasNom,
    selectedCargosNom,
    selectedWorkerId,
    // Voladuras dependency array
    selectedMinasVol,
    selectedVerticalesVol,
    selectedTurnosVol,
    // Quemado dependency array
    selectedTurnosQuem,
    // Extracción dependency array
    selectedMinasExt,
    selectedVerticalesExt,
    selectedTurnosExt,
    // Gastos dependency array
    selectedCategoriasGst,
    selectedTiposGst,
    searchProveedor,
  ]);

  // ── 5. Run Aggregation logic via Engine ──────────────────
  const aggregated = useMemo<any>(() => {
    if (!rawData || error) return null;

    if (activeTab === 'produccion' && Array.isArray(rawData)) {
      return aggregateProduccion(rawData, groupByProd);
    } else if (activeTab === 'nomina' && Array.isArray(rawData)) {
      return aggregateNomina(rawData, groupByNom);
    } else if (activeTab === 'voladuras' && Array.isArray(rawData)) {
      return aggregateVoladuras(rawData, groupByVol);
    } else if (activeTab === 'quemado' && Array.isArray(rawData)) {
      return aggregateQuemado(rawData, groupByQuem);
    } else if (activeTab === 'extraccion' && Array.isArray(rawData)) {
      return aggregateExtraccion(rawData, groupByExt);
    } else if (activeTab === 'gastos' && Array.isArray(rawData)) {
      return aggregateGastos(rawData, groupByGst);
    } else if (activeTab === 'balance' && !Array.isArray(rawData) && rawData.produccion) {
      return aggregateBalance(rawData, groupByBal, goldPriceInput);
    }
    return null;
  }, [rawData, activeTab, groupByProd, groupByNom, groupByVol, groupByQuem, groupByExt, groupByGst, groupByBal, goldPriceInput, error]);

  // ── 6. Download Handlers ──────────────────────────────────
  const handleDownloadPDF = () => {
    if (!aggregated) return;
    const groupOpt =
      activeTab === 'produccion' ? groupByProd :
      activeTab === 'nomina' ? groupByNom :
      activeTab === 'voladuras' ? groupByVol :
      activeTab === 'quemado' ? groupByQuem :
      activeTab === 'extraccion' ? groupByExt :
      activeTab === 'gastos' ? groupByGst : groupByBal;
    downloadReportPDF(activeTab, aggregated, dateRange, groupOpt);
  };

  const handleDownloadCSV = () => {
    if (!aggregated) return;
    const groupOpt =
      activeTab === 'produccion' ? groupByProd :
      activeTab === 'nomina' ? groupByNom :
      activeTab === 'voladuras' ? groupByVol :
      activeTab === 'quemado' ? groupByQuem :
      activeTab === 'extraccion' ? groupByExt :
      activeTab === 'gastos' ? groupByGst : groupByBal;
    downloadReportCSV(activeTab, aggregated, groupOpt);
  };

  // ── 7. Toggle Option Helper ────────────────────────────────
  const toggleOption = (list: string[], setList: (v: string[]) => void, value: string) => {
    if (list.includes(value)) {
      setList(list.filter((x) => x !== value));
    } else {
      setList([...list, value]);
    }
  };

  // Tabs structure
  const tabs = [
    { id: 'produccion', label: 'Producción', icon: <Beaker className="w-4 h-4" /> },
    { id: 'nomina', label: 'Nómina', icon: <Users className="w-4 h-4" /> },
    { id: 'voladuras', label: 'Voladuras', icon: <Zap className="w-4 h-4" /> },
    { id: 'quemado', label: 'Quemado', icon: <Flame className="w-4 h-4" /> },
    { id: 'extraccion', label: 'Extracción', icon: <HardHat className="w-4 h-4" /> },
    { id: 'gastos', label: 'Gastos', icon: <Receipt className="w-4 h-4" /> },
    { id: 'balance', label: 'Balance General', icon: <Calculator className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            📊 Centro de Reportes y Balances
          </h1>
          <p className="text-sm text-zinc-400">
            Descarga reportes dinámicos de toda tu operación minera con filtros y algoritmos de agregación en tiempo real.
          </p>
        </div>
      </div>

      {/* TABS CONTAINER */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as ReportModule);
              setError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                : 'text-zinc-400 hover:text-white border border-transparent hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* MAIN CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN: FILTERS (Glassmorphic Card) */}
        <div className="lg:col-span-1 space-y-4 rounded-2xl border border-white/5 bg-zinc-950/25 p-5 backdrop-blur-xl">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-500">
            📅 Rango de Fechas
          </h3>
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-zinc-400">Desde</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-zinc-400">Hasta</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-500">
              ⚡ Filtros Dinámicos
            </h3>

            {/* DYNAMIC COMPONENT-SPECIFIC FILTERS */}
            {activeTab === 'produccion' && (
              <div className="space-y-3">
                {/* Molino */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Molino / Continuo</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.produccion.molinos.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleOption(selectedMolinos, setSelectedMolinos, m)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                          selectedMolinos.includes(m)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Material */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Material de Origen</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.produccion.materiales.map((mat) => (
                      <button
                        key={mat}
                        type="button"
                        onClick={() => toggleOption(selectedMateriales, setSelectedMateriales, mat)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                          selectedMateriales.includes(mat)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {mat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turno */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Turno Operativo</label>
                  <div className="flex gap-1">
                    {['dia', 'noche'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleOption(selectedTurnosProd, setSelectedTurnosProd, t)}
                        className={`flex-1 px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg border transition-all duration-150 ${
                          selectedTurnosProd.includes(t)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className="text-[11px] font-bold text-zinc-400">Agrupar Datos por</label>
                  <select
                    value={groupByProd}
                    onChange={(e) => setGroupByProd(e.target.value as any)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                    <option value="molino">Por Molino</option>
                    <option value="material">Por Material</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'nomina' && (
              <div className="space-y-3">
                {/* Area */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Área Operativa</label>
                  <div className="flex flex-wrap gap-1">
                    {['mina', 'planta', 'administracion', 'seguridad', 'transporte'].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleOption(selectedAreasNom, setSelectedAreasNom, a)}
                        className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border transition-all duration-150 ${
                          selectedAreasNom.includes(a)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {a === 'planta' ? 'Molino' : a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cargo */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Cargos Específicos</label>
                  <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto pr-1">
                    {initialOptions.nomina.cargos.map((cg) => (
                      <button
                        key={cg}
                        type="button"
                        onClick={() => toggleOption(selectedCargosNom, setSelectedCargosNom, cg)}
                        className={`px-2 py-0.5 text-[10px] rounded-md border transition-all duration-150 ${
                          selectedCargosNom.includes(cg)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {cg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trabajador */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Trabajador Singular</label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- Todos los Trabajadores --</option>
                    {initialOptions.nomina.personal.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre_completo} ({p.cedula})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className="text-[11px] font-bold text-zinc-400">Agrupar Nómina por</label>
                  <select
                    value={groupByNom}
                    onChange={(e) => setGroupByNom(e.target.value as any)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                    <option value="area">Por Área Operativa</option>
                    <option value="cargo">Por Cargo de Personal</option>
                    <option value="trabajador">Por Trabajador</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'voladuras' && (
              <div className="space-y-3">
                {/* Minas */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Zonas de Mina</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.voladuras.minas.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleOption(selectedMinasVol, setSelectedMinasVol, m)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                          selectedMinasVol.includes(m)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verticales */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Frentes Verticales</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.voladuras.verticales.map((vt) => (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => toggleOption(selectedVerticalesVol, setSelectedVerticalesVol, vt)}
                        className={`px-2 py-0.5 text-[11px] rounded-md border transition-all duration-150 ${
                          selectedVerticalesVol.includes(vt)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {vt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turno */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Turno de Disparo</label>
                  <div className="flex gap-1">
                    {['dia', 'noche'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleOption(selectedTurnosVol, setSelectedTurnosVol, t)}
                        className={`flex-1 px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg border transition-all duration-150 ${
                          selectedTurnosVol.includes(t)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className="text-[11px] font-bold text-zinc-400">Agrupar Voladuras por</label>
                  <select
                    value={groupByVol}
                    onChange={(e) => setGroupByVol(e.target.value as any)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mina">Por Mina</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'quemado' && (
              <div className="space-y-3">
                {/* Turno */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Turno de Quemado</label>
                  <div className="flex gap-1">
                    {['dia', 'noche'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleOption(selectedTurnosQuem, setSelectedTurnosQuem, t)}
                        className={`flex-1 px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg border transition-all duration-150 ${
                          selectedTurnosQuem.includes(t)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className="text-[11px] font-bold text-zinc-400">Agrupar por</label>
                  <select
                    value={groupByQuem}
                    onChange={(e) => setGroupByQuem(e.target.value as any)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'extraccion' && (
              <div className="space-y-3">
                {/* Minas */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Zonas de Mina</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.extraccion.minas.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleOption(selectedMinasExt, setSelectedMinasExt, m)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                          selectedMinasExt.includes(m)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verticales */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Frentes Verticales</label>
                  <div className="flex flex-wrap gap-1">
                    {initialOptions.extraccion.verticales.map((vt) => (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => toggleOption(selectedVerticalesExt, setSelectedVerticalesExt, vt)}
                        className={`px-2 py-0.5 text-[11px] rounded-md border transition-all duration-150 ${
                          selectedVerticalesExt.includes(vt)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {vt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turno */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Turno Operativo</label>
                  <div className="flex gap-1">
                    {['dia', 'noche'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleOption(selectedTurnosExt, setSelectedTurnosExt, t)}
                        className={`flex-1 px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg border transition-all duration-150 ${
                          selectedTurnosExt.includes(t)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className="text-[11px] font-bold text-zinc-400">Agrupar por</label>
                  <select
                    value={groupByExt}
                    onChange={(e) => setGroupByExt(e.target.value as any)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mina">Por Mina</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'gastos' && (
              <div className="space-y-3">
                {/* Categorías */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Categorías de Gastos</label>
                  <div className="flex flex-wrap gap-1 max-h-[140px] overflow-y-auto pr-1">
                    {initialOptions.gastos.categorias.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleOption(selectedCategoriasGst, setSelectedCategoriasGst, c.id)}
                        className={`px-2 py-0.5 text-[10px] rounded-md border transition-all duration-150 ${
                          selectedCategoriasGst.includes(c.id)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de Gasto */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Tipos Administrativos</label>
                  <div className="flex flex-wrap gap-1">
                    {['mina', 'planta', 'general', 'transporte', 'seguridad', 'administrativo'].map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        onClick={() => toggleOption(selectedTiposGst, setSelectedTiposGst, tp)}
                        className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border transition-all duration-150 ${
                          selectedTiposGst.includes(tp)
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {tp === 'planta' ? 'Molino' : tp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Proveedor / Factura buscador */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">Buscar Proveedor / Factura</label>
                  <input
                    type="text"
                    value={searchProveedor}
                    onChange={(e) => setSearchProveedor(e.target.value)}
                    placeholder="Escriba aquí..."
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className="text-[11px] font-bold text-zinc-400">Agrupar por</label>
                  <select
                    value={groupByGst}
                    onChange={(e) => setGroupByGst(e.target.value as any)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="dia">Por Día</option>
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                    <option value="categoria">Por Categoría</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'balance' && (
              <div className="space-y-3">
                {/* Gold Price parameter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
                    💰 Precio Oro p/Gramo (USD)
                    <span title="Se usa para estimar ingresos brutos basados en gramos de oro puro recuperado.">
                      <HelpCircle className="w-3 h-3 text-zinc-500 hover:text-amber-500 cursor-pointer" />
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-zinc-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={goldPriceInput}
                      onChange={(e) => setGoldPriceInput(parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-900/60 border border-white/10 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Agrupar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <label className="text-[11px] font-bold text-zinc-400">Agrupar Balance por</label>
                  <select
                    value={groupByBal}
                    onChange={(e) => setGroupByBal(e.target.value as any)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="semana">Por Semana</option>
                    <option value="mes">Por Mes</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW & DOWNLOADS */}
        <div className="lg:col-span-3 space-y-6">
          {/* PREVIEW CONTAINER */}
          <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5 backdrop-blur-xl space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                🔎 Vista Previa de Datos
                {isPending && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
              </h2>
              {aggregated && aggregated.rows.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 text-xs font-semibold hover:bg-amber-500/20 transition-all duration-150 shadow-[0_0_15px_rgba(245,158,11,0.03)]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Descargar PDF
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 text-xs font-semibold hover:bg-emerald-500/20 transition-all duration-150 shadow-[0_0_15px_rgba(16,185,129,0.03)]"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Descargar CSV
                  </button>
                </div>
              )}
            </div>

            {/* ERROR STATE */}
            {error && (
              <div className="flex gap-3 items-center p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            {/* LOADING STATE */}
            {isPending && !aggregated && (
              <div className="flex h-64 flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <p className="text-sm text-zinc-400">Cargando y procesando información...</p>
              </div>
            )}

            {/* NO DATA STATE */}
            {!isPending && (!aggregated || aggregated.rows.length === 0) && !error && (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/5 py-12">
                <HelpCircle className="h-10 w-10 text-zinc-600" />
                <p className="text-sm font-bold text-zinc-400">No se encontraron registros</p>
                <p className="text-xs text-zinc-500 text-center max-w-[280px]">
                  Prueba ampliando el rango de fechas o seleccionando menos filtros dinámicos.
                </p>
              </div>
            )}

            {/* DATA RENDER: KPIs + TABLE */}
            {aggregated && aggregated.rows.length > 0 && !error && (
              <div className="space-y-6">
                {/* 1. KPIs Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {activeTab === 'produccion' && (
                    <>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Oro Recuperado</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">{aggregated.kpis.oroTotalGrams.toLocaleString()} g</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sacos Vaciados</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.sacosTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Toneladas</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.toneladasTotal.toLocaleString()} t</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tenor Promedio</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">{aggregated.kpis.tenorPromedioGpt.toFixed(2)} g/t</p>
                      </div>
                    </>
                  )}

                  {activeTab === 'nomina' && (
                    <>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Nómina</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">${aggregated.kpis.totalPagado.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Bono Transporte</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">${aggregated.kpis.bonoTransporteTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Trabajadores</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.trabajadoresUnicos}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Split Pedro/Dar/LaFe</p>
                        <p className="text-[11px] font-bold text-amber-400 mt-1">
                          ${aggregated.kpis.pedroTotal.toLocaleString()} / ${aggregated.kpis.darinelTotal.toLocaleString()} / ${aggregated.kpis.laFeTotal.toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'voladuras' && (
                    <>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Nro. Disparos</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">{aggregated.kpis.disparosCount}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Huecos</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.huecosTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Chupis</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.chupisTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Consumo Arroz</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">{aggregated.kpis.arrozKgTotal.toLocaleString()} kg</p>
                      </div>
                    </>
                  )}

                  {activeTab === 'quemado' && (
                    <>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Amalgama</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.amalgamaTotalG.toLocaleString()} g</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Oro Puro</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">{aggregated.kpis.oroTotalG.toLocaleString()} g</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Rendimiento</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">{aggregated.kpis.rendimientoOroPct.toFixed(2)}%</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Manto / Retorta</p>
                        <p className="text-xs font-bold text-zinc-300 mt-2">
                          M:{aggregated.kpis.mantoOroTotalG.toFixed(0)}g | R:{aggregated.kpis.retortaOroTotalG.toFixed(0)}g
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'extraccion' && (
                    <>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Reportes</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.reportesCount}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sacos Extraídos</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">{aggregated.kpis.sacosTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Eventos / Novedades</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.eventosTotal}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Promedio/Reporte</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">
                          {aggregated.kpis.reportesCount > 0 ? (aggregated.kpis.sacosTotal / aggregated.kpis.reportesCount).toFixed(0) : '0'}
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'gastos' && (
                    <>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Gastado</p>
                        <p className="text-xl font-extrabold text-red-500 mt-1">${aggregated.kpis.totalGastado.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Gasto Promedio</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">${aggregated.kpis.promedioGasto.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Nro. Transacciones</p>
                        <p className="text-xl font-extrabold text-zinc-300 mt-1">{aggregated.kpis.registrosCount}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Mayor Gasto Único</p>
                        <p className="text-[11px] font-extrabold text-red-400 mt-1.5 truncate" title={aggregated.kpis.mayorGastoDesc}>
                          ${aggregated.kpis.mayorGastoMonto.toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}

                  {activeTab === 'balance' && (
                    <>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ingreso Total</p>
                        <p className="text-xl font-extrabold text-emerald-500 mt-1">${aggregated.kpis.ingresoTotalUsd.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Gasto Total</p>
                        <p className="text-xl font-extrabold text-red-500 mt-1">${aggregated.kpis.gastoTotalUsd.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Utilidad Neta</p>
                        <p className="text-xl font-extrabold text-amber-500 mt-1">${aggregated.kpis.rentabilidadUsd.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Margen % / Costo g</p>
                        <p className="text-xs font-bold text-amber-400 mt-1.5">
                          {aggregated.kpis.margenRentabilidadPct.toFixed(1)}% | ${aggregated.kpis.costoPorGramoOro.toFixed(0)}/g
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Table Preview */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-zinc-950/20">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-zinc-400 font-bold">
                        <th className="p-3">Grupo / Periodo</th>
                        {activeTab === 'produccion' && (
                          <>
                            <th className="p-3 text-right">Sacos</th>
                            <th className="p-3 text-right">Toneladas</th>
                            <th className="p-3 text-right text-amber-400">Oro (g)</th>
                            <th className="p-3 text-right text-amber-400">Tenor (g/t)</th>
                            <th className="p-3 text-right">Merma %</th>
                          </>
                        )}
                        {activeTab === 'nomina' && (
                          <>
                            <th className="p-3 text-right">Cant. Personal</th>
                            <th className="p-3 text-right text-amber-400">Pago Nómina</th>
                            <th className="p-3 text-right">Bono Transporte</th>
                            <th className="p-3 text-right text-amber-500">Pedro</th>
                            <th className="p-3 text-right text-amber-500">Darinel</th>
                            <th className="p-3 text-right text-amber-500">La Fe</th>
                          </>
                        )}
                        {activeTab === 'voladuras' && (
                          <>
                            <th className="p-3 text-right">Disparos</th>
                            <th className="p-3 text-right">Huecos</th>
                            <th className="p-3 text-right">Pies Huecos</th>
                            <th className="p-3 text-right">Chupis</th>
                            <th className="p-3 text-right">Arroz (kg)</th>
                            <th className="p-3 text-right text-amber-400">Ratio H/C</th>
                          </>
                        )}
                        {activeTab === 'quemado' && (
                          <>
                            <th className="p-3 text-right">Procesos</th>
                            <th className="p-3 text-right">Amalgama (g)</th>
                            <th className="p-3 text-right text-amber-400">Oro Puro (g)</th>
                            <th className="p-3 text-right text-amber-400">Rendimiento %</th>
                            <th className="p-3 text-right">Nro Planchas</th>
                          </>
                        )}
                        {activeTab === 'extraccion' && (
                          <>
                            <th className="p-3 text-right">Reportes</th>
                            <th className="p-3 text-right text-amber-400">Sacos Extraídos</th>
                            <th className="p-3 text-right">Cant. Eventos</th>
                          </>
                        )}
                        {activeTab === 'gastos' && (
                          <>
                            <th className="p-3 text-right text-red-400">Total Gastado</th>
                            <th className="p-3 text-right">Gasto Promedio</th>
                            <th className="p-3 text-right text-red-300">Gasto Mayor</th>
                            <th className="p-3 text-right">Transacciones</th>
                          </>
                        )}
                        {activeTab === 'balance' && (
                          <>
                            <th className="p-3 text-right text-emerald-400">Ingresos Oro</th>
                            <th className="p-3 text-right text-emerald-400">Ingresos Arenas</th>
                            <th className="p-3 text-right text-emerald-500">Ingresos Total</th>
                            <th className="p-3 text-right text-red-400">Gasto Nómina</th>
                            <th className="p-3 text-right text-red-400">Gastos Ops</th>
                            <th className="p-3 text-right text-amber-400">Utilidad Neta</th>
                            <th className="p-3 text-right">Margen %</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {aggregated.rows.slice(0, 15).map((row: any, idx: number) => (
                        <tr
                          key={idx}
                          className="hover:bg-white/[0.01] transition-colors"
                        >
                          <td className="p-3 font-semibold text-white">{row.grupo}</td>
                          
                          {activeTab === 'produccion' && (
                            <>
                              <td className="p-3 text-right">{row.sacos.toLocaleString()}</td>
                              <td className="p-3 text-right">{row.toneladas.toLocaleString()} t</td>
                              <td className="p-3 text-right text-amber-400 font-semibold">{row.oroGramos.toLocaleString()} g</td>
                              <td className="p-3 text-right text-amber-400">{row.tenorGpt.toFixed(2)} g/t</td>
                              <td className="p-3 text-right text-zinc-400">{row.mermaPct.toFixed(2)}%</td>
                            </>
                          )}

                          {activeTab === 'nomina' && (
                            <>
                              <td className="p-3 text-right">{row.trabajadoresCount}</td>
                              <td className="p-3 text-right text-amber-400 font-semibold">${row.montoPagado.toLocaleString()}</td>
                              <td className="p-3 text-right">${row.bonoTransporte.toLocaleString()}</td>
                              <td className="p-3 text-right text-amber-400">${row.montoPedro.toLocaleString()}</td>
                              <td className="p-3 text-right text-amber-400">${row.montoDarinel.toLocaleString()}</td>
                              <td className="p-3 text-right text-amber-400">${row.montoLaFe.toLocaleString()}</td>
                            </>
                          )}

                          {activeTab === 'voladuras' && (
                            <>
                              <td className="p-3 text-right">{row.disparos}</td>
                              <td className="p-3 text-right">{row.huecos.toLocaleString()}</td>
                              <td className="p-3 text-right">{row.huecosPies.toLocaleString()} ft</td>
                              <td className="p-3 text-right">{row.chupis.toLocaleString()}</td>
                              <td className="p-3 text-right">{row.arrozKg.toLocaleString()} kg</td>
                              <td className="p-3 text-right text-amber-400 font-semibold">{row.ratioHC.toFixed(2)}</td>
                            </>
                          )}

                          {activeTab === 'quemado' && (
                            <>
                              <td className="p-3 text-right">{row.quemadas}</td>
                              <td className="p-3 text-right">{row.amalgamaG.toLocaleString()} g</td>
                              <td className="p-3 text-right text-amber-400 font-semibold">{row.oroG.toLocaleString()} g</td>
                              <td className="p-3 text-right text-amber-400">{row.rendimientoPct.toFixed(2)}%</td>
                              <td className="p-3 text-right">{row.planchasCount}</td>
                            </>
                          )}

                          {activeTab === 'extraccion' && (
                            <>
                              <td className="p-3 text-right">{row.reportes}</td>
                              <td className="p-3 text-right text-amber-400 font-semibold">{row.sacos.toLocaleString()} sacos</td>
                              <td className="p-3 text-right">{row.eventos}</td>
                            </>
                          )}

                          {activeTab === 'gastos' && (
                            <>
                              <td className="p-3 text-right text-red-400 font-semibold">${row.monto.toLocaleString()}</td>
                              <td className="p-3 text-right">${row.gastoPromedio.toLocaleString()}</td>
                              <td className="p-3 text-right text-red-300">${row.gastoMayor.toLocaleString()}</td>
                              <td className="p-3 text-right">{row.registrosCount}</td>
                            </>
                          )}

                          {activeTab === 'balance' && (
                            <>
                              <td className="p-3 text-right text-emerald-400">${row.ingresosOro.toLocaleString()}</td>
                              <td className="p-3 text-right text-emerald-400">${row.ingresosArenas.toLocaleString()}</td>
                              <td className="p-3 text-right text-emerald-500 font-semibold">${row.ingresosTotal.toLocaleString()}</td>
                              <td className="p-3 text-right text-red-400">${row.gastosNomina.toLocaleString()}</td>
                              <td className="p-3 text-right text-red-400">${row.gastosOperativos.toLocaleString()}</td>
                              <td className="p-3 text-right text-amber-400 font-semibold">${row.rentabilidad.toLocaleString()}</td>
                              <td className="p-3 text-right font-medium text-amber-500">{row.margenPct.toFixed(1)}%</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination indicator / preview notice */}
                {aggregated.rows.length > 15 && (
                  <p className="text-[11px] text-zinc-500 text-center italic">
                    Mostrando las primeras 15 agrupaciones. Descarga el reporte completo en PDF o CSV para ver las {aggregated.rows.length} filas totales.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
