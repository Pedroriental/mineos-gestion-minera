'use client';

import type { CompensacionResumen } from '@/lib/compensacion-gastos';

function fmtCsv(n: number): string {
  return n.toFixed(2);
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function generarCsvCompensacionGastos(resumen: CompensacionResumen): string {
  const lines: string[] = [];

  lines.push(`# Compensación de Gastos de Mina`);
  lines.push(`# Período: ${resumen.period.mes}`);
  lines.push(`# Generado: ${new Date().toISOString()}`);
  lines.push('');

  const headers = ['Item', 'Descripción', 'Total'];
  resumen.empresas.forEach((e) => {
    headers.push(`${e.nombre}_Real`);
    headers.push(`${e.nombre}_Teorico`);
    headers.push(`${e.nombre}_Compensacion`);
  });
  lines.push(headers.map(escapeCsvField).join(','));

  resumen.categorias.forEach((cat, i) => {
    const row: string[] = [String(i + 1), cat.nombre, fmtCsv(cat.total)];
    resumen.empresas.forEach((e) => {
      row.push(fmtCsv(cat.gastoRealPorEmpresa[e.id] ?? 0));
      row.push(fmtCsv(cat.gastoTeoricoPorEmpresa[e.id] ?? 0));
      row.push(fmtCsv(cat.compensacionPorEmpresa[e.id] ?? 0));
    });
    lines.push(row.map(escapeCsvField).join(','));
  });

  const totalRow: string[] = ['', 'TOTAL', fmtCsv(resumen.totalGasto)];
  resumen.empresas.forEach((e) => {
    totalRow.push(fmtCsv(resumen.totalRealPorEmpresa[e.id] ?? 0));
    totalRow.push(fmtCsv(resumen.totalTeoricoPorEmpresa[e.id] ?? 0));
    totalRow.push(fmtCsv(resumen.totalCompensacionPorEmpresa[e.id] ?? 0));
  });
  lines.push(totalRow.map(escapeCsvField).join(','));

  lines.push('');
  lines.push('# Resumen de Compensación');
  lines.push('Empresa,Saldo,Estado');
  resumen.empresas.forEach((e) => {
    const r = resumen.resumenPorEmpresa[e.id];
    const saldo = r?.saldo ?? 0;
    const estado = r?.estado ?? 'equilibrado';
    const label =
      estado === 'debe_cobrar'
        ? 'DEBE COBRAR'
        : estado === 'debe_pagar'
          ? 'DEBE PAGAR'
          : 'EQUILIBRADO';
    lines.push(
      [e.nombre, fmtCsv(saldo), label].map(escapeCsvField).join(','),
    );
  });

  return lines.join('\n');
}

export function descargarCsvCompensacionGastos(resumen: CompensacionResumen): void {
  const csv = generarCsvCompensacionGastos(resumen);
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compensacion_gastos_${resumen.period.mes}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
