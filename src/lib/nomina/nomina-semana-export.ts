import { describeNovedadTurnoSemana } from '@/lib/nomina-novedad-turno';
import type { DistribucionLinea } from '@/lib/nomina-distribucion';

export type NominaSemanaExportRow = {
  personal: {
    nombre_completo: string;
    cedula: string;
    cargo: string;
    area_detalle?: string | null;
  };
  estadoAsistencia: 'trabajada' | 'libre' | 'no_laborado';
  diasTrabajados: number;
  novedadTurno: import('@/lib/nomina-novedad-turno').NominaNovedadTurno;
  novedadTurnoObs?: string;
  reposoCondicion?: import('@/lib/nomina-novedad-turno').ReposoModoSueldoSemana | null;
  reposoDiasPagados?: number;
  salarioBaseCalculado: number;
  bonoTransporte: number;
  bonificaciones: number;
  deducciones: number;
  totalVales: number;
  total: number;
};

export type NominaSemanaExportMeta = {
  area: string;
  areaLabel: string;
  weekStart: string;
  weekEnd: string;
  cerrada: boolean;
  workerCount: number;
  totalSemana: number;
  generatedAt?: Date;
};

const ESTADO_LABEL: Record<NominaSemanaExportRow['estadoAsistencia'], string> = {
  trabajada: 'Labor',
  libre: 'Libre',
  no_laborado: 'Sin labor',
};

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rowNovedad(row: NominaSemanaExportRow): string {
  if (row.novedadTurno === 'ACTIVO' && !row.novedadTurnoObs?.trim()) return '—';
  return describeNovedadTurnoSemana(row);
}

export function buildNominaSemanaCsv(
  rows: NominaSemanaExportRow[],
  meta: NominaSemanaExportMeta,
): string {
  const headers = [
    'Nombre',
    'Cédula',
    'Cargo',
    'Vertical/Sector',
    'Estado',
    'Días',
    'Novedad turno',
    'Sueldo base',
    'Bono transporte',
    'Bonos',
    'Deducciones',
    'Vales',
    'Total neto',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const p = row.personal;
    lines.push(
      [
        `"${(p.nombre_completo || '').replace(/"/g, '""')}"`,
        p.cedula,
        `"${(p.cargo || '').replace(/"/g, '""')}"`,
        `"${(p.area_detalle || '').replace(/"/g, '""')}"`,
        ESTADO_LABEL[row.estadoAsistencia],
        String(row.diasTrabajados),
        `"${rowNovedad(row).replace(/"/g, '""')}"`,
        row.salarioBaseCalculado.toFixed(2),
        row.bonoTransporte.toFixed(2),
        row.bonificaciones.toFixed(2),
        row.deducciones.toFixed(2),
        row.totalVales.toFixed(2),
        row.total.toFixed(2),
      ].join(','),
    );
  }
  lines.push('');
  lines.push(`"Total semana (${meta.areaLabel})",,,,,,,,,,,"${meta.totalSemana.toFixed(2)}"`);
  lines.push(`"Periodo","${fmtDate(meta.weekStart)} — ${fmtDate(meta.weekEnd)}"`);
  lines.push(`"Estado","${meta.cerrada ? 'Cerrada' : 'Pendiente'}"`);
  return lines.join('\n');
}

