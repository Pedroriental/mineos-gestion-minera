import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNominaPreviewWorkbookData,
  nominaXlsxFilename,
} from '@/lib/nomina/nomina-export-xlsx';
import type { NominaPreviewReport } from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';

function fakeReport(): NominaPreviewReport {
  const weekColumns = [
    {
      weekStart: '2026-05-11',
      weekEnd: '2026-05-17',
      displayStart: '2026-05-11',
      displayEnd: '2026-05-17',
      header: '1. 11 MAY al 17 MAY',
      isPartialInRange: false,
    },
    {
      weekStart: '2026-05-18',
      weekEnd: '2026-05-24',
      displayStart: '2026-05-18',
      displayEnd: '2026-05-24',
      header: '2. 18 MAY al 24 MAY',
      isPartialInRange: false,
    },
  ];
  const personal = {
    id: 'p1',
    nombre_completo: 'Oswaldo Guacaran',
    cedula: '30.501.619',
    fecha_ingreso: '2026-02-03',
  } as Personal;
  return {
    periodLabel: 'Período del 11 MAY al 24 MAY 2026 · 2 semanas',
    periodKind: 'weeks',
    rangeDays: 14,
    rangeStart: '2026-05-11',
    rangeEnd: '2026-05-24',
    weekColumns,
    summary: [{ id: 'sec1', label: 'Nóminas Vertical 1PD', total: 300 }],
    sections: [
      {
        id: 'sec1',
        title: 'Semanas Mina Belén — Vertical 1PD',
        subtitle: '',
        sectionTotal: 300,
        rows: [
          {
            personal,
            weeks: {
              '2026-05-11': { amount: 100, estado: 'libre', source: 'cerrada' },
              '2026-05-18': { amount: 200, estado: 'trabajada', source: 'cerrada' },
            },
            total: 300,
            saleLibre: true,
            observaciones: 'Salen libre',
          },
        ],
      },
    ],
    novedades: [
      {
        id: 'n1',
        fecha: '2026-05-11',
        nombre: 'Enio Martinez',
        cedula: '25.392.130',
        area: 'mina',
        tipo: 'Reposo',
        detalle: 'reposo médico',
      },
    ],
    grandTotal: 300,
    stats: { closedCells: 2, calculatedCells: 0 },
  };
}

describe('buildNominaPreviewWorkbookData', () => {
  it('arma título, resumen, bloque de sección y novedades', () => {
    const data = buildNominaPreviewWorkbookData(fakeReport());
    const flat = data.rows.map((r) => r.filter((c) => c != null).join(' | '));

    assert.match(flat[0], /Período del 11 MAY al 24 MAY 2026/);
    assert.ok(flat.some((r) => r.startsWith('Concepto')));
    assert.ok(flat.some((r) => r.startsWith('Nóminas Vertical 1PD | 300')));
    assert.ok(flat.some((r) => r.startsWith('Total Nómina | 300')));
    assert.ok(flat.some((r) => r.includes('Semanas Mina Belén — Vertical 1PD')));
    assert.ok(
      flat.some((r) => r.startsWith('Nombres | C.I. | Fecha de Ingreso | 1. 11 MAY al 17 MAY')),
    );
    assert.ok(
      flat.some((r) => r.startsWith('Oswaldo Guacaran | 30.501.619 | 03/02/2026 | 100 | 200')),
    );
    assert.ok(flat.some((r) => r.startsWith('Cierre Semanal (USD) | 100 | 200 | 300')));
    assert.ok(flat.some((r) => r.startsWith('Novedades del periodo')));
    assert.ok(flat.some((r) => r.includes('Enio Martinez')));
  });

  it('fila de trabajador termina en observaciones y total', () => {
    const data = buildNominaPreviewWorkbookData(fakeReport());
    const row = data.rows.find((r) => r[0] === 'Oswaldo Guacaran')!;
    assert.ok(row);
    // Nombres, C.I., Ingreso, 2 semanas, Observaciones, Total
    assert.equal(row[5], 'Salen libre');
    assert.equal(row[6], 300);
  });

  it('reparte columnas Parte según divisiones', () => {
    const data = buildNominaPreviewWorkbookData(fakeReport(), [
      { id: 'a', nombre: '50%', porcentaje: 50 },
      { id: 'b', nombre: '50%', porcentaje: 50 },
    ]);
    const summaryHeader = data.rows.find((r) => r[0] === 'Concepto')!;
    assert.equal(summaryHeader.filter((c) => c != null).length, 4);
    const totalRow = data.rows.find((r) => r[0] === 'Total Nómina')!;
    assert.equal(totalRow[2], 150);
    assert.equal(totalRow[3], 150);
  });
});

describe('nominaXlsxFilename', () => {
  it('usa el rango como nombre', () => {
    assert.equal(
      nominaXlsxFilename('2026-05-11', '2026-05-24'),
      'nomina_2026-05-11_2026-05-24.xlsx',
    );
  });
});
