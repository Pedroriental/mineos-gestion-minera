// ============================================================
// MineOS - Generador de PDF para Liquidación de Despedidos
// Mismo formato que la nómina semanal + Distribución de pagos
// ============================================================

import type { DistribucionLinea } from '@/lib/nomina-distribucion';

export type LiquidacionExportRow = {
  personal: {
    nombre_completo: string;
    cedula: string;
    cargo: string;
    area_detalle?: string | null;
  };
  salarioBase: number;
  porDia: number;
  diasTrabajados: number;
  totalDias: number;
  cobraSemanaLibre: boolean;
  semanaLibreMonto: number;
  bonificaciones: number;
  totalACobrar: number;
  despidoFecha: string;
  despidoCausa?: string | null;
};

export type LiquidacionExportMeta = {
  area: string;
  areaLabel: string;
  fechaGeneracion: string;
  fechaLiquidacion: string;
  workerCount: number;
  totalGeneral: number;
  totalDias: number;
  totalLibres: number;
  totalBonificaciones: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildLiquidacionPrintHtml(
  rows: LiquidacionExportRow[],
  meta: LiquidacionExportMeta,
  distribucion: DistribucionLinea[] = [],
): string {
  const generatedAt = meta.fechaGeneracion;

  const tableRows = rows
    .map(
      (r, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${escapeHtml(r.personal.nombre_completo)}</td>
      <td style="text-align:center">${escapeHtml(r.personal.cedula)}</td>
      <td style="text-align:center">${escapeHtml(r.personal.cargo)}</td>
      <td style="text-align:right">${fmtUsd(r.salarioBase)}</td>
      <td style="text-align:right">${fmtUsd(r.porDia)}</td>
      <td style="text-align:center">${r.diasTrabajados}</td>
      <td style="text-align:right">${fmtUsd(r.totalDias)}</td>
      <td style="text-align:right">${r.cobraSemanaLibre ? fmtUsd(r.semanaLibreMonto) : '—'}</td>
      <td style="text-align:right">${fmtUsd(r.bonificaciones)}</td>
      <td style="text-align:right;font-weight:bold">${fmtUsd(r.totalACobrar)}</td>
    </tr>`,
    )
    .join('');

  const totalRow = `
    <tr style="background:#0a1623;font-weight:bold;color:#d57706">
      <td colspan="7" style="text-align:right;padding:6px 8px">TOTAL</td>
      <td style="text-align:right;padding:6px 8px">${fmtUsd(meta.totalDias)}</td>
      <td style="text-align:right;padding:6px 8px">${fmtUsd(meta.totalLibres)}</td>
      <td style="text-align:right;padding:6px 8px">${fmtUsd(meta.totalBonificaciones)}</td>
      <td style="text-align:right;padding:6px 8px">${fmtUsd(meta.totalGeneral)}</td>
    </tr>`;

  const distRows = distribucion
    .map(
      (d) => `
    <tr>
      <td>${escapeHtml(d.nombre)}</td>
      <td style="text-align:right">${d.porcentaje.toFixed(2)}%</td>
      <td style="text-align:right">${fmtUsd(d.bruto)}</td>
      <td style="text-align:right">${fmtUsd(d.pagoDirecto)}</td>
      <td style="text-align:right;font-weight:bold">${fmtUsd(d.neto)}</td>
    </tr>`,
    )
    .join('');

  const signatures = distribucion
    .map(
      (d) => `
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(d.nombre)}</div>
      <div class="signature-role">Beneficiario</div>
    </div>`,
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Liquidación de Personal Retirado — ${escapeHtml(meta.areaLabel)} — ${meta.fechaLiquidacion}</title>
<style>
  @page { size: landscape; margin: 12mm }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #dcdcdc; background: #0a1623; margin: 0; padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px 0; color: #fff; }
  h2 { font-size: 13px; margin: 14px 0 6px 0; color: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid #19324a; }
  .brand { color: #d57706; font-weight: 700; font-size: 15px; }
  .meta { font-size: 11px; line-height: 1.5; color: #a0b0c0; }
  .meta strong { color: #dcdcdc; }
  .summary { display: flex; gap: 12px; margin: 10px 0 6px 0; font-size: 11px; }
  .summary-item { background: #0f2330; border: 1px solid #19324a; border-radius: 4px; padding: 6px 10px; min-width: 100px; }
  .summary-label { color: #a0b0c0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-value { font-size: 14px; font-weight: 700; color: #d57706; margin-top: 2px; }
  table { border-collapse: collapse; width: 100%; font-size: 9px; background: #0c1c28; }
  thead th { background: #0f2330; color: #d57706; text-align: left; padding: 6px 8px; border-bottom: 1px solid #19324a; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #16263a; }
  tbody tr:nth-child(even) { background: #11242e; }
  .signatures { display: flex; gap: 32px; margin: 24px 0 12px 0; }
  .signature-block { flex: 1; }
  .signature-line { border-top: 1px solid #dcdcdc; padding-top: 4px; }
  .signature-name { font-size: 10px; color: #dcdcdc; margin-top: 4px; text-align: center; font-weight: 600; }
  .signature-role { font-size: 9px; color: #a0b0c0; text-align: center; }
  .footer { font-size: 9px; color: #6b7c8a; text-align: center; margin-top: 16px; }
  @media print {
    body { background: #fff; color: #000; }
    .summary-item { background: #f5f5f5; border-color: #ccc; }
    .summary-value { color: #000; }
    table { background: #fff; }
    thead th { background: #e0e0e0; color: #000; }
    tbody td { border-color: #ddd; }
    tbody tr:nth-child(even) { background: #f5f5f5; }
    .meta, .footer { color: #555; }
    .brand { color: #b56500; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">MOLINOS LA FÉ · MineOS</div>
      <h1>Liquidación de Personal Retirado — ${escapeHtml(meta.areaLabel)}</h1>
    </div>
    <div class="meta">
      <div><strong>Fecha de liquidación:</strong> ${meta.fechaLiquidacion}</div>
      <div><strong>Trabajadores:</strong> ${meta.workerCount}</div>
      <div><strong>Generado:</strong> ${generatedAt}</div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Total a Pagar</div>
      <div class="summary-value">${fmtUsd(meta.totalGeneral)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Días Trabajados</div>
      <div class="summary-value">${fmtUsd(meta.totalDias)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Semanas Libres</div>
      <div class="summary-value">${fmtUsd(meta.totalLibres)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Bonificaciones</div>
      <div class="summary-value">${fmtUsd(meta.totalBonificaciones)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Nombre y Apellido</th>
        <th>Cédula</th>
        <th>Cargo</th>
        <th>$/Semana</th>
        <th>$/día</th>
        <th>Días Trab.</th>
        <th>Total/DT</th>
        <th>Sem. Libre</th>
        <th>Bono</th>
        <th>Total a Cobrar</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      ${totalRow}
    </tbody>
  </table>

  ${
    distRows
      ? `<h2>Distribución de pagos</h2>
    <table style="max-width:640px">
      <thead><tr><th>Beneficiario</th><th>%</th><th>Bruto</th><th>Pagos directos</th><th>Neto</th></tr></thead>
      <tbody>${distRows}</tbody>
    </table>
    ${signatures ? `<div class="signatures">${signatures}</div>` : ''}`
      : ''
  }

  <p class="footer">Generado por MineOS · Sistema de Gestión Minera de Alta Precisión</p>
</body>
</html>`;
}

export function printLiquidacionPdf(
  rows: LiquidacionExportRow[],
  meta: LiquidacionExportMeta,
  distribucion: DistribucionLinea[] = [],
): void {
  const html = buildLiquidacionPrintHtml(rows, meta, distribucion);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
