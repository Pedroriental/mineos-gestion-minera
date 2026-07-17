'use client';

import { useEffect, useState, useTransition } from 'react';
import { Download, FileText, Loader2, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { AppMonthPicker } from '@/components/ui/AppMonthPicker';
import { generarBalanceProdGastosAction, type BalanceProdGastosResumen } from '@/lib/actions/compensacion-gastos';
import { generarPdfBalanceProdGastos } from '@/lib/reportes/balance-prod-gastos-pdf';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';

type Props = {
  initialMes: string;
  initialDia?: string | null;
};

// UUID de La Fé en base de datos
const LA_FE_ID = 'eb283419-a0ff-4543-9199-55bdc1cdc295';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtNum = (n: number, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);

export default function BalanceProdGastosTab({ initialMes, initialDia }: Props) {
  const [mes, setMes] = useState<string>(initialMes || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }));
  const [balance, setBalance] = useState<BalanceProdGastosResumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [, startTransition] = useTransition();

  const cargar = (m: string) => {
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await generarBalanceProdGastosAction(m, LA_FE_ID, initialDia);
        if (res.ok) {
          setBalance(res.data);
        } else {
          setBalance(null);
          if (!res.message.includes('No hay gastos') && !res.message.includes('producción')) {
            toastError(`Error al cargar balance: ${res.message}`);
          }
        }
      } catch (err) {
        toastError('Error al cargar balance');
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

  const handleDescargarPDF = () => {
    if (!balance) return;
    setPdfLoading(true);
    try {
      generarPdfBalanceProdGastos(balance);
      toast.success('PDF de Balance descargado con éxito');
    } catch (err) {
      toastError(`Error al generar PDF: ${err instanceof Error ? err.message : 'desconocido'}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const isGanancia = balance ? balance.balanceNetoAjustado >= 0 : false;

  return (
    <div className="compensacion-tab flex min-h-0 flex-1 flex-col gap-3 p-3">
      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">Mes:</span>
            <AppMonthPicker
              value={mes}
              onChange={(val) => setMes(val)}
              className="w-40"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleDescargarPDF}
          disabled={!balance || pdfLoading}
          className="flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Descargar PDF Balance
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="mt-2 text-sm text-[var(--dashboard-text-muted)]">Cargando balance comparativo...</p>
        </div>
      ) : !balance ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--dashboard-border)] p-12 text-center">
          <Scale className="h-12 w-12 text-[var(--dashboard-text-muted)] opacity-55" />
          <p className="mt-3 text-sm font-semibold text-[var(--dashboard-text)]">No hay datos suficientes</p>
          <p className="mt-1 text-xs text-[var(--dashboard-text-muted)]">
            Asegúrate de que existan registros de producción y gastos para el período seleccionado.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {/* Rejilla de KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI 1: Producción de Oro */}
            <div className="relative overflow-hidden rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Oro Producido Total
              </p>
              <p className="mt-1 text-2xl font-black text-amber-400">
                {fmtNum(balance.produccion.oroGranTotal, 4)} g
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--dashboard-text-muted)]">
                Molinos: {fmtNum(balance.produccion.totalOroRecuperado, 2)}g | Planchas: {fmtNum(balance.produccion.oroQuemadoPlanchas, 2)}g
              </p>
            </div>

            {/* KPI 2: Valor Oro (Cuota La Fe) */}
            <div className="relative overflow-hidden rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Valor Oro La Fe ({balance.empresa.porcentaje}%)
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--dashboard-text)]">
                {fmt(balance.produccion.valorOroEmpresa)}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--dashboard-text-muted)]">
                Valor total: {fmt(balance.produccion.valorOroGranTotal)}
              </p>
            </div>

            {/* KPI 3: Gastos Netos Ajustados */}
            <div className="relative overflow-hidden rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Gastos Netos Ajustados La Fe
              </p>
              <p className="mt-1 text-2xl font-black text-rose-400">
                {fmt(balance.gastos.totalGastado - balance.gastos.compensacion.saldo)}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--dashboard-text-muted)]">
                Real: {fmt(balance.gastos.totalGastado)} | Ajuste: {balance.gastos.compensacion.saldo >= 0 ? '+' : ''}{fmt(balance.gastos.compensacion.saldo)}
              </p>
            </div>

            {/* KPI 4: Balance Neto Final */}
            <div className={`relative overflow-hidden rounded-xl border p-4 ${
              isGanancia 
                ? 'border-emerald-500/30 bg-emerald-500/5' 
                : 'border-rose-500/30 bg-rose-500/5'
            }`}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Balance Neto (Resultado)
              </p>
              <div className="flex items-baseline gap-2">
                <p className={`mt-1 text-2xl font-black ${isGanancia ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isGanancia ? '+' : ''}{fmt(balance.balanceNetoAjustado)}
                </p>
                {isGanancia ? (
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-rose-400" />
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--dashboard-text-muted)]">
                {isGanancia ? 'Superávit / Rentabilidad favorable' : 'Déficit respecto a producción'}
              </p>
            </div>
          </div>

          {/* Gráfico / Detalle de Tablas */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Tabla Producción por Origen */}
            <div className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--dashboard-text)]">
                Producción por Origen
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--dashboard-border)] text-[10px] font-bold uppercase text-[var(--dashboard-text-muted)]">
                      <th className="py-2">Origen</th>
                      <th className="py-2 text-right">Tons.</th>
                      <th className="py-2 text-right">Tenor (g/T)</th>
                      <th className="py-2 text-right">Oro (g)</th>
                      <th className="py-2 text-right">% Au</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--dashboard-border)]">
                    {balance.produccion.origenResumen.map((o) => (
                      <tr key={o.origen} className="hover:bg-[var(--dashboard-card-hover)]">
                        <td className="py-2 font-medium">{o.origen}</td>
                        <td className="py-2 text-right tabular-nums">{fmtNum(o.totalTon, 2)} T</td>
                        <td className="py-2 text-right tabular-nums">{fmtNum(o.tenor, 3)}</td>
                        <td className="py-2 text-right tabular-nums font-bold text-amber-400">{fmtNum(o.totalOro, 2)} g</td>
                        <td className="py-2 text-right tabular-nums">{fmtNum(o.pctTotal, 1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla Resumen de Gastos */}
            <div className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card-bg)] p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--dashboard-text)]">
                Gastos por Categoria
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--dashboard-border)] text-[10px] font-bold uppercase text-[var(--dashboard-text-muted)]">
                      <th className="py-2">Categoria</th>
                      <th className="py-2 text-right">Gasto Total</th>
                      <th className="py-2 text-right">Aportado La Fe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--dashboard-border)]">
                    {Object.entries(
                      balance.gastos.gastos.reduce((acc, g) => {
                        if (!acc[g.categoria]) acc[g.categoria] = { total: 0, pagado: 0 };
                        acc[g.categoria].total += g.montoTotal;
                        acc[g.categoria].pagado += g.montoPagado;
                        return acc;
                      }, {} as Record<string, { total: number; pagado: number }>)
                    ).map(([cat, vals]) => (
                      <tr key={cat} className="hover:bg-[var(--dashboard-card-hover)]">
                        <td className="py-2 font-medium">{cat}</td>
                        <td className="py-2 text-right tabular-nums">{fmt(vals.total)}</td>
                        <td className="py-2 text-right tabular-nums font-bold text-rose-400">{fmt(vals.pagado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
