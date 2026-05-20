'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { 
  Pickaxe, Upload, RefreshCw, Plus, Trash2, Loader2, Calendar, 
  Clock, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, 
  Search, Factory, Shield, Truck, Briefcase, Edit2, Receipt, 
  Printer, X, Users, Wallet
} from 'lucide-react';

import type { Personal, NominaSemana } from '@/lib/types';
import type { EmpleadoParseado } from '@/lib/parse-nomina-file';

import { 
  revertirSemanaAction,
  borrarTodoPersonalArea
} from '@/lib/actions/nomina';

import {
  upsertPersonalV2Action,
  procesarCierreNominaV2Action,
  updatePersonalEstatusAction
} from '@/lib/actions/nomina-v2';

// ── Helpers ────────────────────────────────────────────────────────────────────
function getWeekStart(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

function getWeekEnd(d = new Date()): string {
  const start = new Date(getWeekStart(d));
  start.setDate(start.getDate() + 6);
  return start.toISOString().split('T')[0];
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

interface NominaClientProps {
  data: Personal[];
  semanas: NominaSemana[];
  area: 'administracion' | 'mina' | 'planta' | 'seguridad' | 'transporte';
}

interface PreNominaRowState {
  personal: Personal;
  esSemanaLibre: boolean;
  bonoTransporte: number;
  bonificaciones: number;
  deducciones: number;
  total: number;
  estadoAsistencia: 'trabajada' | 'libre' | 'no_laborado';
}

const ICONS = {
  administracion: Briefcase,
  mina: Pickaxe,
  planta: Factory,
  seguridad: Shield,
  transporte: Truck,
};

const TITLES = {
  administracion: 'Nómina Administrativa',
  mina: 'Nómina Mina Belén',
  planta: 'Nómina Molino La Fé',
  seguridad: 'Nómina Seguridad',
  transporte: 'Nómina Transporte',
};

// Asignación de colores temáticos limpios y planos para cargos (sin neones exagerados)
function getCargoTheme(cargo: string): { bg: string; text: string; border: string } {
  const l = cargo.toLowerCase();
  if (l.includes('administrativo')) {
    return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' };
  } else if (l.includes('vertical 1') || l.includes('1pd')) {
    return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' };
  } else if (l.includes('vertical 2')) {
    return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
  } else if (l.includes('cocinera') || l.includes('nurbelis')) {
    return { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' };
  } else if (l.includes('compresor') || l.includes('tecnico')) {
    return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' };
  } else if (l.includes('grupo') || l.includes('mixto') || l.includes('molino')) {
    return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
  }
  return { bg: 'bg-zinc-800/10', text: 'text-zinc-400', border: 'border-zinc-700/20' };
}

export default function NominaClient({ data, semanas, area }: NominaClientProps) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [isPending, startTransition] = useTransition();

  // ── State ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'primario' | 'esquema'>('primario');
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showProcesarModal, setShowProcesarModal] = useState(false);
  const [showBorrarModal, setShowBorrarModal] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PreNominaRowState | null>(null);

  // Pre-Nómina Interactive State
  const [preNominaRows, setPreNominaRows] = useState<PreNominaRowState[]>([]);

  // Forms & Editing
  const [editItem, setEditItem] = useState<Personal | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    cedula: '',
    nombre_completo: '',
    cargo: '',
    area,
    area_detalle: '',
    salario_base: '',
    salario_libre: '',
    bono_transporte: '',
    telefono: '',
    notas: '',
    fecha_ingreso: new Date().toISOString().split('T')[0]
  });

  // Week config
  const [weekRange, setWeekRange] = useState({ inicio: getWeekStart(), fin: getWeekEnd() });
  
  // Processing messages
  const [procesadoOk, setProcesadoOk] = useState<string | null>(null);

  // Partner splits (Default 33.3% / 33.3% / 33.4% to Pedro, Darinel, La Fé)
  const [partnerSplits, setPartnerSplits] = useState({
    pctPedro: 33.33,
    pctDarinel: 33.33,
    pctLaFe: 33.34
  });

  // Import State
  const [importTab, setImportTab] = useState<'excel' | 'pdf'>('excel');
  const [parsedEmps, setParsedEmps] = useState<EmpleadoParseado[]>([]);
  const [importingState, setImportingState] = useState(false);
  const [importResult, setImportResult] = useState<{ nuevos: number; actualizados: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // ── Sync Live State with DB personal data ───────────────────────────────
  useEffect(() => {
    if (data) {
      const rows = data.map((p) => {
        return {
          personal: p,
          esSemanaLibre: false,
          bonoTransporte: 0, 
          bonificaciones: 0,
          deducciones: 0,
          total: Number(p.salario_base),
          estadoAsistencia: 'trabajada' as const,
        };
      });
      setPreNominaRows(rows);
    }
  }, [data]);

  // ── Live Calculation Engine ──────────────────────────────────────────────
  const handleUpdateRow = (personalId: string, fields: Partial<PreNominaRowState>) => {
    setPreNominaRows((prev) =>
      prev.map((row) => {
        if (row.personal.id !== personalId) return row;
        const nextRow = { ...row, ...fields };

        // 1. Determinar Salario Base según asistencia
        let baseSal = Number(nextRow.personal.salario_base);
        if (nextRow.estadoAsistencia === 'libre') {
          baseSal = Number(nextRow.personal.salario_libre) || 100; // default semana libre a $100 si no se guardó
        } else if (nextRow.estadoAsistencia === 'no_laborado') {
          baseSal = 0;
        }

        // 2. Determinar Bono de Transporte (Se activa por defecto si sale Libre, configurable)
        let transport = nextRow.bonoTransporte;
        if (fields.estadoAsistencia === 'libre') {
          transport = Number(nextRow.personal.bono_transporte) || 30; // default a $30
        } else if (fields.estadoAsistencia === 'trabajada') {
          transport = 0;
        }

        // 3. Sumar y restar componentes en tiempo real
        const total = baseSal + transport + nextRow.bonificaciones - nextRow.deducciones;

        return {
          ...nextRow,
          bonoTransporte: transport,
          esSemanaLibre: nextRow.estadoAsistencia === 'libre',
          total
        };
      })
    );
  };

  const totalSemana = useMemo(() => {
    return preNominaRows.reduce((s, r) => s + r.total, 0);
  }, [preNominaRows]);

  const semanaActual = semanas.find((r) => r.semana_inicio === getWeekStart());
  const semanaActualProcesada = !!semanaActual;

  const IconComponent = ICONS[area];
  const pageTitle = TITLES[area];

  // ── Filter and Group Rows by Cargo (Excel Essence) ──────────────────────
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return preNominaRows;
    return preNominaRows.filter(
      (row) =>
        row.personal.nombre_completo.toLowerCase().includes(q) ||
        (row.personal.cedula && row.personal.cedula.includes(q))
    );
  }, [preNominaRows, search]);

  const groupedRows = useMemo(() => {
    const groups: Record<string, PreNominaRowState[]> = {};
    filteredRows.forEach((row) => {
      const cargo = row.personal.cargo || 'General';
      if (!groups[cargo]) groups[cargo] = [];
      groups[cargo].push(row);
    });
    return groups;
  }, [filteredRows]);

  // ── Actions Handlers ───────────────────────────────────────────────────
  function openEdit(item: Personal) {
    setEditItem(item);
    setForm({
      cedula: item.cedula,
      nombre_completo: item.nombre_completo,
      cargo: item.cargo,
      area: item.area as typeof area,
      area_detalle: item.area_detalle || '',
      salario_base: String(item.salario_base),
      salario_libre: String(item.salario_libre || ''),
      bono_transporte: String(item.bono_transporte || ''),
      telefono: item.telefono || '',
      notas: item.notas || '',
      fecha_ingreso: item.fecha_ingreso || new Date().toISOString().split('T')[0]
    });
    setActiveTab('primario');
    setShowModal(true);
  }

  function resetForm() {
    setEditItem(null);
    setForm({
      cedula: '', nombre_completo: '', cargo: '', area, area_detalle: '',
      salario_base: '', salario_libre: '', bono_transporte: '', telefono: '', notas: '',
      fecha_ingreso: new Date().toISOString().split('T')[0]
    });
    setActiveTab('primario');
    setFormError(null);
  }

  function handleSave() {
    setFormError(null);
    startTransition(async () => {
      const payload = {
        id: editItem?.id,
        cedula: form.cedula,
        nombre_completo: form.nombre_completo,
        cargo: form.cargo,
        area,
        area_detalle: form.area_detalle || form.cargo,
        salario_base: Number(form.salario_base) || 0,
        salario_libre: Number(form.salario_libre) || 0,
        bono_transporte: Number(form.bono_transporte) || 0,
        telefono: form.telefono,
        notas: form.notas,
        fecha_ingreso: form.fecha_ingreso
      };
      
      const res = await upsertPersonalV2Action(payload);
      if (res.ok) {
        setShowModal(false);
        resetForm();
      } else {
        setFormError(res.message);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Desactivar este trabajador del sistema?')) return;
    startTransition(async () => {
      await updatePersonalEstatusAction(id, 'INACTIVO');
    });
  }

  function handleProcesarNomina() {
    if (preNominaRows.length === 0) return alert('No hay trabajadores activos.');
    if (semanaActual && !confirm(`La semana ya fue procesada. ¿Deseas sobreescribirla?`)) return;

    setProcesadoOk(null);
    startTransition(async () => {
      const formattedRows = preNominaRows.map(r => ({
        personal: r.personal,
        esSemanaLibre: r.esSemanaLibre,
        bonoTransporte: r.bonoTransporte,
        total: r.total
      }));

      const res = await procesarCierreNominaV2Action({
        userId: user?.id || '',
        area,
        inicio: weekRange.inicio,
        fin: weekRange.fin,
        rows: formattedRows,
        pctPedro: partnerSplits.pctPedro,
        pctDarinel: partnerSplits.pctDarinel,
        pctLaFe: partnerSplits.pctLaFe
      });

      if (res.ok) {
        setProcesadoOk(`✓ ${res.message}`);
        setShowProcesarModal(false);
      } else {
        alert(res.message);
      }
    });
  }

  function handleRevertirSemana(sem: NominaSemana) {
    if (!confirm(`⚠ ¿Revertir por completo la nómina procesada del ${fmtDate(sem.semana_inicio)} al ${fmtDate(sem.semana_fin)}?\nEsto eliminará los gastos asociados y las distribuciones de socios.`)) return;
    startTransition(async () => {
      const res = await revertirSemanaAction(sem);
      if (!res.ok) alert(sem.notas || 'Error al revertir');
    });
  }

  function handleBorrarTodo() {
    startTransition(async () => {
      const res = await borrarTodoPersonalArea(area);
      if (res.ok) setShowBorrarModal(false);
      else alert(res.message);
    });
  }

  // ── Import Logic (Visual Diff preview included) ───────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsedEmps([]);
    setImportingState(true);
    
    try {
      if (importTab === 'excel') {
        const { parseExcelNomina, detectWeekRangeFromExcel } = await import('@/lib/parse-nomina-file');
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
        const detected = detectWeekRangeFromExcel(wb);
        if (detected.inicio && detected.fin) setWeekRange({ inicio: detected.inicio, fin: detected.fin });
        
        const all = await parseExcelNomina(file);
        const emps = all.filter(e => e.area === area);
        if (emps.length === 0) setParseError(`No se detectaron empleados de ${area}.`);
        else setParsedEmps(emps);
      } else {
        const { parsePdfNomina, detectWeekRange } = await import('@/lib/parse-nomina-file');
        const pdfjsLib = await import('pdfjs-dist');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        let textForDetection = '';
        for (let pg = 1; pg <= Math.min(2, pdf.numPages); pg++) {
          const page = await pdf.getPage(pg);
          const content = await page.getTextContent();
          textForDetection += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
        }
        const detected = detectWeekRange(textForDetection);
        if (detected.inicio && detected.fin) setWeekRange({ inicio: detected.inicio, fin: detected.fin });
        
        const all = await parsePdfNomina(file);
        const emps = all.filter(e => e.area === area);
        if (emps.length === 0) setParseError(`No se detectaron empleados de ${area}.`);
        else setParsedEmps(emps);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error procesando archivo.');
    } finally {
      setImportingState(false);
      e.target.value = '';
    }
  }

  // Compara la importación contra la base de datos para mostrar el Diff
  const importDiffs = useMemo(() => {
    return parsedEmps.map(parsed => {
      const match = data.find(p => p.cedula === parsed.cedula);
      let status: 'nuevo' | 'cambio' | 'identico' = 'nuevo';
      let delta = 0;
      if (match) {
        status = Number(match.salario_base) === Number(parsed.salario_semanal) ? 'identico' : 'cambio';
        delta = Number(parsed.salario_semanal) - Number(match.salario_base);
      }
      return { parsed, status, oldSal: match?.salario_base, delta };
    });
  }, [parsedEmps, data]);

  function handleImportConfirm() {
    const valid = parsedEmps.filter(e => e._valid);
    if (valid.length === 0) return alert('No hay empleados válidos.');
    
    startTransition(async () => {
      const { importarPersonalAction } = await import('@/lib/actions/nomina');
      const res = await importarPersonalAction(valid, area);
      if (res.ok) {
        setImportResult(res.data);
      } else {
        alert(res.message);
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-[1750px] mx-auto h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col overflow-hidden">
      
      {/* Encabezado Principal */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <IconComponent className="w-6 h-6 text-amber-500" />
            {pageTitle}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Complejo Operativo · {data.length} Trabajadores Registrados
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            disabled={!canEdit}
            className="btn-secondary h-10 px-4 text-xs flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            <span>Importar Archivo</span>
          </button>
          {canEdit && data.length > 0 && (
            <button
              onClick={() => setShowBorrarModal(true)}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-red-400 font-bold h-10 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Dar de Baja Todo</span>
            </button>
          )}
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            disabled={!canEdit}
            className="bg-amber-600 hover:bg-amber-500 text-black font-bold h-10 px-5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-40 text-xs"
          >
            <Plus className="w-4 h-4" /> Registrar Trabajador
          </button>
        </div>
      </div>

      {/* Split Grid Layout de MineOS */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* PANEL IZQUIERDO: KPIs + Historial */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto lg:overflow-hidden pr-1 custom-scrollbar">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-3 flex-shrink-0">
            {/* Total Semanal */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Total Semanal Estimado</p>
              <p className="text-3xl font-black text-amber-400 leading-none">{fmtMoney(totalSemana)}</p>
              <p className="text-xs text-white/30 mt-2">Semana en curso</p>
            </div>

            {/* Personal Activo */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Personal Activo</p>
              <p className="text-3xl font-black text-white/80 leading-none">{data.length}</p>
              <p className="text-xs text-white/30 mt-2">Trabajadores registrados</p>
            </div>

            {/* Promedio por Minero */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Promedio por Trabajador</p>
              <p className="text-3xl font-black text-white/80 leading-none">
                {data.length > 0 ? fmtMoney(totalSemana / data.length) : '$0.00'}
              </p>
              <p className="text-xs text-white/30 mt-2">Por trabajador activo</p>
            </div>
          </div>

          {/* Historial de Cierres Pasados */}
          {semanas.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
              <button onClick={() => setShowHistorial(!showHistorial)} className="w-full flex justify-between px-4 py-3.5 hover:bg-white/[0.02] transition-colors border-b border-zinc-850 flex-shrink-0">
                <div className="flex items-center gap-2.5 text-xs font-bold text-white/50 uppercase tracking-widest">
                  <Clock className="w-4 h-4 text-amber-500" /> Historial de Cierres
                </div>
                {showHistorial ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
              </button>
              {showHistorial && (
                <div className="p-3 bg-zinc-900/30 overflow-y-auto flex-1 flex flex-col gap-2.5 custom-scrollbar">
                  {semanas.map(sem => (
                    <div key={sem.id} className="bg-zinc-950/40 border border-zinc-850 rounded-lg p-3.5 flex flex-col justify-between gap-3 hover:border-zinc-800 transition-colors">
                      <div>
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-bold text-white/90">{fmtDate(sem.semana_inicio)} a {fmtDate(sem.semana_fin)}</p>
                          <span className="text-[8px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">Procesado</span>
                        </div>
                        <p className="text-[10px] text-white/40 mt-1">{sem.total_trabajadores} trabajadores registrados</p>
                      </div>
                      <div className="flex justify-between items-center pt-2.5 border-t border-zinc-800/40">
                        <p className="text-sm font-bold text-amber-500">{fmtMoney(Number(sem.total_pagado))}</p>
                        {canEdit && (
                          <button onClick={() => handleRevertirSemana(sem)} disabled={isPending} className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider">Revertir</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* PANEL DERECHO: Tabla Grupal e Inputs */}
        <div className="lg:col-span-9 flex flex-col gap-5 overflow-y-auto pr-1 custom-scrollbar min-h-0">
          
          {/* Banner de Estado Nómina */}
          {semanaActualProcesada ? (
            <div className="flex items-center gap-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-5 py-4 flex-shrink-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-400">Nómina Cerrada y Registrada</p>
                <p className="text-xs text-white/50 mt-1">
                  Periodo: {fmtDate(semanaActual.semana_inicio)} al {fmtDate(semanaActual.semana_fin)}  ·  {semanaActual.total_trabajadores} trabajadores  ·  Total: {fmtMoney(Number(semanaActual.total_pagado))}
                </p>
              </div>
              <button
                onClick={() => handleRevertirSemana(semanaActual)}
                disabled={!canEdit || isPending}
                className="h-9 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-40"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Revertir Nómina
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex-shrink-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-500">Nómina de la Semana Pendiente</p>
                    <p className="text-xs text-white/50 mt-1">
                      Semana del {fmtDate(getWeekStart())} al {fmtDate(getWeekEnd())}  ·  {data.length} trabajadores activos  ·  Estimado: <span className="font-bold text-amber-400">{fmtMoney(totalSemana)}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setWeekRange({ inicio: getWeekStart(), fin: getWeekEnd() }); setShowProcesarModal(true); }}
                  disabled={!canEdit || data.length === 0}
                  className="bg-amber-600 hover:bg-amber-500 text-black font-bold h-10 px-5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-40 shrink-0 text-xs"
                >
                  <Wallet className="w-4 h-4" /> Cerrar y Distribuir Caja
                </button>
              </div>
              {procesadoOk && <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-bold"><CheckCircle2 className="w-3.5 h-3.5" />{procesadoOk}</div>}
            </div>
          )}

          {/* Buscador de Sistema */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre o número de cédula..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent border-0 text-sm text-white/90 placeholder-white/30 outline-none"
            />
          </div>

          {/* Lista de Tablas Agrupadas por Cargo (Esencia de las Hojas de Proceso) */}
          <div className="flex flex-col gap-6 pb-8">
            {Object.keys(groupedRows).length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center shadow-sm">
                <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/40">No hay trabajadores registrados o coincidentes en esta área.</p>
              </div>
            ) : (
              Object.entries(groupedRows).map(([cargoName, rows]) => {
                const theme = getCargoTheme(cargoName);
                return (
                  <div key={cargoName} className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    
                    {/* Encabezado del Grupo (Cargos del Excel) */}
                    <div className="px-5 py-3.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme.bg} ${theme.text} border ${theme.border}`}>
                          {cargoName}
                        </div>
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{rows.length} Trabajadores</span>
                      </div>
                      <span className="text-sm font-semibold text-amber-500">
                        Subtotal: {fmtMoney(rows.reduce((s, r) => s + r.total, 0))}
                      </span>
                    </div>

                    {/* Lista de trabajadores */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                            <th className="px-5 py-3">Trabajador / Identificación</th>
                            <th className="px-5 py-3 text-center">Estado Asistencia</th>
                            <th className="px-5 py-3 text-right">Sueldo Base</th>
                            <th className="px-5 py-3 text-right">Bono Trans.</th>
                            <th className="px-5 py-3 text-right">Bonos / Extras</th>
                            <th className="px-5 py-3 text-right">Vales / Adelantos</th>
                            <th className="px-5 py-3 text-right text-amber-500">Total Neto</th>
                            <th className="px-5 py-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-850/40">
                          {rows.map((row) => {
                            const p = row.personal;
                            return (
                              <tr key={p.id} className="border-b border-zinc-850/20 hover:bg-zinc-800/20 transition-colors">
                                
                                {/* Nombre e Info */}
                                <td className="px-5 py-3.5">
                                  <div className="font-semibold text-white/90 text-sm leading-snug">{p.nombre_completo}</div>
                                  <div className="text-[10px] text-white/40 mt-1 flex items-center gap-2 flex-wrap">
                                    <span>C.I. {p.cedula}</span>
                                    <span>·</span>
                                    <span>Ingreso: {fmtDate(p.fecha_ingreso)}</span>
                                    {p.telefono && (
                                      <>
                                        <span>·</span>
                                        <span>Telf: {p.telefono}</span>
                                      </>
                                    )}
                                  </div>
                                </td>

                                {/* Toggles Asistencia (Labor vs Libre vs Absent) */}
                                <td className="px-5 py-3.5 text-center">
                                  <div className="inline-flex p-1 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
                                    <button
                                      onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'trabajada' })}
                                      className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                                        row.estadoAsistencia === 'trabajada'
                                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-md shadow-amber-500/5'
                                          : 'border-transparent text-white/40 hover:text-white/70'
                                      }`}
                                    >
                                      🛠 Labor
                                    </button>
                                    <button
                                      onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'libre' })}
                                      className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                                        row.estadoAsistencia === 'libre'
                                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-md shadow-cyan-500/5'
                                          : 'border-transparent text-white/40 hover:text-white/70'
                                      }`}
                                    >
                                      🏖 Libre
                                    </button>
                                    <button
                                      onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'no_laborado' })}
                                      className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                                        row.estadoAsistencia === 'no_laborado'
                                          ? 'bg-red-500/10 text-red-400 border-red-500/30 shadow-md shadow-red-500/5'
                                          : 'border-transparent text-white/40 hover:text-white/70'
                                      }`}
                                    >
                                      ❌ Falta
                                    </button>
                                  </div>
                                </td>

                                {/* Sueldo Base */}
                                <td className="px-5 py-3.5 text-right font-sans tabular-nums text-xs text-white/80">
                                  {row.estadoAsistencia === 'trabajada' && fmtMoney(Number(p.salario_base))}
                                  {row.estadoAsistencia === 'libre' && fmtMoney(Number(p.salario_libre) || 100)}
                                  {row.estadoAsistencia === 'no_laborado' && fmtMoney(0)}
                                </td>

                                {/* Bono Transporte */}
                                <td className="px-5 py-3.5 text-right">
                                  <input
                                    type="number"
                                    value={row.bonoTransporte || ''}
                                    onChange={e => handleUpdateRow(p.id, { bonoTransporte: Number(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50"
                                  />
                                </td>

                                {/* Bonificaciones */}
                                <td className="px-5 py-3.5 text-right">
                                  <input
                                    type="number"
                                    value={row.bonificaciones || ''}
                                    onChange={e => handleUpdateRow(p.id, { bonificaciones: Number(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50"
                                  />
                                </td>

                                {/* Deducciones / Vales */}
                                <td className="px-5 py-3.5 text-right">
                                  <input
                                    type="number"
                                    value={row.deducciones || ''}
                                    onChange={e => handleUpdateRow(p.id, { deducciones: Number(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-red-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-red-500/50"
                                  />
                                </td>

                                {/* Total Neto */}
                                <td className="px-5 py-3.5 text-right font-semibold text-amber-500 text-xs tabular-nums">
                                  {fmtMoney(row.total)}
                                </td>

                                {/* Acciones */}
                                <td className="px-5 py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => setSelectedReceipt(row)}
                                      title="Generar Ficha de Pago"
                                      className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white transition-colors"
                                    >
                                      <Receipt className="w-4 h-4" />
                                    </button>
                                    {canEdit && (
                                      <>
                                        <button
                                          onClick={() => openEdit(p)}
                                          title="Editar Registro"
                                          className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-amber-500 transition-colors"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDelete(p.id)}
                                          title="Dar de Baja"
                                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

      {/* ── MODALS (Responsive centered layout with backdrop-blur) ── */}

      {/* 1. Modal: Agregar/Editar Trabajador */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="relative w-full sm:max-w-xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[92dvh] overflow-y-auto text-white"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white/90 tracking-wide mb-6">{editItem ? 'Editar Trabajador' : 'Registrar Nuevo Trabajador'}</h3>
            
            {formError && <p className="text-red-400 text-xs mb-4 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 font-sans">{formError}</p>}
            
            {/* Tabs */}
            <div className="flex border-b border-zinc-800 mb-5">
              <button
                onClick={() => setActiveTab('primario')}
                className={`pb-2.5 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
                  activeTab === 'primario' ? 'border-amber-500 text-amber-500' : 'border-transparent text-white/45'
                }`}
              >
                1. Datos Primarios
              </button>
              <button
                onClick={() => setActiveTab('esquema')}
                className={`pb-2.5 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
                  activeTab === 'esquema' ? 'border-amber-500 text-amber-500' : 'border-transparent text-white/45'
                }`}
              >
                2. Esquema Laboral & Notas
              </button>
            </div>

            <div className="space-y-4">
              {activeTab === 'primario' ? (
                <>
                  <div className="space-y-1">
                    <label className="input-label">Nombre Completo</label>
                    <input type="text" placeholder="Ej: Márquez Pedro" value={form.nombre_completo} onChange={e => setForm({...form, nombre_completo: e.target.value})} className="input-field" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="input-label">Cédula de Identidad</label>
                      <input type="text" placeholder="Ej: 9933498" value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} className="input-field" />
                    </div>
                    <div className="space-y-1">
                      <label className="input-label">Cargo / Grupo</label>
                      <input type="text" placeholder="Ej: Vertical 1PD" value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} className="input-field" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="input-label">Salario de Labor Semanal ($ USD)</label>
                    <input type="number" placeholder="Ej: 150.00" value={form.salario_base} onChange={e => setForm({...form, salario_base: e.target.value})} className="input-field" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="input-label">Sueldo Semana Libre ($)</label>
                      <input type="number" placeholder="Ej: 100.00" value={form.salario_libre} onChange={e => setForm({...form, salario_libre: e.target.value})} className="input-field" />
                    </div>
                    <div className="space-y-1">
                      <label className="input-label">Bono Transporte ($)</label>
                      <input type="number" placeholder="Ej: 30.00" value={form.bono_transporte} onChange={e => setForm({...form, bono_transporte: e.target.value})} className="input-field" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="input-label">Teléfono de Contacto</label>
                      <input type="text" placeholder="Ej: 0414-1234567" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="input-field" />
                    </div>
                    <div className="space-y-1">
                      <label className="input-label">Fecha de Ingreso</label>
                      <input type="date" value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} className="input-field" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="input-label">Notas / Observación</label>
                    <textarea placeholder="Ej: Trabaja como martillero..." value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input-field h-20 resize-none text-xs" />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={isPending} className="btn-primary min-w-[110px] justify-center">{isPending ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Cierre Financiero (Pedro, Darinel, La Fé) */}
      {showProcesarModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowProcesarModal(false)}
        >
          <div 
            className="relative w-full sm:max-w-md bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[92dvh] overflow-y-auto text-white"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setShowProcesarModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-white/90 tracking-wide mb-2 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-500" /> Consola de Cierre y Socios
            </h3>
            <p className="text-xs text-white/40 mb-6 uppercase tracking-wider">Confirmación del rango de nómina semanal</p>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1">
                <label className="input-label">Semana Inicio</label>
                <input type="date" value={weekRange.inicio} onChange={e => setWeekRange({...weekRange, inicio: e.target.value})} className="input-field" />
              </div>
              <span className="text-white/40 self-end mb-3">a</span>
              <div className="flex-1">
                <label className="input-label">Semana Fin</label>
                <input type="date" value={weekRange.fin} onChange={e => setWeekRange({...weekRange, fin: e.target.value})} className="input-field" />
              </div>
            </div>

            {/* Total Neto */}
            <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-6">
              <p className="text-xs text-amber-200 tracking-wider">TOTAL NETO DE NÓMINA A PAGAR</p>
              <p className="text-3xl font-black text-amber-500 mt-1 leading-none">{fmtMoney(totalSemana)}</p>
              <p className="text-[10px] text-amber-500/60 mt-2 uppercase">{preNominaRows.length} trabajadores registrados</p>
            </div>

            {/* Aportes de Socios */}
            <div className="space-y-4 mb-6">
              <h4 className="text-[10px] text-white/40 tracking-wider uppercase border-b border-zinc-800 pb-2">Distribución de Caja por Socios (1/3 c/u)</h4>
              
              {/* Pedro */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-cyan-500 rounded-full" />
                  <div>
                    <p className="text-xs font-semibold text-white/95">Pedro Guajiro (Socio)</p>
                    <p className="text-[10px] text-white/40 mt-0.5">Porcentaje: {partnerSplits.pctPedro}%</p>
                  </div>
                </div>
                <p className="text-base font-semibold text-cyan-400 tabular-nums">
                  {fmtMoney((partnerSplits.pctPedro / 100) * totalSemana)}
                </p>
              </div>

              {/* Darinel */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-yellow-500 rounded-full" />
                  <div>
                    <p className="text-xs font-semibold text-white/95">Darinel Riasco (Socio)</p>
                    <p className="text-[10px] text-white/40 mt-0.5">Porcentaje: {partnerSplits.pctDarinel}%</p>
                  </div>
                </div>
                <p className="text-base font-semibold text-yellow-500 tabular-nums">
                  {fmtMoney((partnerSplits.pctDarinel / 100) * totalSemana)}
                </p>
              </div>

              {/* La Fé */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                  <div>
                    <p className="text-xs font-semibold text-white/95">Molinos La Fé (Caja)</p>
                    <p className="text-[10px] text-white/40 mt-0.5">Porcentaje: {partnerSplits.pctLaFe}%</p>
                  </div>
                </div>
                <p className="text-base font-semibold text-emerald-500 tabular-nums">
                  {fmtMoney((partnerSplits.pctLaFe / 100) * totalSemana)}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => setShowProcesarModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleProcesarNomina} disabled={isPending} className="btn-primary min-w-[110px] justify-center">{isPending ? 'Procesando...' : 'Confirmar Cierre'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Importar Nómina con Diff Grid */}
      {showImport && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => { setShowImport(false); setParsedEmps([]); setImportResult(null); }}
        >
          <div 
            className="relative w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[88dvh] overflow-y-auto text-white"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => { setShowImport(false); setParsedEmps([]); setImportResult(null); }} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white/90 tracking-wide mb-6">Importar Nómina</h3>
            
            {!parsedEmps.length ? (
              <div className="space-y-4">
                <div className="flex gap-2 mb-4 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
                  <button 
                    onClick={() => setImportTab('excel')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      importTab === 'excel' 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                        : 'text-white/40 border border-transparent hover:text-white/70 hover:bg-white/[0.05]'
                    }`}
                  >
                    Excel (.xlsx)
                  </button>
                  <button 
                    onClick={() => setImportTab('pdf')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      importTab === 'pdf' 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                        : 'text-white/40 border border-transparent hover:text-white/70 hover:bg-white/[0.05]'
                    }`}
                  >
                    PDF de Nómina
                  </button>
                </div>
                <div className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-zinc-900/10 rounded-xl p-10 text-center relative transition-all group">
                  <input type="file" accept={importTab === 'excel' ? '.xlsx,.xls' : '.pdf'} onChange={handleFile} disabled={importingState} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  {importingState ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                      <span className="text-white/60 text-sm font-semibold tracking-wide uppercase">Parseando archivo y detectando fechas...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="w-10 h-10 text-zinc-650 group-hover:text-amber-500 transition-colors" />
                      <span className="text-white/60 text-sm font-semibold">Arrastra tu reporte de nómina aquí o haz clic para subir</span>
                      <span className="text-white/20 text-xs mt-1">Soporta formatos estructurados de Mina Belén y Molinos</span>
                    </div>
                  )}
                </div>
                {parseError && <p className="text-red-400 text-xs bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 font-sans">{parseError}</p>}
                <button onClick={() => setShowImport(false)} className="btn-secondary w-full mt-4 flex justify-center text-xs font-bold uppercase py-3">Cerrar Ventana</button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-white/50 mb-4 tracking-wider uppercase">Se han detectado {parsedEmps.length} trabajadores en el reporte de <strong className="text-amber-500">{area.toUpperCase()}</strong>.</p>
                
                {/* Visual Diff Grid */}
                <div className="max-h-64 overflow-y-auto border border-zinc-800 rounded-xl mb-4 bg-zinc-950/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-900 sticky top-0 border-b border-zinc-800 z-10 text-[10px] text-white/40 uppercase tracking-widest">
                      <tr>
                        <th className="p-3">Nombre Completo</th>
                        <th className="p-3">Cédula</th>
                        <th className="p-3">Cargo Detectado</th>
                        <th className="p-3 text-right">Sueldo Archivo</th>
                        <th className="p-3 text-center">Estado Auditoría</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/30 text-white/80">
                      {importDiffs.map((diff, i) => (
                        <tr key={i} className="hover:bg-white/[0.01]">
                          <td className="p-3 font-semibold">{diff.parsed.nombre_completo}</td>
                          <td className="p-3 text-white/40">{diff.parsed.cedula}</td>
                          <td className="p-3 text-white/50">{diff.parsed.cargo}</td>
                          <td className="p-3 text-right text-amber-500 font-bold tabular-nums">{fmtMoney(diff.parsed.salario_semanal)}</td>
                          <td className="p-3 text-center">
                            {diff.status === 'nuevo' && (
                              <span className="px-2 py-0.5 text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold rounded uppercase">NUEVO</span>
                            )}
                            {diff.status === 'cambio' && (
                              <span className="px-2 py-0.5 text-[8px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold rounded uppercase tabular-nums">
                                AJUSTE: ({diff.delta > 0 ? '+' : ''}{diff.delta})
                              </span>
                            )}
                            {diff.status === 'identico' && (
                              <span className="px-2 py-0.5 text-[8px] bg-zinc-850 text-zinc-400 border border-zinc-850 font-bold rounded uppercase">SIN CAMBIOS</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importResult ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-emerald-300 font-semibold uppercase tracking-widest text-xs">¡Importación Exitosa!</p>
                    <p className="text-[10px] text-emerald-400/70 mt-1">{importResult.nuevos} nuevos trabajadores registrados, {importResult.actualizados} perfiles actualizados.</p>
                  </div>
                ) : null}

                <div className="flex gap-3 mt-4">
                  <button onClick={() => { setParsedEmps([]); setImportResult(null); }} className="btn-secondary flex-1 flex justify-center text-xs font-bold py-2.5">Cargar Otro Archivo</button>
                  {!importResult && <button onClick={handleImportConfirm} disabled={isPending} className="btn-primary flex-1 flex justify-center text-xs font-bold py-2.5">{isPending ? 'IMPORTANDO...' : 'CONFIRMAR E IMPORTAR'}</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Modal: Borrar todo */}
      {showBorrarModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowBorrarModal(false)}
        >
          <div 
            className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl relative text-white"
            onClick={e => e.stopPropagation()}
          >
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-white tracking-wide mb-2">¿DAR DE BAJA A TODO EL PERSONAL?</h3>
            <p className="text-xs text-white/50 mb-6 leading-relaxed">Esta acción desactivará por completo a los {data.length} trabajadores de {area.toUpperCase()}. Se conservarán sus registros históricos de pago.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBorrarModal(false)} className="btn-secondary flex-1 py-2.5 rounded-lg text-xs font-bold">Cancelar</button>
              <button onClick={handleBorrarTodo} disabled={isPending} className="bg-red-600 hover:bg-red-500 text-white font-bold h-10 px-4 rounded-lg flex-1 flex items-center justify-center transition-colors disabled:opacity-40 text-xs">{isPending ? 'DESACTIVANDO...' : 'DAR DE BAJA'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Ficha / Comprobante de Pago Digital (Recibo) */}
      {selectedReceipt && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setSelectedReceipt(null)}
        >
          
          {/* Estilos para impresión nativa */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #printable-receipt-card, #printable-receipt-card * {
                visibility: visible;
              }
              #printable-receipt-card {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                color: black !important;
                background: white !important;
                border: 0 !important;
                box-shadow: none !important;
              }
              #receipt-buttons-bar {
                display: none !important;
              }
              #printable-receipt-card button {
                display: none !important;
              }
              #printable-receipt-card * {
                color: black !important;
              }
            }
          `}</style>

          <div 
            id="printable-receipt-card" 
            className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white"
            onClick={e => e.stopPropagation()}
          >
            
            {/* Cabecera del Voucher */}
            <div className="text-center pb-4 border-b border-dashed border-white/10">
              <h2 className="text-sm font-bold tracking-wider uppercase">MOLINOS LA FÉ - MINA BELÉN</h2>
              <p className="text-[9px] text-white/35 tracking-widest uppercase mt-0.5">COMPLEJO OPERATIVO EL CALLAO, BOLÍVAR</p>
              <p className="text-[10px] text-amber-500 font-bold tracking-wider mt-2 uppercase">VOUCHER DE NÓMINA SEMANAL</p>
            </div>

            {/* Detalles del Trabajador */}
            <div className="py-4 space-y-2 border-b border-dashed border-white/10 text-xs font-sans">
              <div className="flex justify-between"><span className="text-white/40">Trabajador:</span><span className="font-bold text-white/95">{selectedReceipt.personal.nombre_completo}</span></div>
              <div className="flex justify-between"><span className="text-white/40">C.I. Trabajador:</span><span className="text-white/95 font-medium">{selectedReceipt.personal.cedula}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Cargo / Labor:</span><span className="text-white/95 font-medium">{selectedReceipt.personal.cargo}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Periodo:</span><span className="text-white/95 font-medium">{fmtDate(weekRange.inicio)} al {fmtDate(weekRange.fin)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Estado Asistencia:</span><span className="font-bold text-amber-500 uppercase tracking-wider">{selectedReceipt.estadoAsistencia}</span></div>
            </div>

            {/* Desglose de Pago */}
            <div className="py-4 space-y-2 border-b border-dashed border-white/10 text-xs font-sans">
              <div className="flex justify-between">
                <span className="text-white/40">
                  {selectedReceipt.estadoAsistencia === 'libre' ? 'Sueldo Semana Libre:' : 'Sueldo Semana Labor:'}
                </span>
                <span className="text-white/95 font-semibold tabular-nums">
                  {selectedReceipt.estadoAsistencia === 'trabajada' && fmtMoney(Number(selectedReceipt.personal.salario_base))}
                  {selectedReceipt.estadoAsistencia === 'libre' && fmtMoney(Number(selectedReceipt.personal.salario_libre) || 100)}
                  {selectedReceipt.estadoAsistencia === 'no_laborado' && fmtMoney(0)}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-white/40">Bono Transporte:</span><span className="text-emerald-400 font-semibold tabular-nums">+{fmtMoney(selectedReceipt.bonoTransporte)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Incentivos / Bonos Extras:</span><span className="text-emerald-400 font-semibold tabular-nums">+{fmtMoney(selectedReceipt.bonificaciones)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Adelantos / Vales Semanal:</span><span className="text-red-400 font-semibold tabular-nums">-{fmtMoney(selectedReceipt.deducciones)}</span></div>
            </div>

            {/* Total Neto */}
            <div className="py-4 flex justify-between items-center text-sm font-sans border-b border-dashed border-white/10">
              <span className="font-bold text-white/50 tracking-wider">TOTAL NETO PAGADO:</span>
              <span className="text-xl font-black text-amber-500 tabular-nums">{fmtMoney(selectedReceipt.total)}</span>
            </div>

            {/* Área de Firmas */}
            <div className="grid grid-cols-2 gap-6 pt-6 pb-2 text-[8px] uppercase tracking-widest text-center text-white/35">
              <div className="border-t border-white/10 pt-4 flex flex-col gap-1">
                <span>Pedro G. / Darinel R.</span>
                <span>ADMINISTRACIÓN SOCIOS</span>
              </div>
              <div className="border-t border-white/10 pt-4 flex flex-col gap-1">
                <span>{selectedReceipt.personal.nombre_completo.split(' ')[1] || 'Trabajador'}</span>
                <span>FIRMA CONFORME RECIBIDO</span>
              </div>
            </div>

            {/* Botones de Control del Voucher */}
            <div id="receipt-buttons-bar" className="flex gap-2 mt-6">
              <button onClick={() => setSelectedReceipt(null)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-xs font-bold"><X className="w-3.5 h-3.5" /> Cerrar</button>
              <button onClick={() => window.print()} className="btn-primary flex-1 flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg text-xs font-bold"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
