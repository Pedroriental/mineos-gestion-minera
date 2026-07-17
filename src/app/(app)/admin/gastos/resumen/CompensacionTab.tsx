'use client';

import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { Calculator, ChevronDown, Download, FileText, Loader2, Users } from 'lucide-react';
import { AppMonthPicker } from '@/components/ui/AppMonthPicker';
import {
  generarCompensacionGastosAction,
  generarGastosEmpresaAction,
} from '@/lib/actions/compensacion-gastos';
import { formatCurrency, type CompensacionResumen } from '@/lib/compensacion-gastos';
import { generarPdfCompensacionGastos } from '@/lib/reportes/compensacion-gastos-pdf';
import { generarPdfEmpresa } from '@/lib/reportes/compensacion-empresa-pdf';
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
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPdfOpen(false);
      }
    };
    if (pdfOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pdfOpen]);

  const handleDescargarCSV = () => {
    if (!resumen) return;
    try {
      descargarCsvCompensacionGastos(resumen);
      toast.success('CSV descargado');
    } catch (err) {
      toastError(`Error al generar CSV: ${err instanceof Error ? err.message : 'desconocido'}`);
    }
  };

  const handleDescargarPDFGlobal = () => {
    if (!resumen) return;
    try {
      generarPdfCompensacionGastos(resumen);
      toast.success('PDF Global descargado');
    } catch (err) {
      toastError(`Error al generar PDF: ${err instanceof Error ? err.message : 'desconocido'}`);
    }
    setPdfOpen(false);
  };

  const handleDescargarPDFEmpresa = async (empresaId: string, empresaNombre: string) => {
    setPdfLoadingId(empresaId);
    setPdfOpen(false);
    try {
      const res = await generarGastosEmpresaAction(mes, empresaId, initialDia);
      if (res.ok) {
        generarPdfEmpresa(res.data);
        toast.success(`PDF de ${empresaNombre} descargado`);
      } else {
        toastError(`Error: ${res.message}`);
      }
    } catch (err) {
      toastError(`Error al generar PDF: ${err instanceof Error ? err.message : 'desconocido'}`);
    } finally {
      setPdfLoadingId(null);
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

        {/* PDF Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setPdfOpen((o) => !o)}
            disabled={!resumen}
            className="gastos-page-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold"
          >
            {pdfLoadingId ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            PDF
            <ChevronDown
              className={`h-2.5 w-2.5 transition-transform duration-150 ${
                pdfOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {pdfOpen && resumen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] shadow-xl"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
            >
              {/* Global */}
              <button
                type="button"
                onClick={handleDescargarPDFGlobal}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-semibold transition-colors hover:bg-[var(--dashboard-accent)]/10"
              >
                <FileText className="h-3 w-3 text-[var(--dashboard-text-muted)]" />
                <span className="text-[var(--dashboard-text)]">Compensación Global</span>
              </button>

              {/* Separador */}
              <div className="my-0.5 h-px bg-[var(--dashboard-border)]" />

              {/* Un botón por empresa */}
              {resumen.empresas.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => handleDescargarPDFEmpresa(e.id, e.nombre)}
                  disabled={pdfLoadingId === e.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-semibold transition-colors hover:bg-[var(--dashboard-accent)]/10 disabled:opacity-50"
                >
                  {pdfLoadingId === e.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" style={{ color: e.color }} />
                  ) : (
                    <FileText className="h-3 w-3" style={{ color: e.color }} />
                  )}
                  <span style={{ color: e.color }}>
                    Informe {e.nombre}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
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
          <div className="overflow-x-auto rounded-lg border border-[var(--dashboard-border)]">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-[var(--dashboard-accent)]/10 text-[var(--dashboard-text)]">
                  <th rowSpan={2} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-center">
                    Item
                  </th>
                  <th rowSpan={2} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-left">
                    Descripción del Gasto
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-[var(--dashboard-border)] px-2 py-1.5 text-right font-bold"
                  >
                    Total
                  </th>
                  <th colSpan={resumen.empresas.length} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-center font-bold">
                    Gasto Real
                  </th>
                  <th colSpan={resumen.empresas.length} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-center font-bold">
                    Gasto Teórico
                  </th>
                  <th colSpan={resumen.empresas.length} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-center font-bold">
                    Compensación de Gastos
                  </th>
                </tr>
                <tr className="bg-[var(--dashboard-accent)]/5 text-[var(--dashboard-text-muted)]">
                  {/* Real columns */}
                  {resumen.empresas.map((e) => (
                    <th key={`real-${e.id}`} className="border border-[var(--dashboard-border)] px-2 py-1 text-center text-[9px] font-semibold" style={{ color: e.color }}>
                      {e.nombre}
                    </th>
                  ))}
                  {/* Teórico columns */}
                  {resumen.empresas.map((e) => (
                    <th key={`teorico-${e.id}`} className="border border-[var(--dashboard-border)] px-2 py-1 text-center text-[9px] font-semibold" style={{ color: e.color }}>
                      {e.nombre}
                    </th>
                  ))}
                  {/* Comp columns */}
                  {resumen.empresas.map((e) => (
                    <th key={`comp-${e.id}`} className="border border-[var(--dashboard-border)] px-2 py-1 text-center text-[9px] font-semibold" style={{ color: e.color }}>
                      {e.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.categorias.map((cat, i) => (
                  <tr key={cat.nombre} className="hover:bg-white/5">
                    <td className="border border-[var(--dashboard-border)] px-2 py-1.5 text-center tabular-nums">
                      {i + 1}
                    </td>
                    <td className="border border-[var(--dashboard-border)] px-2 py-1.5">{cat.nombre}</td>
                    <td className="border border-[var(--dashboard-border)] px-2 py-1.5 text-right tabular-nums font-semibold">
                      {formatCurrency(cat.total)}
                    </td>
                    
                    {/* Gasto Real */}
                    {resumen.empresas.map((e) => (
                      <td key={`real-val-${e.id}`} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-right tabular-nums">
                        {formatCurrency(cat.gastoRealPorEmpresa[e.id] ?? 0)}
                      </td>
                    ))}

                    {/* Gasto Teórico */}
                    {resumen.empresas.map((e) => (
                      <td key={`teorico-val-${e.id}`} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-right tabular-nums text-[var(--dashboard-text-muted)]">
                        {formatCurrency(cat.gastoTeoricoPorEmpresa[e.id] ?? 0)}
                      </td>
                    ))}

                    {/* Compensación */}
                    {resumen.empresas.map((e) => {
                      const comp = cat.compensacionPorEmpresa[e.id] ?? 0;
                      return (
                        <td
                          key={`comp-val-${e.id}`}
                          className={`border border-[var(--dashboard-border)] px-2 py-1.5 text-right tabular-nums font-bold ${
                            comp > 0
                              ? 'text-[var(--mineos-benefit-bright)]'
                              : comp < 0
                                ? 'text-[var(--mineos-expense-bright)]'
                                : ''
                          }`}
                        >
                          {comp > 0 ? '+' : ''}{formatCurrency(comp)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--dashboard-accent)]/10 font-bold">
                  <td colSpan={2} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-right">
                    Total
                  </td>
                  <td className="border border-[var(--dashboard-border)] px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(resumen.totalGasto)}
                  </td>
                  
                  {/* Real Totals */}
                  {resumen.empresas.map((e) => (
                    <td key={`real-tot-${e.id}`} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-right tabular-nums">
                      {formatCurrency(resumen.totalRealPorEmpresa[e.id] ?? 0)}
                    </td>
                  ))}

                  {/* Teórico Totals */}
                  {resumen.empresas.map((e) => (
                    <td key={`teorico-tot-${e.id}`} className="border border-[var(--dashboard-border)] px-2 py-1.5 text-right tabular-nums text-[var(--dashboard-text-muted)]">
                      {formatCurrency(resumen.totalTeoricoPorEmpresa[e.id] ?? 0)}
                    </td>
                  ))}

                  {/* Compensación Totales */}
                  {resumen.empresas.map((e) => {
                    const comp = resumen.totalCompensacionPorEmpresa[e.id] ?? 0;
                    return (
                      <td
                        key={`comp-tot-${e.id}`}
                        className={`border border-[var(--dashboard-border)] px-2 py-1.5 text-right tabular-nums ${
                          comp > 0
                            ? 'text-[var(--mineos-benefit-bright)]'
                            : comp < 0
                              ? 'text-[var(--mineos-expense-bright)]'
                              : ''
                        }`}
                      >
                        {comp > 0 ? '+' : ''}{formatCurrency(comp)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Resumen visual: ¿quién le debe a quién? */}
          <div className="rounded-lg border border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--mineos-general-bright)]">
                Resumen de Compensación
              </h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {resumen.empresas.map((e) => {
                const r = resumen.resumenPorEmpresa[e.id];
                if (!r) return null;
                const label =
                  r.estado === 'debe_cobrar'
                    ? 'Debe cobrar'
                    : r.estado === 'debe_pagar'
                      ? 'Debe pagar'
                      : 'Equilibrado';

                const tokenMap = {
                  debe_cobrar: {
                    text: 'var(--mineos-benefit-bright)',
                    border: 'var(--mineos-benefit-border)',
                    bg: 'var(--mineos-benefit-soft)',
                  },
                  debe_pagar: {
                    text: 'var(--mineos-expense-bright)',
                    border: 'var(--mineos-expense-border)',
                    bg: 'var(--mineos-expense-soft)',
                  },
                  equilibrado: {
                    text: 'var(--mineos-neutral-muted)',
                    border: 'var(--dashboard-border)',
                    bg: 'var(--dashboard-background)',
                  },
                } as const;

                const t = tokenMap[r.estado];

                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                    style={{ color: t.text, borderColor: t.border, background: t.bg }}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {e.nombre}
                      </p>
                      <p className="text-base font-bold tabular-nums">
                        {formatCurrency(Math.abs(r.saldo))}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                      style={{ color: t.text, background: t.bg }}
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
