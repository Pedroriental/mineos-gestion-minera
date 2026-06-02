import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferAreaFromSection } from '@/lib/nomina/section-resolver';
import { buildColumnKinds, inferWorkerProfile } from '@/lib/nomina/inference';
import { isNominaSectionHeader } from '@/lib/nomina/section-headers';
import type { ParsedWorkerRow } from '@/lib/nomina/types';

describe('inferAreaFromSection', () => {
  it('maps Nómina Administrativos Molinos to planta (not administracion via molinos⊃mina)', () => {
    assert.equal(inferAreaFromSection('Nómina Administrativos Molinos'), 'planta');
  });

  it('maps Administrativos Mina to administracion', () => {
    assert.equal(inferAreaFromSection('Nómina Administrativos Mina'), 'administracion');
  });

  it('maps Vertical Mina Belén to mina', () => {
    assert.equal(inferAreaFromSection('Semanas Mina Belen - Vertical 1PD'), 'mina');
  });

  it('maps Molinos grupo to planta', () => {
    assert.equal(inferAreaFromSection('Semanas Molinos - Grupo (mixto)'), 'planta');
  });

  it('maps Nómina Molinos La Fé banner to planta', () => {
    assert.equal(inferAreaFromSection('Nómina Molinos La Fé'), 'planta');
  });

  it('maps combined PDF banner Mina Belén to mina', () => {
    assert.equal(inferAreaFromSection('Nómina Mina Belén'), 'mina');
  });

  it('detects molinos section headers', () => {
    assert.equal(isNominaSectionHeader('Semanas Molinos — Grupo operativo'), true);
    assert.equal(isNominaSectionHeader('Nómina Molinos La Fé'), true);
  });
});

describe('inferWorkerProfile', () => {
  const weekStarts = ['2026-05-04', '2026-05-11', '2026-05-18'];
  const weekColumns = weekStarts.map((w, i) => ({
    weekStart: w,
    rawHeader: i === 0 ? 'Semana libre' : 'Semana trabajada',
    header: i === 0 ? 'Semana libre' : 'Semana trabajada',
  }));
  const columnKinds = buildColumnKinds(weekColumns);

  it('infers salario_base and libre from 2x1 pattern', () => {
    const row: ParsedWorkerRow = {
      nombre_completo: 'Test Worker',
      cedula: '12345678',
      cargo: 'Vertical 1PD',
      area: 'mina',
      fecha_ingreso: '2020-01-01',
      weeks: {
        '2026-05-04': { amount: 100 },
        '2026-05-11': { amount: 150 },
        '2026-05-18': { amount: 150 },
      },
      total: 400,
      _valid: true,
    };

    const profile = inferWorkerProfile(row, weekStarts, columnKinds);
    assert.equal(profile.salario_base, 150);
    assert.ok(profile.confidence >= 0.5);
    assert.equal(profile.weekEstados['2026-05-04'], 'libre');
  });
});

describe('parseNominaMatrixFromTextLines PDF', () => {
  it('extracts multi-week Del/al columns and worker amounts', async () => {
    const { preprocessNominaPdfLines, parseNominaMatrixFromTextLines } = await import(
      '@/lib/nomina/import-parser'
    );
    const lines = preprocessNominaPdfLines([
      'Semanas Mina Belen - Vertical 1PD',
      'Del 04 MAYO Del 11 MAYO Del 18 MAYO',
      'al 10 MAYO al 17 MAYO al 24 Mayo',
      'RENNY JOSUE DIAZ',
      '21.669.002 24/02/2026 125 125 125 375,00',
    ]);
    const period = parseNominaMatrixFromTextLines(lines, 'mayo.pdf');
    assert.equal(period.weekColumns.length, 3);
    assert.equal(period.stats.workerCount, 1);
    assert.equal(period.grandTotal, 375);
  });
});

describe('validateImportTotals', () => {
  it('accepts matching totals', async () => {
    const { validateImportTotals } = await import('@/lib/nomina/archive');
    const r = validateImportTotals(7566.16, 7566.16);
    assert.equal(r.ok, true);
  });
});

