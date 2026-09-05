'use client';

import type { NominaPreviewReport } from '@/lib/nomina-preview';
import { displayNombrePersonal } from '@/lib/personal-master';
import {
  splitNominaByDivisiones,
  formatNominaDivisionLabel,
  type NominaDivisionParam,
} from '@/lib/reconciliation/nomina-divisiones';

function fmtMoney(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

const AREA_LABEL: Record<string, string> = {
  mina: 'Mina',
  planta: 'Molinos',
  administracion: 'Administración',
};

type Props = {
  report: NominaPreviewReport;
  divisiones?: NominaDivisionParam[];
};

export default function NominaPreviewReport({
  report,
  divisiones = [],
}: Props) {
  const detailColSpan = 5 + report.weekColumns.length;
  const summaryCols = 2 + divisiones.length;
  const grandSplits = splitNominaByDivisiones(report.grandTotal, divisiones);

  return (
    <div className="nomina-preview-report nomina-preview-report--light flex flex-col gap-6 text-[13px] text-slate-900">
      <div className="text-[11px] leading-snug text-slate-600">
        <details className="group">
          <summary className="inline cursor-pointer list-none font-medium text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
            Leyenda
            <span className="ml-1 text-slate-400 group-open:hidden">▸</span>
            <span className="ml-1 hidden text-slate-400 group-open:inline">▾</span>
          </summary>
          <p className="mt-1 text-slate-600">
            <span className="text-emerald-700">● cerrado</span> = semana procesada;{' '}
            <span className="text-amber-700">sin marca</span> = estimado por rotación. Las columnas Parte
            reparten cada total según el % configurado en Ajustes.
          </p>
        </details>
      </div>

      <div className="overflow-x-auto rounded-md border-2 border-slate-800 bg-white shadow-sm">
        <table className="w-full min-w-[320px] border-collapse text-center">
          <thead>
            <tr>
              <th
                colSpan={summaryCols}
                className="border border-slate-700 bg-[#b4d4f0] px-3 py-2 text-sm font-bold text-slate-900"
              >
                <div>{report.periodLabel}</div>
                {report.weekColumns.length > 0 ? (
                  <div className="mt-0.5 text-[10px] font-medium normal-case text-slate-700">
                    {fmtDate(report.rangeStart)} — {fmtDate(report.rangeEnd)} ·{' '}
                    {report.weekColumns.length} columna
                    {report.weekColumns.length === 1 ? '' : 's'}
                  </div>
                ) : null}
              </th>
            </tr>
            <tr>
              <th className="border border-slate-600 bg-[#b4d4f0] px-3 py-1.5 text-xs font-bold text-slate-900">
                Concepto
              </th>
              <th className="border border-slate-600 bg-[#b4d4f0] px-3 py-1.5 text-xs font-bold text-slate-900">
                Total Nóminas (USD)
              </th>
              {divisiones.map((d) => (
                <th
                  key={d.id}
                  className="min-w-[4.5rem] border border-slate-600 bg-[#dceaf8] px-2 py-1.5 text-xs font-bold text-slate-900"
                >
                  {formatNominaDivisionLabel(d.porcentaje)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.summary.map((row) => {
              const splits = splitNominaByDivisiones(row.total, divisiones);
              return (
                <tr key={row.id} className="bg-white">
                  <td className="border border-slate-400 px-3 py-1.5 text-left font-medium text-slate-800">
                    {row.label}
                  </td>
                  <td className="border border-slate-400 px-3 py-1.5 text-right tabular-nums font-semibold text-amber-800">
                    {fmtMoney(row.total)}
                  </td>
                  {splits.map((part) => (
                    <td
                      key={part.id}
                      className="border border-slate-400 bg-slate-50/60 px-2 py-1.5 text-right tabular-nums text-slate-800"
                    >
                      {fmtMoney(part.montoUsd)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="bg-amber-50 font-bold">
              <td className="border border-slate-600 px-3 py-2 text-left text-slate-900">Total Nómina</td>
              <td className="border border-slate-600 px-3 py-2 text-right tabular-nums text-amber-900">
                {fmtMoney(report.grandTotal)}
              </td>
              {grandSplits.map((part) => (
                <td
                  key={part.id}
                  className="border border-slate-600 bg-amber-100/50 px-2 py-2 text-right tabular-nums text-slate-900"
                >
                  {fmtMoney(part.montoUsd)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {report.sections.map((section) => (
        <div key={section.id} className="overflow-x-auto rounded-md border-2 border-slate-800 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th
                  colSpan={detailColSpan}
                  className="border border-slate-700 bg-[#b4d4f0] px-3 py-2 text-left text-sm font-bold text-slate-900"
                >
                  <div>{section.title}</div>
                  <div className="mt-0.5 text-[10px] font-medium normal-case text-slate-700">
                    {report.periodLabel}
                  </div>
                </th>
              </tr>
              <tr className="bg-[#b4d4f0] text-[11px] font-bold text-slate-900">
                <th className="border border-slate-600 px-2 py-1.5 text-left">Nombres</th>
                <th className="border border-slate-600 px-2 py-1.5 text-left">C.I.</th>
                <th className="border border-slate-600 px-2 py-1.5 text-left">Fecha de Ingreso</th>
                {report.weekColumns.map((w) => (
                  <th
                    key={w.weekStart}
                    className="min-w-[7.5rem] border border-slate-600 px-2 py-1.5 text-center text-[10px] leading-tight"
                    title={
                      w.isPartialInRange
                        ? `Semana de nómina ${fmtDate(w.weekStart)}–${fmtDate(w.weekEnd)}; visible ${fmtDate(w.displayStart)}–${fmtDate(w.displayEnd)}`
                        : `Semana ${fmtDate(w.weekStart)} al ${fmtDate(w.weekEnd)}`
                    }
                  >
                    {w.header}
                    {w.isPartialInRange ? (
                      <span className="mt-0.5 block text-[8px] font-medium text-slate-600">
                        parcial
                      </span>
                    ) : null}
                  </th>
                ))}
                <th className="min-w-[8rem] border border-slate-600 px-2 py-1.5 text-left">
                  Observaciones
                </th>
                <th className="border border-slate-600 px-2 py-1.5 text-right">
                  {report.weekColumns.length > 1 ? 'Total Rotación (USD)' : 'Total Nómina (USD)'}
                </th>
              </tr>
            </thead>
            <tbody>
              {section.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={detailColSpan}
                    className="border border-slate-300 px-3 py-6 text-center text-slate-500"
                  >
                    Sin personal en esta sección para el periodo.
                  </td>
                </tr>
              ) : (
                <>
                  {section.rows.map((row) => (
                    <tr key={row.personal.id} className="bg-white hover:bg-slate-50">
                      <td className="border border-slate-300 px-2 py-1.5 font-medium text-slate-900">
                        {displayNombrePersonal(row.personal)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums text-slate-700">
                        {row.personal.cedula || '—'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-slate-600">
                        {fmtDate(row.personal.fecha_ingreso || '')}
                      </td>
                      {report.weekColumns.map((w) => {
                        const cell = row.weeks[w.weekStart];
                        const isLibre = cell?.estado === 'libre';
                        const isCerrada = cell?.source === 'cerrada';
                        return (
                          <td
                            key={w.weekStart}
                            className={`border border-slate-300 px-2 py-1.5 text-right tabular-nums ${
                              isLibre ? 'text-sky-700' : 'text-slate-800'
                            }`}
                            title={
                              cell
                                ? `${cell.estado} · ${
                                    isCerrada
                                      ? 'Registrado al cerrar nómina'
                                      : 'Calculado (semana aún no cerrada)'
                                  }`
                                : ''
                            }
                          >
                            {cell && cell.amount > 0 ? fmtMoney(cell.amount) : '—'}
                            {isCerrada ? (
                              <span className="ml-1 text-[9px] text-emerald-600" title="Cerrada">
                                ●
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="max-w-[14rem] border border-slate-300 px-2 py-1.5 text-left text-[11px] leading-snug text-slate-600">
                        {row.observaciones}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold tabular-nums text-amber-800">
                        {fmtMoney(row.total)}
                      </td>
                    </tr>
                  ))}
                  {/* Fila de Cierre Semanal Vertical */}
                  <tr className="bg-slate-50 font-bold border-t border-slate-300">
                    <td
                      colSpan={3}
                      className="border border-slate-300 px-2 py-1.5 text-left text-slate-700 font-bold"
                    >
                      Cierre Semanal (USD)
                    </td>
                    {report.weekColumns.map((w) => {
                      const weekTotal = section.rows.reduce(
                        (sum, r) => sum + (r.weeks[w.weekStart]?.amount || 0),
                        0,
                      );
                      return (
                        <td
                          key={w.weekStart}
                          className="border border-slate-300 px-2 py-1.5 text-right tabular-nums text-slate-800"
                        >
                          {weekTotal > 0 ? fmtMoney(weekTotal) : '—'}
                        </td>
                      );
                    })}
                    <td className="border border-slate-300 px-2 py-1.5 text-left text-slate-400">
                      —
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums text-amber-900 font-extrabold bg-amber-50/20">
                      {fmtMoney(section.sectionTotal)}
                    </td>
                  </tr>
                </>
              )}
              <tr className="bg-slate-100 font-bold">
                <td
                  colSpan={detailColSpan - 1}
                  className="border border-slate-500 px-2 py-1.5 text-right text-slate-700"
                >
                  Subtotal {section.title}
                </td>
                <td className="border border-slate-500 px-2 py-1.5 text-right tabular-nums text-amber-900">
                  {fmtMoney(section.sectionTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <div className="overflow-x-auto rounded-md border-2 border-slate-800 bg-white shadow-sm">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr>
              <th
                colSpan={6}
                className="border border-slate-700 bg-[#fde68a] px-3 py-2 text-left text-sm font-bold text-slate-900"
              >
                Novedades del periodo
              </th>
            </tr>
            <tr className="bg-[#fde68a] text-[11px] font-bold text-slate-900">
              <th className="border border-slate-600 px-2 py-1.5 text-left">Nombre</th>
              <th className="border border-slate-600 px-2 py-1.5 text-left">C.I.</th>
              <th className="border border-slate-600 px-2 py-1.5 text-left">Área</th>
              <th className="border border-slate-600 px-2 py-1.5 text-left">Tipo</th>
              <th className="border border-slate-600 px-2 py-1.5 text-left">Detalle</th>
              <th className="border border-slate-600 px-2 py-1.5 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.novedades.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border border-slate-300 px-3 py-5 text-center text-slate-500"
                >
                  Sin novedades registradas para este periodo.
                </td>
              </tr>
            ) : (
              report.novedades.map((n) => (
                <tr key={n.id} className="bg-white hover:bg-amber-50/40">
                  <td className="border border-slate-300 px-2 py-1.5 font-medium text-slate-900">
                    {n.nombre}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 tabular-nums text-slate-700">
                    {n.cedula}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-slate-700">
                    {AREA_LABEL[n.area] || n.area}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 font-medium text-amber-900">
                    {n.tipo}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-[11px] text-slate-600">
                    {n.detalle}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold tabular-nums text-slate-900">
                    {typeof n.monto === 'number' && n.monto > 0 ? `$${fmtMoney(n.monto)}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="border-t border-slate-300 bg-amber-50/60 px-3 py-1.5 text-[10px] text-slate-600">
          Reposos, vacaciones, retiros y observaciones de estado laboral dentro del rango seleccionado.
        </p>
      </div>
    </div>
  );
}