export function downloadNominaSemanaCsv(
  rows: NominaSemanaExportRow[],
  meta: NominaSemanaExportMeta,
): void {
  const csv = buildNominaSemanaCsv(rows, meta);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nomina_${meta.area}_${meta.weekStart}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildNominaSemanaPrintHtml(
  rows: NominaSemanaExportRow[],
  meta: NominaSemanaExportMeta,
  distribucion: DistribucionLinea[] = [],
): string {
  const generated = (meta.generatedAt ?? new Date()).toLocaleString('es-VE');
  const statusLabel = meta.cerrada ? 'Cerrada' : 'Pendiente de cierre';
  const statusClass = meta.cerrada ? 'status-closed' : 'status-open';

  const tableRows = rows
    .map((row, i) => {
      const p = row.personal;
      return `<tr>
        <td class="num">${i + 1}</td>
        <td><strong>${escapeHtml(p.nombre_completo)}</strong></td>
        <td>${escapeHtml(p.cedula)}</td>
        <td>${escapeHtml(p.cargo || '—')}</td>
        <td>${escapeHtml(p.area_detalle || '—')}</td>
        <td>${ESTADO_LABEL[row.estadoAsistencia]}</td>
        <td class="num">${row.diasTrabajados}</td>
        <td class="obs">${escapeHtml(rowNovedad(row))}</td>
        <td class="money">${row.salarioBaseCalculado.toFixed(2)}</td>
        <td class="money">${row.bonoTransporte.toFixed(2)}</td>
        <td class="money">${row.bonificaciones.toFixed(2)}</td>
        <td class="money">${row.deducciones.toFixed(2)}</td>
        <td class="money">${row.totalVales.toFixed(2)}</td>
        <td class="money total">${row.total.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const distRows =
    distribucion.length > 0
      ? distribucion
          .map(
            (l) =>
              `<tr><td>${escapeHtml(l.nombre)}</td><td class="num">${l.porcentaje}%</td><td class="money">${l.bruto.toFixed(2)}</td><td class="money">${l.pagoDirecto.toFixed(2)}</td><td class="money total">${l.neto.toFixed(2)}</td></tr>`,
          )
          .join('')
      : '';

  const signatures =
    distribucion.length > 0
      ? `<div class="signatures">${distribucion
          .map(
            (l) =>
              `<div class="sig-box">${escapeHtml(l.nombre.toUpperCase())}<br><span>Beneficiario</span></div>`,
          )
          .join('')}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Nómina ${escapeHtml(meta.areaLabel)} — ${fmtDate(meta.weekStart)}</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111; font-size: 11px; padding: 0; margin: 0; }
    .sheet { padding: 24px; }
    h1 { font-size: 17px; margin: 0 0 2px; letter-spacing: 0.02em; }
    h2 { font-size: 13px; color: #444; margin: 0 0 10px; font-weight: 600; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 14px; font-size: 10px; color: #555; }
    .meta span { white-space: nowrap; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .status-open { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .status-closed { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #e8eef5; border: 1px solid #b8c4d4; padding: 5px 6px; text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { border: 1px solid #dde3ea; padding: 4px 6px; vertical-align: top; }
    tr:nth-child(even) td { background: #fafbfc; }
    .num { text-align: center; }
    .money { text-align: right; font-variant-numeric: tabular-nums; }
    .total { font-weight: 700; color: #92400e; }
    .obs { font-size: 9px; color: #555; max-width: 140px; }
    .total-row td { font-weight: 700; background: #fff8e1 !important; border-top: 2px solid #cbd5e1; }
    h3 { font-size: 12px; margin: 20px 0 6px; color: #333; }
    .signatures { display: flex; justify-content: space-between; gap: 16px; margin-top: 48px; flex-wrap: wrap; }
    .sig-box { text-align: center; min-width: 160px; flex: 1; border-top: 1px solid #333; padding-top: 8px; font-size: 10px; font-weight: 600; }
    .sig-box span { font-weight: 400; color: #666; font-size: 9px; }
    .footer { margin-top: 28px; font-size: 8px; color: #888; text-align: center; }
    @media print { .sheet { padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <h1>MOLINOS LA FÉ — MINA BELÉN</h1>
    <h2>Nómina semanal · ${escapeHtml(meta.areaLabel)}</h2>
    <div class="meta">
      <span><strong>Periodo:</strong> ${fmtDate(meta.weekStart)} — ${fmtDate(meta.weekEnd)}</span>
      <span><strong>Trabajadores:</strong> ${meta.workerCount}</span>
      <span><strong>Total:</strong> ${fmtMoney(meta.totalSemana)}</span>
      <span class="badge ${statusClass}">${statusLabel}</span>
      <span><strong>Generado:</strong> ${escapeHtml(generated)}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Nombre</th>
          <th>C.I.</th>
          <th>Cargo</th>
          <th>Vertical</th>
          <th>Estado</th>
          <th>Días</th>
          <th>Novedad</th>
          <th>Sueldo</th>
          <th>Bono T.</th>
          <th>Bonos</th>
          <th>Deduc.</th>
          <th>Vales</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td colspan="13">Total general</td>
          <td class="money total">${meta.totalSemana.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    ${
      distRows
        ? `<h3>Distribución de pagos</h3>
    <table style="max-width:640px">
      <thead><tr><th>Beneficiario</th><th>%</th><th>Bruto</th><th>Pagos directos</th><th>Neto</th></tr></thead>
      <tbody>${distRows}</tbody>
    </table>
    ${signatures}`
        : ''
    }
    <p class="footer">Generado por MineOS · Sistema de Gestión Minera</p>
  </div>
</body>
</html>`;
}

export function printNominaSemanaPdf(
  rows: NominaSemanaExportRow[],
  meta: NominaSemanaExportMeta,
  distribucion: DistribucionLinea[] = [],
): void {
  const html = buildNominaSemanaPrintHtml(rows, meta, distribucion);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