describe('parseExcelNominaMatrix', () => {
  it('reads Del/al week headers on the row after Nombres/C.I.', async () => {
    const XLSX = await import('xlsx');
    const { parseExcelNominaMatrix } = await import('@/lib/nomina/import-parser');

    const rows: unknown[][] = [
      ['Semana del 04 MAYO al 24 MAYO 2026'],
      ['Total Nomina', '', '', '', '', 7566.16],
      ['Nómina Administrativos Molinos'],
      ['Nombres', '', 'C.I.', 'Fecha de Ingreso', 'Semana trabajada', 'Total'],
      ['', '', '', '', 'Del 18 MAYO al 24 Mayo'],
      ['Márquez Pedro', '', 9933498, 45903, 0, 200],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    const period = parseExcelNominaMatrix(wb, 'test.xlsx');
    assert.equal(period.stats.declaredSourceTotal, 7566.16);
    assert.equal(period.grandTotal, 200);
    assert.equal(period.stats.workerCount, 1);
    assert.equal(period.weekColumns.length, 1);
  });
});

describe('buildImportFidelityReport', () => {
  it('flags invalid cedula rows and computes commit total', async () => {
    const { buildImportFidelityReport } = await import('@/lib/nomina/import-fidelity');
    const period = {
      source: 'pdf' as const,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-24',
      weekColumns: [
        { weekStart: '2026-05-04', weekEnd: '2026-05-10', colIndex: 0, rawHeader: '', rawRange: { inicio: null, fin: null }, header: '' },
      ],
      sections: [
        {
          id: 'mina__v1',
          rawTitle: 'Vertical',
          title: 'Vertical',
          area: 'mina' as const,
          cargo: 'Vertical',
          areaDetalle: 'Vertical',
          weekColumns: [],
          sectionTotal: 375,
          rows: [
            {
              nombre_completo: 'OK Worker',
              cedula: '12345678',
              cargo: 'Vertical',
              area: 'mina' as const,
              fecha_ingreso: '2020-01-01',
              weeks: { '2026-05-04': { amount: 375 } },
              total: 375,
              _valid: true,
            },
            {
              nombre_completo: 'Sin CI',
              cedula: '123',
              cargo: 'Vertical',
              area: 'mina' as const,
              fecha_ingreso: '2020-01-01',
              weeks: { '2026-05-04': { amount: 200 } },
              total: 200,
              _valid: false,
              _error: 'Sin cédula',
            },
          ],
        },
      ],
      flatCells: [
        {
          sectionId: 'mina__v1',
          weekStart: '2026-05-04',
          worker: {
            nombre_completo: 'OK Worker',
            cedula: '12345678',
            cargo: 'Vertical',
            area: 'mina' as const,
            fecha_ingreso: '2020-01-01',
            weeks: { '2026-05-04': { amount: 375 } },
            total: 375,
            _valid: true,
          },
          cell: { amount: 375 },
        },
      ],
      stats: {
        workerCount: 2,
        cellCount: 1,
        skippedRows: 0,
        warnings: [],
        declaredSourceTotal: 575,
      },
      grandTotal: 375,
    };

    const report = buildImportFidelityReport(period, []);
    assert.equal(report.parsedTotal, 375);
    assert.equal(report.commitTotal, 375);
    assert.equal(report.workerCountCommit, 1);
    assert.equal(report.droppedWorkers.length, 1);
    assert.equal(report.deltas.sourceToParsed, -200);
    assert.equal(report.status, 'error');
  });
});

describe('buildImportCommitPayload for Note Workers', () => {
  it('correctly maps novelty fields from warning cell notes', async () => {
    const { buildImportCommitPayload } = await import('@/lib/nomina/import-commit');
    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [
        { weekStart: '2026-05-18', weekEnd: '2026-05-24', colIndex: 0, rawHeader: '', rawRange: { inicio: null, fin: null }, header: '' },
      ],
      sections: [
        {
          id: 'mina__v1',
          rawTitle: 'AYUDANTE BARRENADOR',
          title: 'AYUDANTE BARRENADOR',
          area: 'mina' as const,
          cargo: 'AYUDANTE BARRENADOR',
          areaDetalle: 'AYUDANTE BARRENADOR',
          weekColumns: [],
          sectionTotal: 100,
          rows: [
            {
              nombre_completo: 'Enio Mrtinez',
              cedula: '25392130',
              cargo: 'AYUDANTE BARRENADOR',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: {
                '2026-05-18': {
                  amount: 100,
                  _warnings: [
                    'El trabajador Enio Mrtinez 25392130 enviado a su casa accidente laboral, se paga la semana de trabajo. USD 100',
                  ],
                },
              },
              total: 100,
              _valid: true,
            },
          ],
        },
      ],
      flatCells: [
        {
          sectionId: 'mina__v1',
          weekStart: '2026-05-18',
          worker: {
            nombre_completo: 'Enio Mrtinez',
            cedula: '25392130',
            cargo: 'AYUDANTE BARRENADOR',
            area: 'mina' as const,
            fecha_ingreso: '2026-05-18',
            weeks: {
              '2026-05-18': {
                amount: 100,
                _warnings: [
                  'El trabajador Enio Mrtinez 25392130 enviado a su casa accidente laboral, se paga la semana de trabajo. USD 100',
                ],
              },
            },
            total: 100,
            _valid: true,
          },
          cell: {
            amount: 100,
            _warnings: [
              'El trabajador Enio Mrtinez 25392130 enviado a su casa accidente laboral, se paga la semana de trabajo. USD 100',
            ],
          },
        },
      ],
      stats: {
        workerCount: 1,
        cellCount: 1,
        skippedRows: 0,
        warnings: [],
      },
      grandTotal: 100,
    };

    const payload = buildImportCommitPayload(period, []);
    const reg = payload.semanas[0]?.registros[0];
    assert.ok(reg);
    assert.equal(reg.cedula, '25392130');
    assert.equal(reg.novedad_turno, 'REPOSO');
    assert.equal(reg.novedad_turno_obs, 'El trabajador Enio Mrtinez 25392130 enviado a su casa accidente laboral, se paga la semana de trabajo. USD 100');
  });
});

