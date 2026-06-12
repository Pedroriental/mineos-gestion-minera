'use client';

import { Lock, Users } from 'lucide-react';
import type { RotacionCuadrilla, RotacionPlantillaSandbox } from '@/lib/rotacion-plantillas/types';
import {
  estatusRotacionPreviewClass,
  estatusRotacionShort,
} from '@/lib/rotacion-plantillas/types';
import {
  DEFAULT_COLUMNAS_VISTA,
  labelColumnaVista,
  normalizeColumnasVista,
  type PlantillaColumnaKey,
} from '@/lib/rotacion-plantillas/columnas-vista';
import { NOMINA_DIAS_POR_SEMANA } from '@/lib/nomina-calculo';
import { previewPagoSemanal } from '@/lib/rotacion-plantillas/semana-cierre';

const REF_SALARIO_BASE = 100;
const REF_SALARIO_LIBRE = 100;
/** Columna total — vista previa nómina (modo claro, excepción documentada) */
const TOTAL_COL_HEAD = 'border border-zinc-300 bg-sky-100 px-1 py-0.5 text-center';
const TOTAL_COL_CELL = 'border border-zinc-200 bg-sky-50 px-1.5 py-1 text-right tabular-nums';
const WEEK_HEAD_ROW = 'border border-zinc-300 bg-sky-100 px-1 py-0.5 text-center align-middle';

type Props = {
  sandbox: RotacionPlantillaSandbox;
};

type FilaMontos = {
  filaId: string;
  celdas: { estatus: Parameters<typeof previewPagoSemanal>[0]; monto: number }[];
  totalFila: number;
};

function montoReferencia(estatus: Parameters<typeof previewPagoSemanal>[0]): number {
  const p = previewPagoSemanal(estatus, REF_SALARIO_BASE, REF_SALARIO_LIBRE, 0);
  return p.sueldo + p.bono;
}

function valorColumnaEjemplo(key: PlantillaColumnaKey, estatusLabel: string): string {
  switch (key) {
    case 'nombre':
      return 'Trabajador (ejemplo)';
    case 'cedula':
      return '00.000.000';
    case 'fecha_ingreso':
      return '01/01/2020';
    case 'cargo':
      return 'Cargo';
    case 'estado':
      return estatusLabel || '—';
    case 'area_detalle':
      return '—';
    case 'esquema':
      return '—';
    case 'bono_transporte':
      return '$0.00';
    default:
      return '—';
  }
}

function buildFilasMontos(cuadrilla: RotacionCuadrilla): FilaMontos[] {
  const celdas = cuadrilla.semanas.map((sem) => {
    const estatus = sem.estatusDefault;
    return { estatus, monto: montoReferencia(estatus) };
  });
  const totalFila = celdas.reduce((sum, c) => sum + c.monto, 0);
  return [{ filaId: 'ejemplo', celdas, totalFila }];
}

