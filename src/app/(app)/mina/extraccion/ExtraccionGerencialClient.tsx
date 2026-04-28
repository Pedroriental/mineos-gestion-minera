'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createExtraccion, updateExtraccion, deleteExtraccion } from '@/lib/actions/extraccion';
import type { ReporteExtraccion, EventoExtraccion } from '@/lib/types';
import { Loader2, Pickaxe, Plus, X, Download, AlertCircle, Search, Package, Zap, Clock, BarChart3 } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { columns } from './columns';
import { FadeIn } from '@/components/ui/motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

// ═══════════════════════════════════════════════════════════
// CUSTOM TOOLTIP FOR RECHARTS
// ═══════════════════════════════════════════════════════════
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950/95 border border-zinc-800 p-2 rounded-lg shadow-xl backdrop-blur-md">
        <p className="text-white/60 text-[10px] font-mono mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-white/80 text-[10px]">{entry.name}:</span>
            <span className="text-white font-bold text-xs">{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export interface ExtraccionGerencialData {
  kpis: {
    totalSacos: number;
    totalDisparos: number;
    totalEventos: number;
  };
  diaria: {
    fecha: string;
    sacos: number;
    disparos: number;
    eventos: number;
  }[];
  registros: ReporteExtraccion[];
}

export default function ExtraccionGerencialClient({ data, selectedDateStr }: { data: ExtraccionGerencialData, selectedDateStr: string }) {
  const { user } = useAuth();
  const canEdit = useCanEdit();

  const [selectedDate, setSelectedDate] = useState(selectedDateStr);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteExtraccion | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const initialData = data.registros;

  const emptyForm = {
    fecha: selectedDate,
    turno: 'noche' as ReporteExtraccion['turno'],
    vertical: '',
    mina: '',
    responsable: '',
    hora_inicio: '',
    hora_fin: '',
    sacos_extraidos: '',
    numero_disparo: '',
    observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [eventos, setEventos] = useState<EventoExtraccion[]>([]);

  // 1. Selector Inteligente: Días con Registros
  const diasConRegistros = useMemo(() => {
     return data.diaria.filter(dia => {
        return initialData.some(r => r.fecha === dia.fecha);
     });
  }, [data.diaria, initialData]);

  // Si selectedDateStr no tiene registros, forzamos a seleccionar el último día con registros
  useEffect(() => {
     if (diasConRegistros.length > 0 && !initialData.some(r => r.fecha === selectedDate)) {
        setSelectedDate(diasConRegistros[diasConRegistros.length - 1].fecha);
     }
  }, [diasConRegistros, initialData, selectedDate]);

  // 2. Filtrado para Vista Diaria (Tabla)
  const filteredRegistros = useMemo(() => initialData.filter(d => d.fecha === selectedDate), [initialData, selectedDate]);

  // 3. Cálculo de Mini KPIs Diarios
  const diaSacos = filteredRegistros.reduce((acc, curr) => acc + (Number(curr.sacos_extraidos) || 0), 0);
  const diaDisparos = filteredRegistros.filter(d => d.numero_disparo).length;

  const table = useReactTable({
    data: filteredRegistros,
    columns: columns(
      (item) => openEdit(item),
      (id) => handleDelete(id),
      canEdit
    ),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  // Manejo de Modal y Eventos
  const addEvento = () => setEventos(e => [...e, { hora: '', descripcion: '' }]);
  const removeEvento = (i: number) => setEventos(e => e.filter((_, idx) => idx !== i));
  const updateEvento = (i: number, key: keyof EventoExtraccion, val: string) =>
    setEventos(e => e.map((x, idx) => idx === i ? { ...x, [key]: val } : x));
  const setFormField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm, fecha: selectedDate });
    setEventos([]);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (item: ReporteExtraccion) => {
    setEditItem(item);
    setEventos(item.eventos || []);
    setForm({
      fecha: item.fecha,
      turno: item.turno,
      vertical: item.vertical || '',
      mina: item.mina || '',
      responsable: item.responsable || '',
      hora_inicio: item.hora_inicio || '',
      hora_fin: item.hora_fin || '',
      sacos_extraidos: String(item.sacos_extraidos ?? ''),
      numero_disparo: item.numero_disparo || '',
      observaciones: item.observaciones || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = () => {
    const sacosNum = parseInt(form.sacos_extraidos);
    if (isNaN(sacosNum) || sacosNum <= 0) {
      setFormError('Los sacos extraídos deben ser mayores que 0.');
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const payload = {
        ...form,
        sacos_extraidos: sacosNum,
        eventos: eventos.length > 0 ? eventos : null,
        vertical: form.vertical || null,
        mina: form.mina || null,
        responsable: form.responsable || null,
        hora_inicio: form.hora_inicio || null,
        hora_fin: form.hora_fin || null,
        numero_disparo: form.numero_disparo || null,
        observaciones: form.observaciones || null,
        registrado_por: user?.id,
      };

      let res;
      if (editItem) {
        res = await updateExtraccion({ ...payload, id: editItem.id });
      } else {
        res = await createExtraccion(payload);
      }

      if (res?.ok === false) {
        setFormError(res.message);
      } else {
        setShowModal(false);
        setEditItem(null);
        setForm({ ...emptyForm, fecha: selectedDate });
        setEventos([]);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este reporte de extracción?')) return;
    startTransition(async () => {
      await deleteExtraccion(id);
    });
  };

  // Exportar PDF
  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();

      const visibleRows = table.getFilteredRowModel().rows.map(row => row.original);
      if (visibleRows.length === 0) {
        setIsExporting(false);
        return;
      }

      const dates = visibleRows.map(r => new Date(r.fecha + 'T12:00:00').getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const formatD = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const dateStr = minDate.getTime() === maxDate.getTime() ? formatD(minDate) : `${formatD(minDate)} - ${formatD(maxDate)}`;

      // 1. Encabezado
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text('MINEOS - LA FE', 14, 22);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Reporte Gerencial de Extracción Mina', 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${dateStr} | Registros: ${visibleRows.length}`, 14, 36);

      // 2. Bloque de KPIs (Resumen Ejecutivo)
      doc.setFillColor(244, 244, 245);
      doc.roundedRect(14, 42, pageWidth - 28, 24, 3, 3, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(113, 113, 122);
      doc.text('Sacos Totales', 20, 50);
      doc.text('Disparos Totales', 80, 50);
      doc.text('Eventos Registrados', 140, 50);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text(`${data.kpis.totalSacos.toLocaleString()}`, 20, 58);
      doc.text(`${data.kpis.totalDisparos.toLocaleString()}`, 80, 58);
      doc.text(`${data.kpis.totalEventos.toLocaleString()}`, 140, 58);

      // 3. Tabla de Datos
      const tableData = visibleRows.map(row => {
        const d = new Date(row.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const turno = row.turno === 'dia' ? 'Día' : row.turno === 'noche' ? 'Noche' : 'Completo';
        const horario = `${row.hora_inicio ? row.hora_inicio.slice(0, 5) : '—'} -> ${row.hora_fin ? row.hora_fin.slice(0, 5) : '—'}`;
        const disp = row.numero_disparo ? `N°${row.numero_disparo}` : '—';
        return [
          d, turno, row.vertical || '-', row.mina || '-', horario, disp, String(row.sacos_extraidos)
        ];
      });

      autoTable(doc, {
        startY: 72,
        head: [['Fecha', 'Turno', 'Vertical', 'Mina', 'Horario', 'Disparo', 'Sacos Extraídos']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold' },
        bodyStyles: { halign: 'center' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      // 4. Pie de Página
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, doc.internal.pageSize.getHeight() - 10);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`Extraccion_Gerencial_MineOS_${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Hubo un error al generar el PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col overflow-hidden">
      
      {/* ── Header Fijo ── */}
      <FadeIn className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Pickaxe className="w-6 h-6 text-amber-500" /> Extracción Gerencial
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Centro de Mando Operativo y Logística de Mina.
          </p>
        </div>
      </FadeIn>

      {/* ── Split Screen Layout (Grid 12) ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
         
         {/* PANEL IZQUIERDO (BI y KPIs) */}
         <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto lg:overflow-hidden pr-1">
            
            {/* KPI Grid 2x2 */}
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
               <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Sacos Totales</span>
                     <Package className="w-4 h-4 text-amber-500/50" />
                  </div>
                  <span className="text-3xl font-black text-amber-500">{data.kpis.totalSacos.toLocaleString()}</span>
               </div>
               
               <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Disparos</span>
                     <Zap className="w-4 h-4 text-blue-500/50" />
                  </div>
                  <span className="text-3xl font-black text-blue-400">{data.kpis.totalDisparos.toLocaleString()}</span>
               </div>

               <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between col-span-2">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Eventos en Bitácora</span>
                     <Clock className="w-4 h-4 text-emerald-500/50" />
                  </div>
                  <span className="text-3xl font-black text-emerald-400">{data.kpis.totalEventos.toLocaleString()}</span>
               </div>
            </div>

            {/* Gráfico de Barras */}
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 flex-1 flex flex-col min-h-[220px]">
               <h2 className="text-white/80 font-bold text-sm mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" /> Sacos Extraídos por Día
               </h2>
               <div className="flex-1 w-full relative">
                  <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                     <BarChart data={data.diaria} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="fecha" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} 
                               tickFormatter={(val) => {
                                  const d = new Date(val + 'T12:00:00');
                                  return `${d.getDate()}`;
                               }} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="sacos" name="Sacos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

         </div>

         {/* PANEL DERECHO (Operativo / Tabla) */}
         <div className="lg:col-span-8 flex flex-col overflow-hidden bg-zinc-900/60 rounded-xl border border-zinc-800/80 p-4">
            
            {/* 1. Selector de Días Inteligente */}
            <div className="flex-shrink-0 flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide snap-x w-full">
               {diasConRegistros.length === 0 && (
                  <div className="text-xs text-white/40 italic">No hay registros en este período.</div>
               )}
               {diasConRegistros.map((dia) => {
                 const d = new Date(dia.fecha + 'T12:00:00');
                 const isSelected = selectedDate === dia.fecha;
                 const dRegs = initialData.filter(r => r.fecha === dia.fecha).length;
                 
                 return (
                   <button 
                     key={dia.fecha} 
                     onClick={() => setSelectedDate(dia.fecha)}
                     className={`snap-center flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${isSelected ? 'bg-amber-500 border-amber-500 text-black font-bold' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'}`}
                   >
                     <span>{d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                     <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isSelected ? 'bg-black/20 text-black' : 'bg-zinc-800 text-white/60'}`}>{dRegs}</span>
                   </button>
                 )
               })}
            </div>

            {/* 2. Mini KPIs Diarios */}
            <div className="flex-shrink-0 grid grid-cols-3 gap-2 mb-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                 <span className="text-[9px] uppercase font-bold text-zinc-500 block leading-tight">Sacos Día</span>
                 <span className="text-lg font-bold text-amber-500 leading-tight">{diaSacos.toLocaleString()}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                 <span className="text-[9px] uppercase font-bold text-zinc-500 block leading-tight">Disparos Día</span>
                 <span className="text-lg font-bold text-blue-400 leading-tight">{diaDisparos}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                 <span className="text-[9px] uppercase font-bold text-zinc-500 block leading-tight">Registros</span>
                 <span className="text-lg font-bold text-white leading-tight">{filteredRegistros.length}</span>
              </div>
            </div>

            {/* 3. Header de la Tabla (Action Bar) */}
            <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 mb-3">
               <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 w-full flex-1">
                 <Search className="w-4 h-4 text-white/40 mr-2" />
                 <input type="text" placeholder="Buscar por vertical o mina..." value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)}
                   className="bg-transparent border-none outline-none text-sm text-white/90 placeholder:text-white/30 w-full" />
               </div>
               <div className="flex items-center gap-3 w-full sm:w-auto">
                 <button onClick={handleExportPDF} disabled={table.getFilteredRowModel().rows.length === 0 || isExporting}
                   className="btn-secondary h-10 px-4 disabled:opacity-40 flex items-center justify-center gap-2 whitespace-nowrap flex-1 sm:flex-none">
                   {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
                   <span className="hidden sm:inline">{isExporting ? 'Generando...' : 'Exportar PDF'}</span>
                 </button>
                 {canEdit && (
                    <button onClick={openNew} 
                       className="bg-amber-600 hover:bg-amber-500 text-black font-bold h-10 px-4 rounded-lg flex items-center justify-center gap-2 whitespace-nowrap transition-colors flex-1 sm:flex-none shadow-lg shadow-amber-900/20">
                       <Plus className="w-5 h-5" /> Nuevo Registro
                    </button>
                 )}
               </div>
            </div>

            {/* 4. Tabla Interna con Scroll Independiente */}
            <div className="flex-1 overflow-y-auto border border-zinc-800/60 rounded-lg bg-zinc-950/30 custom-scrollbar">
               <table className="w-full text-left border-collapse relative">
                  <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10 shadow-sm">
                     {table.getHeaderGroups().map(hg => (
                        <tr key={hg.id}>
                           {hg.headers.map(header => (
                              <th key={header.id} onClick={header.column.getToggleSortingHandler()} className={`px-4 py-2.5 text-[10px] font-bold text-white/50 uppercase tracking-wider whitespace-nowrap ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-white/80' : ''}`}>
                                 {flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                           ))}
                        </tr>
                     ))}
                  </thead>
                  <tbody>
                     {table.getRowModel().rows.map(row => (
                        <tr key={row.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/40 transition-colors">
                           {row.getVisibleCells().map(cell => (
                              <td key={cell.id} className="px-4 py-2.5 text-xs text-white/80 whitespace-nowrap">
                                 {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                           ))}
                        </tr>
                     ))}
                     {table.getRowModel().rows.length === 0 && (
                        <tr>
                           <td colSpan={10} className="py-12">
                              <EmptyState icon={<Pickaxe className="w-6 h-6" />} title="Día sin Extracción" description="No hay reportes de extracción ingresados para este día." />
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      {/* CRUD Modal Preserved */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Reporte' : 'Nuevo Reporte de Extracción'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="space-y-6">
              {/* Identificación */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-amber-400">📍 Identificación</span>
                  <div className="flex-1 h-px bg-amber-400/20" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => setFormField('fecha', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Turno *</label>
                    <select value={form.turno} onChange={e => setFormField('turno', e.target.value)} className="input-field">
                      <option value="dia">☀ Día</option>
                      <option value="noche">🌙 Noche</option>
                      <option value="completo">🔄 Completo</option>
                    </select>
                  </div>
                  <div><label className="input-label">Vertical</label>
                    <select value={form.vertical} onChange={e => setFormField('vertical', e.target.value)} className="input-field">
                      <option value="">— Sin especificar —</option>
                      <option value="Vertical 1">Vertical 1</option>
                      <option value="Vertical 2">Vertical 2</option>
                      <option value="Vertical 3">Vertical 3</option>
                    </select>
                  </div>
                  <div><label className="input-label">Mina</label><input value={form.mina} onChange={e => setFormField('mina', e.target.value)} placeholder="Ej: Belén 2" className="input-field" /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => setFormField('responsable', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Hora Inicio</label><input type="time" value={form.hora_inicio} onChange={e => setFormField('hora_inicio', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Hora Culmina</label><input type="time" value={form.hora_fin} onChange={e => setFormField('hora_fin', e.target.value)} className="input-field" /></div>
                </div>
              </div>

              {/* Eventos */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-blue-400">📋 Bitácora de Eventos</span>
                  <div className="flex-1 h-px bg-blue-400/20" />
                  <button type="button" onClick={addEvento} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-400/20">
                    <Plus className="w-3.5 h-3.5" /> Agregar evento
                  </button>
                </div>
                {eventos.length === 0 && <p className="text-xs text-white/25 italic">Sin eventos. Agrega los hitos del turno.</p>}
                <div className="space-y-2">
                  {eventos.map((ev, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr_auto] gap-2 items-start p-3 bg-blue-500/[0.05] rounded-xl border border-blue-400/15">
                      <div>
                        <label className="input-label !text-blue-400/70 !text-[10px]">Hora</label>
                        <input type="time" value={ev.hora} onChange={e => updateEvento(i, 'hora', e.target.value)} className="input-field !py-1.5" />
                      </div>
                      <div>
                        <label className="input-label !text-blue-400/70 !text-[10px]">Descripción</label>
                        <input value={ev.descripcion} onChange={e => updateEvento(i, 'descripcion', e.target.value)}
                          placeholder="Ej: SE EMPIEZA SACAR MATERIAL A SACOS" className="input-field !py-1.5" />
                      </div>
                      <button type="button" onClick={() => removeEvento(i)} className="mt-5 p-1.5 rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Producción */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-emerald-400">📦 Producción del Turno</span>
                  <div className="flex-1 h-px bg-emerald-400/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-500/[0.07] rounded-xl p-3 border border-amber-400/20">
                    <label className="input-label !text-amber-400 !font-semibold">Sacos Extraídos *</label>
                    <input type="number" value={form.sacos_extraidos} onChange={e => setFormField('sacos_extraidos', e.target.value)} className="input-field font-bold text-lg" placeholder="133" />
                  </div>
                  <div>
                    <label className="input-label">N° Disparo</label>
                    <input value={form.numero_disparo} onChange={e => setFormField('numero_disparo', e.target.value)} placeholder="Ej: 27" className="input-field" />
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="input-label">Observaciones del Turno</label>
                <textarea value={form.observaciones} onChange={e => setFormField('observaciones', e.target.value)} className="input-field" rows={3}
                  placeholder="Ej: El turno nocturno inició 8:42 PM por la espera de camión..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={isPending || !form.sacos_extraidos} className="btn-primary disabled:opacity-40">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editItem ? 'Actualizar' : 'Registrar Turno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