describe('Fidelity and Commit for previously DESPEDIDO workers', () => {
  it('adds warning issue to fidelity report and appends to novelty observation in commit payload', async () => {
    const { buildImportFidelityReport } = await import('@/lib/nomina/import-fidelity');
    const { buildImportCommitPayload } = await import('@/lib/nomina/import-commit');
    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [
        { weekStart: '2026-05-18', weekEnd: '2026-05-24', colIndex: 0, rawHeader: '', rawRange: { inicio: null, fin: null }, header: '' },
      ],
      sections: [
        {
          id: 'mina__v1',
          rawTitle: 'Vertical 1PD',
          title: 'Vertical 1PD',
          area: 'mina' as const,
          cargo: 'Vertical 1PD',
          areaDetalle: 'Vertical 1PD',
          weekColumns: [],
          sectionTotal: 150,
          rows: [
            {
              nombre_completo: 'Oswaldo Guacaran',
              cedula: '12345678',
              cargo: 'Vertical 1PD',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: { '2026-05-18': { amount: 150 } },
              total: 150,
              _valid: true,
            },
          ],
        },
      ],
      flatCells: [
        {
          sectionId: 'mina__v1',
          weekStart: '2026-05-18',
          worker: {
            nombre_completo: 'Oswaldo Guacaran',
            cedula: '12345678',
            cargo: 'Vertical 1PD',
            area: 'mina' as const,
            fecha_ingreso: '2026-05-18',
            weeks: { '2026-05-18': { amount: 150 } },
            total: 150,
            _valid: true,
          },
          cell: { amount: 150 },
        },
      ],
      stats: {
        workerCount: 1,
        cellCount: 1,
        skippedRows: 0,
        warnings: [],
      },
      grandTotal: 150,
    };

    const existingPersonal = new Map([
      [
        '12345678',
        {
          id: 'p-oswaldo',
          cedula: '12345678',
          nombre_completo: 'Oswaldo Guacaran',
          estado_laboral: 'DESPEDIDO',
          despido_causa: 'Faltas repetidas',
          activo: false,
        } as any,
      ],
    ]);

    // 1. Verificar fidelity report
    const fidelity = buildImportFidelityReport(period, [], { existingPersonal });
    const hasWarning = fidelity.issues.some((issue) =>
      issue.includes('Oswaldo Guacaran') &&
      issue.includes('DESPEDIDO') &&
      issue.includes('Faltas repetidas')
    );
    assert.ok(hasWarning);
    assert.notEqual(fidelity.status, 'error'); // No debe bloquear, no es error

    // 2. Verificar commit payload
    const payload = buildImportCommitPayload(period, [], { existingPersonal });
    const reg = payload.semanas[0]?.registros[0];
    assert.ok(reg);
    assert.equal(reg.novedad_turno, 'DESPEDIDO');
    assert.equal(reg.novedad_turno_obs, '[Estado anterior en sistema: DESPEDIDO (Causa: Faltas repetidas)]');
  });
});

describe('Excel Row Observations Parsing', () => {
  it('correctly maps trailing observations like reposo or retirado to weekly novelties', async () => {
    const { buildImportCommitPayload } = await import('@/lib/nomina/import-commit');
    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [
        { weekStart: '2026-05-18', weekEnd: '2026-05-24', colIndex: 3, rawHeader: '', rawRange: { inicio: null, fin: null }, header: '' },
      ],
      sections: [
        {
          id: 'mina__v1',
          rawTitle: 'AYUDANTE BARRENADOR',
          title: 'AYUDANTE BARRENADOR',
          area: 'mina' as const,
          cargo: 'AYUDANTE BARRENADOR',
          areaDetalle: 'AYUDANTE BARRENADOR',
          weekColumns: [],
          sectionTotal: 0,
          rows: [
            {
              nombre_completo: 'Enio Martinez',
              cedula: '25392130',
              cargo: 'AYUDANTE BARRENADOR',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: {
                '2026-05-18': {
                  amount: 0,
                },
              },
              total: 0,
              _valid: true,
              observaciones: 'reposo',
            },
          ],
        },
      ],
      flatCells: [
        {
          sectionId: 'mina__v1',
          weekStart: '2026-05-18',
          worker: {
            nombre_completo: 'Enio Martinez',
            cedula: '25392130',
            cargo: 'AYUDANTE BARRENADOR',
            area: 'mina' as const,
            fecha_ingreso: '2026-05-18',
            weeks: {
              '2026-05-18': {
                amount: 0,
              },
            },
            total: 0,
            _valid: true,
            observaciones: 'reposo',
          },
          cell: {
            amount: 0,
          },
        },
      ],
      stats: {
        workerCount: 1,
        cellCount: 1,
        skippedRows: 0,
        warnings: [],
      },
      grandTotal: 0,
    };

    const payload = buildImportCommitPayload(period, []);
    const reg = payload.semanas[0]?.registros[0];
    assert.ok(reg);
    assert.equal(reg.cedula, '25392130');
    assert.equal(reg.novedad_turno, 'REPOSO');
    assert.equal(reg.novedad_turno_obs, 'reposo');
  });
});