function CuadrillaPreviewSection({
  cuadrilla,
  columnas,
}: {
  cuadrilla: RotacionCuadrilla;
  columnas: PlantillaColumnaKey[];
}) {
  const semanas = cuadrilla.semanas;
  const dataCols = columnas.filter((k) => k !== 'subtotal_semanal' && k !== 'total_periodo');
  const showSubtotalRow = columnas.includes('subtotal_semanal');
  const showTotalCol = columnas.includes('total_periodo');
  const minTableWidth = Math.max(
    640,
    dataCols.length * 108 + semanas.length * 112 + (showTotalCol ? 96 : 0) + 48,
  );

  if (!semanas.length) {
    return (
      <p className="py-6 text-center text-xs text-zinc-400">
        La cuadrilla &quot;{cuadrilla.nombre}&quot; no tiene semanas definidas.
      </p>
    );
  }

  const filasData = buildFilasMontos(cuadrilla);
  const estatusLabelEjemplo = filasData[0]?.celdas[0]
    ? estatusRotacionShort(filasData[0].celdas[0].estatus)
    : '—';
  const totalesPorSemana = semanas.map((_, weekIdx) =>
    filasData.reduce((sum, fila) => sum + (fila.celdas[weekIdx]?.monto ?? 0), 0),
  );
  const totalColumnaPeriodo = filasData.reduce((sum, fila) => sum + fila.totalFila, 0);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
        <div>
          <h4 className="text-xs font-bold text-zinc-800">{cuadrilla.nombre}</h4>
          {cuadrilla.asignacionKey && (
            <p className="text-[10px] text-zinc-500">{cuadrilla.asignacionKey}</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
          <Users className="h-3 w-3" />
          {semanas.length} sem.
        </span>
      </div>

      <div className="p-3">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ minWidth: minTableWidth }}>
            <thead>
              <tr className="border-b border-zinc-300">
                {dataCols.map((col, colIdx) => (
                  <th
                    key={col}
                    rowSpan={2}
                    className={`min-w-[92px] border border-zinc-300 bg-zinc-50 px-1.5 py-1 text-center text-[9px] font-bold uppercase leading-tight text-zinc-800 ${
                      colIdx === 0 ? 'sticky left-0 z-10' : ''
                    }`}
                  >
                    {labelColumnaVista(col)}
                  </th>
                ))}
                {semanas.map((sem) => (
                  <th key={sem.id} className={`min-w-[100px] ${WEEK_HEAD_ROW}`}>
                    <div className="text-[9px] font-bold leading-tight text-zinc-800">{sem.nombre}</div>
                    <span
                      className={`mt-0.5 inline-flex rounded px-1 py-px text-[8px] font-semibold ${estatusRotacionPreviewClass(sem.estatusDefault)}`}
                    >
                      {estatusRotacionShort(sem.estatusDefault)}
                    </span>
                  </th>
                ))}
                {showTotalCol && (
                  <th
                    rowSpan={2}
                    className={`min-w-[80px] ${TOTAL_COL_HEAD} text-[9px] font-bold leading-tight text-zinc-800`}
                  >
                    Total Nómina (USD)
                  </th>
                )}
                <th
                  rowSpan={2}
                  className="min-w-[28px] border border-zinc-300 bg-zinc-50 px-0.5 py-1 text-center text-zinc-500"
                >
                  <Lock className="mx-auto h-2.5 w-2.5" />
                </th>
              </tr>
              <tr className="border-b border-zinc-300">
                {semanas.map((sem) => (
                  <th
                    key={`${sem.id}-intervalo`}
                    className="border border-zinc-300 bg-sky-100/70 px-1 py-px text-center text-[8px] font-medium italic leading-tight text-zinc-500"
                  >
                    Del … al … (al cargar periodo)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasData.map((fila) => (
                <tr key={fila.filaId} className="border-b border-zinc-100 bg-amber-50/30">
                  {dataCols.map((col, colIdx) => (
                    <td
                      key={col}
                      className={`px-2 py-2 text-zinc-800 ${
                        colIdx === 0 ? 'sticky left-0 z-[1] bg-inherit font-medium' : ''
                      } ${col === 'cedula' ? 'tabular-nums' : ''} ${col === 'nombre' ? 'italic text-zinc-500' : ''}`}
                    >
                      {valorColumnaEjemplo(col, estatusLabelEjemplo)}
                    </td>
                  ))}
                  {fila.celdas.map((cell, i) => (
                    <td key={semanas[i].id} className="px-1.5 py-2 text-center">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${estatusRotacionPreviewClass(cell.estatus)}`}
                      >
                        {estatusRotacionShort(cell.estatus)}
                      </span>
                      <div className="mt-0.5 text-[9px] tabular-nums text-zinc-500">
                        ${cell.monto.toFixed(2)}
                      </div>
                    </td>
                  ))}
                  {showTotalCol && (
                    <td className={`${TOTAL_COL_CELL} text-[10px] font-semibold text-zinc-800`}>
                      ${fila.totalFila.toFixed(2)}
                    </td>
                  )}
                  <td className="px-1 py-2 text-center text-zinc-300">—</td>
                </tr>
              ))}
            </tbody>
            {(showSubtotalRow || showTotalCol) && (
              <tfoot>
                <tr className="border-t-2 border-zinc-300 bg-zinc-100/90 font-semibold text-zinc-800">
                  <td
                    colSpan={dataCols.length}
                    className="sticky left-0 z-[1] bg-zinc-100/95 px-2 py-2 text-[10px] uppercase tracking-wide"
                  >
                    {showSubtotalRow ? 'Subtotal semanal' : 'Total general'}
                  </td>
                  {showSubtotalRow
                    ? totalesPorSemana.map((total, i) => (
                        <td
                          key={semanas[i].id}
                          className="px-1.5 py-2 text-center text-[11px] tabular-nums text-zinc-800"
                        >
                          ${total.toFixed(2)}
                        </td>
                      ))
                    : semanas.map((sem) => <td key={sem.id} />)}
                  {showTotalCol && (
                    <td className={`${TOTAL_COL_CELL} text-[10px] font-bold text-zinc-900`}>
                      ${totalColumnaPeriodo.toFixed(2)}
                    </td>
                  )}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </section>
  );
}

export function RotacionPlantillaPreview({ sandbox }: Props) {
  const cuadrillas = sandbox.cuadrillas;
  const columnas = normalizeColumnasVista(sandbox.columnasVista ?? DEFAULT_COLUMNAS_VISTA);

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-xl border border-zinc-200 bg-zinc-100/80 text-zinc-900 shadow-inner">
      <div className="border-b border-zinc-200 bg-white px-5 py-3.5">
        <h3 className="text-sm font-semibold text-zinc-800">Vista previa — forma de la plantilla</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          {sandbox.nombre.trim() || 'Sin nombre'} · {cuadrillas.length} cuadrilla(s) · {columnas.length}{' '}
          columna(s) de datos
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {cuadrillas.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-400">
            Agregue cuadrillas (Vertical 1, Cocina, Admin…) en el panel izquierdo.
          </p>
        ) : (
          cuadrillas.map((c) => (
            <CuadrillaPreviewSection key={c.id} cuadrilla={c} columnas={columnas} />
          ))
        )}

        {cuadrillas.length > 0 && (
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Encabezados de semana en dos filas (título + intervalo de fechas al cargar el periodo). Subtotal
            por semana en fila al pie; total del ciclo por trabajador en columna. Montos de referencia (
            {NOMINA_DIAS_POR_SEMANA} días laborales).
          </p>
        )}
      </div>
    </div>
  );
}

export { ESTATUS_ROTACION_OPCIONES } from '@/lib/rotacion-plantillas/types';
