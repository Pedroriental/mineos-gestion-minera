'use client';

import { Fragment, useEffect, useState, useTransition } from 'react';
import { Calculator, Download, FileText, Loader2, Users } from 'lucide-react';
import { AppMonthPicker } from '@/components/ui/AppMonthPicker';
import { generarCompensacionGastosAction } from '@/lib/actions/compensacion-gastos';
import { formatCurrency, type CompensacionResumen } from '@/lib/compensacion-gastos';
import { generarPdfCompensacionGastos } from '@/lib/reportes/compensacion-gastos-pdf';
import { descargarCsvCompensacionGastos } from '@/lib/reportes/compensacion-gastos-csv';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';

type Props = {
  initialMes: string;
  initialDia?: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function defaultMes(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

export default function CompensacionTab({ initialMes, initialDia }: Props) {
  const [mes, setMes] = useState<string>(initialMes || defaultMes());
  const [resumen, setResumen] = useState<CompensacionResumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  const cargar = (m: string) => {
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await generarCompensacionGastosAction(m, initialDia);
        if (res.ok) {
          setResumen(res.data);
        } else {
          setResumen(null);
          if (
            !res.message.includes('No hay gastos') &&
            !res.message.includes('No hay empresas')
          ) {
            toastError(`Error al cargar compensación: ${res.message}`);
          }
        }
      } catch (err) {
        toastError('Error al cargar compensación');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    cargar(mes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const handleDescargarCSV = () => {
    if (!resumen) return;
    try {
      descargarCsvCompensacionGastos(resumen);
      toast.success('CSV descargado');
    } catch (err) {
      toastError(`Error al generar CSV: ${err instanceof Error ? err.message : 'desconocido'}`);
    }
  };

  const handleDescargarPDF = () => {
    if (!resumen) return;
    try {
      generarPdfCompensacionGastos(resumen);
      toast.success('PDF descargado');
    } catch (err) {
      toastError(`Error al generar PDF: ${err instanceof Error ? err.message : 'desconocido'}`);
    }
  };

  return (
    <div className="compensacion-tab flex min-h-0 flex-1 flex-col gap-3 p-3">
      {/* Header con selector de mes y botones de descarga */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-3.5 w-3.5 text-[var(--dashboard-text-muted)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
            Mes
          </span>
          <AppMonthPicker
            value={mes}
            onChange={(val) => setMes(val)}
            className="w-[140px]"
          />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleDescargarCSV}
          disabled={!resumen}
          className="gastos-page-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold"
        >
          <Download className="h-3 w-3" /> CSV
        </button>
        <button
          type="button"
          onClick={handleDescargarPDF}
          disabled={!resumen}
          className="gastos-page-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold"
        >
          <FileText className="h-3 w-3" /> PDF
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[11px] text-[var(--dashboard-text-muted)]">
          <Loader2 className="h-3 w-3 animate-spin" /> Calculando compensación...
        </div>
      )}

      {!loading && !resumen && (
        <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-center text-[11px] text-[var(--dashboard-text-muted)]">
          <Calculator className="h-6 w-6 opacity-40" />
          <p>No hay datos de compensación para mostrar.</p>
          <p className="text-[10px] opacity-70">
            Registra gastos en este mes para ver la compensación entre empresas.
          </p>
        </div>
      )}

      {resumen && (
        <div className="compensacion-content flex min-h-0 flex-1 flex-col gap-3 custom-scrollbar">
          {/* Tabla de compensación */}
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-amber-500/10 text-[var(--dashboard-text)]">
                  <th rowSpan={2} className="border border-white/10 px-2 py-1.5 text-center">
                    Item
                  </th>
                  <th rowSpan={2} className="border border-white/10 px-2 py-1.5 text-left">
                    Descripción
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-white/10 px-2 py-1.5 text-right"
                  >
                    Total
                  </th>
                  {resumen.empresas.map((e) => (
                    <th
                      key={e.id}
                      colSpan={3}
                      className="border border-white/10 px-2 py-1.5 text-center"
                      style={{ color: e.color }}
                    >
                      {e.nombre} ({e.porcentaje}%)
                    </th>
                  ))}
                </tr>
                <tr className="bg-amber-500/5 text-[var(--dashboard-text-muted)]">
                  {resumen.empresas.map((e) => (
                    <Fragment key={e.id}>
                      <th className="border border-white/10 px-2 py-1 text-center text-[9px] font-normal">
                        Real
                      </th>
                      <th className="border border-white/10 px-2 py-1 text-center text-[9px] font-normal">
                        Teórico
                      </th>
                      <th className="border border-white/10 px-2 py-1 text-center text-[9px] font-normal">
                        Comp.
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.categorias.map((cat, i) => (
                  <tr key={cat.nombre} className="hover:bg-white/5">
                    <td className="border border-white/10 px-2 py-1.5 text-center tabular-nums">
                      {i + 1}
                    </td>
                    <td className="border border-white/10 px-2 py-1.5">{cat.nombre}</td>
                    <td className="border border-white/10 px-2 py-1.5 text-right tabular-nums font-semibold">
                      {formatCurrency(cat.total)}
                    </td>
                    {resumen.empresas.map((e) => (
                      <Fragment key={e.id}>
                        <td className="border border-white/10 px-2 py-1.5 text-right tabular-nums">
                          {formatCurrency(cat.gastoRealPorEmpresa[e.id] ?? 0)}
                        </td>
                        <td className="border border-white/10 px-2 py-1.5 text-right tabular-nums text-[var(--dashboard-text-muted)]">
                          {formatCurrency(cat.gastoTeoricoPorEmpresa[e.id] ?? 0)}
                        </td>
                        <td
                          className={`border border-white/10 px-2 py-1.5 text-right tabular-nums font-bold ${
                            (cat.compensacionPorEmpresa[e.id] ?? 0) > 0
                              ? 'text-emerald-400'
                              : (cat.compensacionPorEmpresa[e.id] ?? 0) < 0
                                ? 'text-red-400'
                                : ''
                          }`}
                        >
                          {formatCurrency(cat.compensacionPorEmpresa[e.id] ?? 0)}
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-500/10 font-bold">
                  <td colSpan={2} className="border border-white/10 px-2 py-1.5 text-right">
                    Total
                  </td>
                  <td className="border border-white/10 px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(resumen.totalGasto)}
                  </td>
                  {resumen.empresas.map((e) => (
                    <Fragment key={e.id}>
                      <td className="border border-white/10 px-2 py-1.5 text-right tabular-nums">
                        {formatCurrency(resumen.totalRealPorEmpresa[e.id] ?? 0)}
                      </td>
                      <td className="border border-white/10 px-2 py-1.5 text-right tabular-nums text-[var(--dashboard-text-muted)]">
                        {formatCurrency(resumen.totalTeoricoPorEmpresa[e.id] ?? 0)}
                      </td>
                      <td
                        className={`border border-white/10 px-2 py-1.5 text-right tabular-nums ${
                          (resumen.totalCompensacionPorEmpresa[e.id] ?? 0) > 0
                            ? 'text-emerald-400'
                            : (resumen.totalCompensacionPorEmpresa[e.id] ?? 0) < 0
                              ? 'text-red-400'
                              : ''
                        }`}
                      >
                        {formatCurrency(resumen.totalCompensacionPorEmpresa[e.id] ?? 0)}
                      </td>
                    </Fragment>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Resumen visual: ¿quién le debe a quién? */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-amber-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Resumen de Compensación
              </h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {resumen.empresas.map((e) => {
                const r = resumen.resumenPorEmpresa[e.id];
                if (!r) return null;
                const colorClass =
                  r.estado === 'debe_cobrar'
                    ? 'text-emerald-400 border-emerald-500/30'
                    : r.estado === 'debe_pagar'
                      ? 'text-red-400 border-red-500/30'
                      : 'text-zinc-400 border-zinc-500/30';
                const bgClass =
                  r.estado === 'debe_cobrar'
                    ? 'bg-emerald-500/5'
                    : r.estado === 'debe_pagar'
                      ? 'bg-red-500/5'
                      : 'bg-zinc-500/5';
                const label =
                  r.estado === 'debe_cobrar'
                    ? 'Debe cobrar'
                    : r.estado === 'debe_pagar'
                      ? 'Debe pagar'
                      : 'Equilibrado';
                return (
                  <div
                    key={e.id}
                    className={`flex items-center justify-between rounded-lg border ${colorClass} ${bgClass} px-3 py-2`}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {e.nombre}
                      </p>
                      <p className={`text-base font-bold tabular-nums ${colorClass.split(' ')[0]}`}>
                        {formatCurrency(Math.abs(r.saldo))}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${colorClass.split(' ')[0]} ${bgClass}`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
