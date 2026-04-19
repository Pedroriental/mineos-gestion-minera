'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  DragEvent,
  ChangeEvent,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import {
  Users,
  Plus,
  Search,
  X,
  Loader2,
  Edit2,
  Trash2,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Calendar,
  DollarSign,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import type { Personal, NominaSemana } from '@/lib/types';
import type { EmpleadoParseado, WeekRange } from '@/lib/parse-nomina-file';
import EmptyState from '@/components/EmptyState';

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

const AREA_LABELS: Record<string, string> = {
  mina: 'Mina',
  planta: 'Planta',
  administracion: 'Admin',
  seguridad: 'Seguridad',
  transporte: 'Transporte',
};

const AREA_OPTIONS: Personal['area'][] = [
  'mina',
  'planta',
  'administracion',
  'seguridad',
  'transporte',
];

// ── DropZone ────────────────────────────────────────────────────────────────────
function DropZone({
  accept,
  label,
  onFile,
  disabled,
}: {
  accept: string;
  label: string;
  onFile: (f: File) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-3 w-full h-36 rounded-xl border-2 border-dashed
        transition-all cursor-pointer select-none
        ${dragging ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 hover:bg-zinc-900'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <Upload className="w-7 h-7 text-zinc-500" />
      <p className="text-sm text-zinc-400 text-center px-4">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}

// ── Preview editable ────────────────────────────────────────────────────────────
function PreviewTable({
  employees,
  onChange,
}: {
  employees: EmpleadoParseado[];
  onChange: (updated: EmpleadoParseado[]) => void;
}) {
  const update = (idx: number, field: keyof EmpleadoParseado, value: string | number) => {
    const next = employees.map((e, i) => {
      if (i !== idx) return e;
      const updated = { ...e, [field]: value };
      updated._valid = !!updated.cedula && !!updated.nombre_completo && updated.salario_semanal > 0;
      updated._error = !updated.cedula ? 'Sin cédula' : !updated.nombre_completo ? 'Sin nombre' : updated.salario_semanal <= 0 ? 'Salario inválido' : undefined;
      return updated;
    });
    onChange(next);
  };
  const remove = (idx: number) => onChange(employees.filter((_, i) => i !== idx));

  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border border-zinc-800">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-zinc-950 z-10">
          <tr className="border-b border-zinc-800">
            <th className="text-left px-3 py-2 text-white/40 font-medium">Nombre</th>
            <th className="text-left px-3 py-2 text-white/40 font-medium">Cédula</th>
            <th className="text-left px-3 py-2 text-white/40 font-medium">Cargo</th>
            <th className="text-left px-3 py-2 text-white/40 font-medium">Área</th>
            <th className="text-right px-3 py-2 text-white/40 font-medium">Salario/sem</th>
            <th className="px-2 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => (
            <tr key={i} className={`border-b border-zinc-800/50 hover:bg-zinc-900/40 ${!emp._valid ? 'bg-amber-500/5' : ''}`}>
              <td className="px-3 py-1.5">
                <input value={emp.nombre_completo} onChange={(e) => update(i, 'nombre_completo', e.target.value)} className="bg-transparent text-white/80 w-full outline-none focus:text-white border-b border-transparent focus:border-amber-400 transition-colors min-w-[130px]" />
              </td>
              <td className="px-3 py-1.5">
                <input value={emp.cedula} onChange={(e) => update(i, 'cedula', e.target.value.replace(/\D/g, ''))} className={`bg-transparent w-full outline-none border-b border-transparent focus:border-amber-400 transition-colors font-mono text-xs min-w-[80px] ${!emp.cedula ? 'text-amber-400' : 'text-white/60'}`} placeholder="—" />
              </td>
              <td className="px-3 py-1.5">
                <input value={emp.cargo} onChange={(e) => update(i, 'cargo', e.target.value)} className="bg-transparent text-white/60 w-full outline-none border-b border-transparent focus:border-amber-400 transition-colors min-w-[100px]" />
              </td>
              <td className="px-3 py-1.5">
                <select value={emp.area} onChange={(e) => update(i, 'area', e.target.value as Personal['area'])} className="bg-zinc-900 border border-zinc-700 text-white/70 rounded-lg px-2 py-0.5 text-xs outline-none focus:border-amber-400">
                  {AREA_OPTIONS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
                </select>
              </td>
              <td className="px-3 py-1.5 text-right">
                <input type="number" value={emp.salario_semanal} step="0.01" min="0" onChange={(e) => update(i, 'salario_semanal', parseFloat(e.target.value) || 0)} className="bg-transparent text-amber-400 font-semibold w-full text-right outline-none border-b border-transparent focus:border-amber-400 transition-colors min-w-[70px]" />
              </td>
              <td className="px-2 py-1.5">
                <button onClick={() => remove(i)} className="p-0.5 text-white/20 hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Selector de semana inline ────────────────────────────────────────────────────
function WeekPicker({
  value,
  onChange,
  label,
}: {
  value: { inicio: string; fin: string };
  onChange: (v: { inicio: string; fin: string }) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <p className="text-xs text-white/50 font-medium uppercase tracking-wider">{label}</p>}
      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5">
        <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="flex items-center gap-2 flex-1">
          <input
            type="date"
            value={value.inicio}
            onChange={(e) => onChange({ ...value, inicio: e.target.value })}
            className="bg-transparent text-white/80 text-sm outline-none flex-1 min-w-0"
          />
          <span className="text-white/30 text-xs shrink-0">→</span>
          <input
            type="date"
            value={value.fin}
            onChange={(e) => onChange({ ...value, fin: e.target.value })}
            className="bg-transparent text-white/80 text-sm outline-none flex-1 min-w-0"
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function NominaPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();

  // ── Workers state ────────────────────────────────────────────────────────
  const [data, setData] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Personal | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    cedula: '',
    nombre_completo: '',
    cargo: '',
    area: 'mina' as Personal['area'],
    salario_base: '',
    telefono: '',
    notas: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
  });

  // ── Semanas state ────────────────────────────────────────────────────────
  const [todasSemanas, setTodasSemanas] = useState<NominaSemana[]>([]);
  const [semanaActual, setSemanaActual] = useState<NominaSemana | null | undefined>(undefined);
  const [showHistorial, setShowHistorial] = useState(false);
  const [revertiendoId, setRevertiendoId] = useState<string | null>(null);

  // ── Procesar modal state ─────────────────────────────────────────────────
  const [showProcesarModal, setShowProcesarModal] = useState(false);
  const [weekRange, setWeekRange] = useState<{ inicio: string; fin: string }>({
    inicio: getWeekStart(),
    fin: getWeekEnd(),
  });
  const [procesando, setProcesando] = useState(false);
  const [procesadoOk, setProcesadoOk] = useState<string | null>(null);

  // ── Import state ─────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<'excel' | 'pdf'>('excel');
  const [parsedEmps, setParsedEmps] = useState<EmpleadoParseado[]>([]);
  const [detectedWeek, setDetectedWeek] = useState<WeekRange>({ inicio: null, fin: null });
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ nuevos: number; actualizados: number } | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const { data: rows } = await supabase.from('personal').select('*').eq('activo', true).order('nombre_completo');
    setData(rows || []);
    setLoading(false);
  }, []);

  const loadTodasSemanas = useCallback(async () => {
    const { data: rows } = await supabase
      .from('nomina_semanas')
      .select('*')
      .order('semana_inicio', { ascending: false });
    const lista = rows || [];
    setTodasSemanas(lista);

    const inicio = getWeekStart();
    const current = lista.find((r) => r.semana_inicio === inicio) ?? null;
    setSemanaActual(current);
  }, []);

  useEffect(() => {
    loadData();
    loadTodasSemanas();
  }, [loadData, loadTodasSemanas]);

  // ── Worker CRUD ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ cedula: '', nombre_completo: '', cargo: '', area: 'mina', salario_base: '', telefono: '', notas: '', fecha_ingreso: new Date().toISOString().split('T')[0] });
    setEditItem(null);
  };

  const openNew = () => { resetForm(); setShowModal(true); };
  const openEdit = (item: Personal) => {
    setEditItem(item);
    setForm({ cedula: item.cedula, nombre_completo: item.nombre_completo, cargo: item.cargo, area: item.area, salario_base: String(item.salario_base), telefono: item.telefono || '', notas: item.notas || '', fecha_ingreso: item.fecha_ingreso });
    setShowModal(true);
  };

  const handleSave = async () => {
    const salario = parseFloat(form.salario_base);
    if (isNaN(salario) || salario <= 0) { setFormError('El salario base debe ser mayor que cero.'); return; }
    if (!form.cedula.trim()) { setFormError('La cédula es obligatoria.'); return; }
    if (!form.nombre_completo.trim()) { setFormError('El nombre es obligatorio.'); return; }
    if (!form.cargo.trim()) { setFormError('El cargo es obligatorio.'); return; }
    setFormError(null);
    setSaving(true);
    const payload = { ...form, salario_base: salario };
    if (editItem) {
      await supabase.from('personal').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('personal').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    resetForm();
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este trabajador?')) return;
    await supabase.from('personal').update({ activo: false }).eq('id', id);
    loadData();
  };

  // ── Procesar Nómina ──────────────────────────────────────────────────────
  const handleProcesarNomina = async () => {
    if (data.length === 0) { alert('No hay trabajadores activos registrados.'); return; }

    const totalNomina = data.reduce((s, p) => s + Number(p.salario_base), 0);
    const fechaHoy = new Date().toISOString().split('T')[0];

    // Verificar si esa semana ya fue procesada
    const { data: existe } = await supabase
      .from('nomina_semanas')
      .select('id')
      .eq('semana_inicio', weekRange.inicio)
      .maybeSingle();

    if (existe) {
      if (!confirm(`La semana ${fmtDate(weekRange.inicio)} al ${fmtDate(weekRange.fin)} ya fue procesada.\n¿Deseas procesarla de nuevo de todas formas?`)) return;
    }

    setProcesando(true);
    setProcesadoOk(null);

    // 1. nomina_pagos
    const pagos = data.map((p) => ({
      personal_id: p.id,
      fecha_pago: fechaHoy,
      periodo_inicio: weekRange.inicio,
      periodo_fin: weekRange.fin,
      salario_base: p.salario_base,
      bonificaciones: 0,
      deducciones: 0,
      total_pagado: p.salario_base,
      metodo_pago: 'nomina_semanal',
      observaciones: `Nómina semanal ${fmtDate(weekRange.inicio)} al ${fmtDate(weekRange.fin)}`,
      registrado_por: user?.id,
    }));
    await supabase.from('nomina_pagos').insert(pagos);

    // 2. Gastos
    let gastoId: string | null = null;
    const { data: catRow } = await supabase.from('categorias_gasto').select('id').ilike('nombre', '%nomina%').limit(1).maybeSingle();
    if (catRow) {
      const { data: gastoRow } = await supabase.from('gastos').insert({
        fecha: fechaHoy,
        categoria_id: catRow.id,
        descripcion: `Nómina semanal ${fmtDate(weekRange.inicio)} al ${fmtDate(weekRange.fin)} — ${data.length} trabajadores`,
        monto: totalNomina,
        proveedor: 'Nómina interna',
        notas: 'Procesado automáticamente desde módulo de Nómina.',
        registrado_por: user?.id,
      }).select('id').maybeSingle();
      gastoId = gastoRow?.id ?? null;
    }

    // 3. nomina_semanas
    await supabase.from('nomina_semanas').upsert({
      semana_inicio: weekRange.inicio,
      semana_fin: weekRange.fin,
      total_trabajadores: data.length,
      total_pagado: totalNomina,
      registrado_por: user?.id,
      ...(gastoId ? { gasto_id: gastoId } : {}),
    }, { onConflict: 'semana_inicio' });

    setProcesando(false);
    setProcesadoOk(`✓ Nómina procesada: ${data.length} trabajadores — ${fmtMoney(totalNomina)}`);
    setShowProcesarModal(false);
    loadTodasSemanas();
  };

  // ── Revertir semana ──────────────────────────────────────────────────────
  const handleRevertirSemana = async (sem: NominaSemana) => {
    if (
      !confirm(
        `⚠ ¿Revertir la nómina de la semana ${fmtDate(sem.semana_inicio)} al ${fmtDate(sem.semana_fin)}?\n\nEsto eliminará:\n• ${sem.total_trabajadores} registros de pago\n• El gasto de ${fmtMoney(Number(sem.total_pagado))} en Contabilidad\n\nEsta acción no se puede deshacer.`
      )
    )
      return;

    setRevertiendoId(sem.id);

    // 1. Eliminar nomina_pagos de ese período
    await supabase.from('nomina_pagos').delete().eq('periodo_inicio', sem.semana_inicio);

    // 2. Eliminar el gasto vinculado
    if (sem.gasto_id) {
      await supabase.from('gastos').delete().eq('id', sem.gasto_id);
    }

    // 3. Eliminar semana
    await supabase.from('nomina_semanas').delete().eq('id', sem.id);

    setRevertiendoId(null);
    loadTodasSemanas();
  };

  // ── Parsear archivo ──────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setCurrentFileName(file.name);
    setParseError(null);
    setParsedEmps([]);
    setImportResult(null);
    setDetectedWeek({ inicio: null, fin: null });
    setParsing(true);

    try {
      if (importTab === 'excel') {
        const { parseExcelNomina, detectWeekRangeFromExcel } = await import('@/lib/parse-nomina-file');
        // Leer workbook para detección de semana
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
        const detected = detectWeekRangeFromExcel(wb);
        setDetectedWeek(detected);
        if (detected.inicio && detected.fin) {
          setWeekRange({ inicio: detected.inicio, fin: detected.fin });
        }
        const employees = await parseExcelNomina(file);
        if (employees.length === 0) {
          setParseError('No se detectaron empleados. Verifica el formato.');
        } else {
          setParsedEmps(employees);
        }
      } else {
        const { parsePdfNomina, detectWeekRange } = await import('@/lib/parse-nomina-file');
        // Extract text first via pdfjs for week detection, then parse employees
        const pdfjsLib = await import('pdfjs-dist');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        let textForDetection = '';
        for (let pg = 1; pg <= Math.min(2, pdf.numPages); pg++) {
          const page = await pdf.getPage(pg);
          const content = await page.getTextContent();
          textForDetection += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
        }
        const detected = detectWeekRange(textForDetection);
        setDetectedWeek(detected);
        if (detected.inicio && detected.fin) {
          setWeekRange({ inicio: detected.inicio, fin: detected.fin });
        }
        const employees = await parsePdfNomina(file);
        if (employees.length === 0) {
          setParseError('No se detectaron empleados. Verifica que el PDF tenga texto extraíble.');
        } else {
          setParsedEmps(employees);
        }
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Error desconocido al procesar el archivo.');
    } finally {
      setParsing(false);
    }
  };

  // ── Confirmar importación ─────────────────────────────────────────────────
  const handleImportConfirm = async () => {
    const valid = parsedEmps.filter((e) => e._valid);
    if (valid.length === 0) { alert('No hay empleados válidos. Corrige los errores primero.'); return; }
    setImporting(true);
    let nuevos = 0, actualizados = 0;

    for (const emp of valid) {
      const payload = {
        cedula: emp.cedula,
        nombre_completo: emp.nombre_completo,
        cargo: emp.cargo,
        area: emp.area,
        salario_base: emp.salario_semanal,
        fecha_ingreso: emp.fecha_ingreso,
        activo: true,
      };
      const { data: existing } = await supabase.from('personal').select('id').eq('cedula', emp.cedula).maybeSingle();
      if (existing) {
        await supabase.from('personal').update(payload).eq('id', existing.id);
        actualizados++;
      } else {
        await supabase.from('personal').insert(payload);
        nuevos++;
      }
    }

    setImporting(false);
    setImportResult({ nuevos, actualizados });
    loadData();
  };

  const resetImport = () => {
    setParsedEmps([]);
    setParseError(null);
    setImportResult(null);
    setCurrentFileName('');
    setDetectedWeek({ inicio: null, fin: null });
  };

  const closeImport = () => { setShowImport(false); resetImport(); };

  // ── Derived values ───────────────────────────────────────────────────────
  const filtered = data.filter(
    (p) => p.nombre_completo.toLowerCase().includes(search.toLowerCase()) || p.cedula.includes(search)
  );
  const totalSemana = data.reduce((s, p) => s + Number(p.salario_base), 0);
  const validCount = parsedEmps.filter((e) => e._valid).length;
  const invalidCount = parsedEmps.length - validCount;
  const semanaActualProcesada = semanaActual !== null && semanaActual !== undefined;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── Banner semana actual ──────────────────────────────────────────── */}
      {semanaActual === undefined ? null : !semanaActualProcesada ? (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-300">Nómina de esta semana pendiente</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Semana del {fmtDate(getWeekStart())} al {fmtDate(getWeekEnd())} — {data.length} trabajadores — Total: <span className="font-bold">{fmtMoney(totalSemana)}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => { setWeekRange({ inicio: getWeekStart(), fin: getWeekEnd() }); setShowProcesarModal(true); }}
              disabled={!canEdit || data.length === 0}
              className="btn-primary shrink-0 !py-2 !text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Procesar Nómina
            </button>
          </div>
          {procesadoOk && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />{procesadoOk}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-emerald-300 font-medium">Nómina de esta semana procesada</p>
            <p className="text-xs text-emerald-400/60 mt-0.5 truncate">
              {fmtDate(semanaActual.semana_inicio)} al {fmtDate(semanaActual.semana_fin)} — {semanaActual.total_trabajadores} trabajadores — {fmtMoney(Number(semanaActual.total_pagado))}
            </p>
          </div>
          <button
            onClick={() => handleRevertirSemana(semanaActual)}
            disabled={!canEdit || revertiendoId === semanaActual.id}
            className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0 border border-red-500/20 hover:border-red-400/40 bg-red-500/5 rounded-lg px-2.5 py-1.5"
          >
            {revertiendoId === semanaActual.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Revertir
          </button>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Users className="w-6 h-6 text-amber-400" /> Nómina
          </h1>
          <p className="text-white/40 text-sm mt-1">{data.length} trabajadores activos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} disabled={!canEdit} className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            <Upload className="w-4 h-4" /><span className="hidden sm:inline">Importar</span>
          </button>
          <button
            onClick={() => { setWeekRange({ inicio: getWeekStart(), fin: getWeekEnd() }); setShowProcesarModal(true); }}
            disabled={!canEdit || data.length === 0}
            className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Procesar</span>
          </button>
          <button onClick={openNew} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card-glass p-4">
          <p className="text-xs text-white/35 uppercase tracking-wider mb-1">Total semanal</p>
          <p className="text-xl font-black text-amber-400">{fmtMoney(totalSemana)}</p>
        </div>
        <div className="card-glass p-4">
          <p className="text-xs text-white/35 uppercase tracking-wider mb-1">Trabajadores</p>
          <p className="text-xl font-black text-white/80">{data.length}</p>
        </div>
        <div className="card-glass p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-white/35 uppercase tracking-wider mb-1">Promedio / sem</p>
          <p className="text-xl font-black text-white/80">{data.length > 0 ? fmtMoney(totalSemana / data.length) : '$0.00'}</p>
        </div>
      </div>

      {/* ── Historial de Semanas ─────────────────────────────────────────── */}
      {todasSemanas.length > 0 && (
        <div className="card-glass overflow-hidden">
          <button
            onClick={() => setShowHistorial(!showHistorial)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white/80">Historial de Semanas Procesadas</span>
              <span className="text-xs text-white/30 bg-white/[0.07] px-2 py-0.5 rounded-full">{todasSemanas.length}</span>
            </div>
            {showHistorial ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
          </button>

          {showHistorial && (
            <div className="border-t border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/40">
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Semana</th>
                      <th className="text-center px-3 py-2.5 text-white/40 font-medium">Trabajadores</th>
                      <th className="text-right px-3 py-2.5 text-white/40 font-medium">Total</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todasSemanas.map((sem) => (
                      <tr key={sem.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-white/75 font-medium">
                              {fmtDate(sem.semana_inicio)}
                            </span>
                            <span className="text-white/30">→</span>
                            <span className="text-white/50">{fmtDate(sem.semana_fin)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-white/50">{sem.total_trabajadores}</td>
                        <td className="px-3 py-3 text-right font-semibold text-amber-400">{fmtMoney(Number(sem.total_pagado))}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRevertirSemana(sem)}
                            disabled={!canEdit || revertiendoId === sem.id}
                            className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40 ml-auto border border-red-500/20 hover:border-red-400/40 bg-red-500/5 rounded-lg px-2.5 py-1.5"
                          >
                            {revertiendoId === sem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            Revertir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Buscador ─────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o cédula..." className="input-field pl-10" />
      </div>

      {/* ── Lista trabajadores ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map((p) => (
              <div key={p.id} className="card-glass p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">{p.cedula}</span>
                    <h3 className="font-bold text-white/85 mt-2 text-base leading-tight">{p.nombre_completo}</h3>
                    <p className="text-sm text-white/55 mt-1">{p.cargo} <span className="badge badge-neutral scale-90 origin-left ml-1">{AREA_LABELS[p.area]}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-amber-400 text-lg block leading-none">{fmtMoney(p.salario_base)}</span>
                    <span className="text-[10px] text-white/35">por semana</span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                    <button onClick={() => openEdit(p)} className="btn-secondary !py-1.5 !px-3 !text-xs"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="btn-danger !py-1.5 !px-3 !text-xs"><Trash2 className="w-3.5 h-3.5" /> Archivar</button>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <EmptyState icon={<Users className="w-8 h-8" />} title="Sin trabajadores" description={search ? 'No coincide ningún resultado.' : 'Registra el primer trabajador.'} action={canEdit && !search ? { label: 'Agregar primer trabajador', onClick: openNew } : undefined} />
            )}
          </div>

          {/* Desktop */}
          <div className="table-container hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cédula</th><th>Nombre</th><th>Cargo</th><th>Área</th><th className="text-right">Salario/sem</th><th>Ingreso</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-white/50">{p.cedula}</td>
                    <td className="text-white/80 font-medium">{p.nombre_completo}</td>
                    <td className="text-white/50 max-w-[180px] truncate" title={p.cargo}>{p.cargo}</td>
                    <td><span className="badge badge-neutral">{AREA_LABELS[p.area]}</span></td>
                    <td className="text-right text-amber-400 font-semibold">{fmtMoney(p.salario_base)}</td>
                    <td className="text-white/40">{p.fecha_ingreso}</td>
                    <td>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-0"><EmptyState icon={<Users className="w-8 h-8" />} title="Sin trabajadores" description={search ? 'No coincide ningún resultado.' : 'Registra el primer trabajador.'} action={canEdit && !search ? { label: 'Agregar primer trabajador', onClick: openNew } : undefined} /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Procesar Nómina (con selector de semana)
      ══════════════════════════════════════════════════════════════════ */}
      {showProcesarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowProcesarModal(false)}>
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white/90 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" /> Procesar Nómina
              </h2>
              <button onClick={() => setShowProcesarModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              <WeekPicker
                label="Período de esta nómina"
                value={weekRange}
                onChange={setWeekRange}
              />

              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Trabajadores activos</span>
                  <span className="text-white/80 font-medium">{data.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Total a registrar</span>
                  <span className="text-amber-400 font-bold text-base">{fmtMoney(totalSemana)}</span>
                </div>
                <div className="border-t border-zinc-800 pt-2.5 space-y-1">
                  <p className="text-xs text-white/30">Al confirmar se registrará:</p>
                  <p className="text-xs text-white/45">✓ {data.length} pagos en historial de nómina</p>
                  <p className="text-xs text-white/45">✓ Gasto de {fmtMoney(totalSemana)} en Contabilidad</p>
                  <p className="text-xs text-white/45">✓ Semana marcada como procesada</p>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowProcesarModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={handleProcesarNomina}
                  disabled={procesando || !weekRange.inicio || !weekRange.fin}
                  className="btn-primary flex-1 disabled:opacity-40"
                >
                  {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Agregar / Editar Trabajador
      ══════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowModal(false); setFormError(null); }}>
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Trabajador' : 'Nuevo Trabajador'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>
            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{formError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="input-label">Cédula *</label><input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Fecha Ingreso</label><input type="date" value={form.fecha_ingreso} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} className="input-field" /></div>
              <div className="md:col-span-2"><label className="input-label">Nombre Completo *</label><input value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Cargo *</label><input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">Área *</label>
                <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as Personal['area'] })} className="input-field">
                  {AREA_OPTIONS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
                </select>
              </div>
              <div><label className="input-label">Salario Semanal (USD) *</label><input type="number" step="0.01" min="0.01" value={form.salario_base} onChange={(e) => { setForm({ ...form, salario_base: e.target.value }); setFormError(null); }} className="input-field" placeholder="0.00" /></div>
              <div><label className="input-label">Teléfono</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="input-field" /></div>
              <div className="md:col-span-2"><label className="input-label">Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="input-field" rows={2} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editItem ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Importar Nómina
      ══════════════════════════════════════════════════════════════════ */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={closeImport}>
          <div className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-400" /> Importar Nómina
                </h2>
                <p className="text-xs text-white/35 mt-0.5">Sube tu planilla Excel o PDF para registrar empleados automáticamente</p>
              </div>
              <button onClick={closeImport} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Tabs */}
              {!importResult && (
                <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 w-fit">
                  <button onClick={() => { setImportTab('excel'); resetImport(); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${importTab === 'excel' ? 'bg-zinc-800 text-white shadow' : 'text-white/40 hover:text-white/70'}`}>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel
                  </button>
                  <button onClick={() => { setImportTab('pdf'); resetImport(); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${importTab === 'pdf' ? 'bg-zinc-800 text-white shadow' : 'text-white/40 hover:text-white/70'}`}>
                    <FileText className="w-4 h-4 text-red-400" /> PDF
                  </button>
                </div>
              )}

              {/* Resultado */}
              {importResult ? (
                <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white/90">¡Importación exitosa!</p>
                    <p className="text-white/50 text-sm mt-1">{importResult.nuevos} nuevos · {importResult.actualizados} actualizados</p>
                  </div>

                  {/* Semana detectada / selector antes de procesar */}
                  <div className="w-full max-w-sm space-y-3">
                    <WeekPicker
                      label="Procesar nómina para la semana:"
                      value={weekRange}
                      onChange={setWeekRange}
                    />
                    {detectedWeek.inicio && (
                      <p className="text-xs text-amber-400/70 text-center">
                        📅 Semana detectada automáticamente del archivo
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 mt-1">
                    <button onClick={closeImport} className="btn-secondary">Solo importar datos</button>
                    <button
                      onClick={() => { closeImport(); setShowProcesarModal(true); }}
                      disabled={!canEdit}
                      className="btn-primary"
                    >
                      <DollarSign className="w-4 h-4" /> Registrar en Contabilidad
                    </button>
                  </div>
                </div>
              ) : parsedEmps.length > 0 ? (
                <>
                  {/* Stats + semana detectada */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm">
                      <span className="text-white/40">Archivo:</span>
                      <span className="text-white/70 font-medium truncate max-w-[160px]">{currentFileName}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" />{validCount} válidos</span>
                    {invalidCount > 0 && <span className="flex items-center gap-1.5 text-sm text-amber-400"><AlertTriangle className="w-4 h-4" />{invalidCount} con advertencia</span>}
                    <button onClick={resetImport} className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors">Cambiar archivo</button>
                  </div>

                  {/* Semana del archivo */}
                  <WeekPicker
                    label={detectedWeek.inicio ? '📅 Semana detectada (puedes corregirla)' : 'Semana de esta nómina'}
                    value={weekRange}
                    onChange={setWeekRange}
                  />

                  <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl px-3 py-2.5 text-xs text-blue-300/80">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Puedes editar cualquier campo. Cédulas duplicadas serán actualizadas, no duplicadas.</span>
                  </div>

                  <PreviewTable employees={parsedEmps} onChange={setParsedEmps} />
                </>
              ) : (
                <>
                  {importTab === 'excel' ? (
                    <>
                      <DropZone accept=".xlsx,.xls,.ods,.csv" label="Arrastra tu archivo Excel aquí, o haz click para seleccionarlo (.xlsx, .xls, .ods)" onFile={handleFile} disabled={parsing} />
                      <div className="flex items-start gap-2 text-xs text-white/30">
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Se detecta automáticamente la semana, los empleados y sus salarios.</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <DropZone accept=".pdf" label="Arrastra tu archivo PDF de nómina aquí, o haz click para seleccionarlo" onFile={handleFile} disabled={parsing} />
                      <div className="flex items-start gap-2 text-xs text-white/30">
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>El PDF debe tener texto extraíble (generado desde Excel/Word, no escaneado).</span>
                      </div>
                    </>
                  )}

                  {parsing && (
                    <div className="flex items-center justify-center gap-3 py-6 text-amber-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Procesando archivo...</span>
                    </div>
                  )}

                  {parseError && (
                    <div className="flex items-start gap-2 px-3 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-red-400">{parseError}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!importResult && parsedEmps.length > 0 && (
              <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-zinc-800 shrink-0">
                <p className="text-sm text-white/40">
                  Importar <span className="text-white/70 font-semibold">{validCount}</span> empleados
                  {invalidCount > 0 && <span className="text-amber-400/70"> ({invalidCount} omitidos)</span>}
                </p>
                <div className="flex gap-3">
                  <button onClick={closeImport} className="btn-secondary">Cancelar</button>
                  <button onClick={handleImportConfirm} disabled={importing || validCount === 0} className="btn-primary disabled:opacity-40">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                    Importar {validCount}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
