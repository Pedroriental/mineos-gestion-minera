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

describe('describePayrollWeekCount', () => {
  it('counts labor weeks in document range excluding bono auxiliary column', async () => {
    const { describePayrollWeekCount } = await import('@/lib/nomina/week-utils');
    const col = (weekStart: string, weekEnd: string, columnKind: 'bono' | 'libre' | 'trabajada') => ({
      weekStart,
      weekEnd,
      colIndex: 0,
      rawHeader: '',
      rawRange: { inicio: weekStart, fin: weekEnd },
      header: '',
      columnKind,
    });
    const meta = describePayrollWeekCount({
      rangeStart: '2026-04-13',
      rangeEnd: '2026-05-03',
      weekColumns: [
        col('2026-04-06', '2026-04-12', 'bono'),
        col('2026-04-13', '2026-04-19', 'libre'),
        col('2026-04-20', '2026-04-26', 'trabajada'),
        col('2026-04-27', '2026-05-03', 'trabajada'),
      ],
    });
    assert.equal(meta.payrollWeeks, 3);
    assert.equal(meta.hasBonoColumn, true);
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

  it('handles bono transporte, invalid ingreso dates, and pago semana libre blocks', async () => {
    const XLSX = await import('xlsx');
    const { parseExcelNominaMatrix } = await import('@/lib/nomina/import-parser');

    const rows: unknown[][] = [
      ['Semana del 13 ABRIL al 03 MAYO 2026'],
      ['Total Nomina', '', '', '', '', 605],
      ['Semanas Molinos- Grupo (mixto)'],
      ['Nombres', '', 'C.I.', 'Fecha de Ingreso', 'Bono de Transporte', 'Semana trabajada', '', 'Total'],
      ['', '', '', '', 'Del 06 ABRIL al 12 ABRIL', 'Del 27 ABRIL al 03 Mayo'],
      ['Gregorio Martines', '', 14132905, 46126, 30, 75, '', 105],
      ['Semanas Mina Belen - Tecnico Operador Compresor'],
      ['Nombres', 'C.I.', 'Fecha de Ingreso', 'Semana trabajada', 'Total'],
      ['', '', '', 'Del 27 ABRIL al 03 Mayo'],
      ['Lugo A, Dixon Antonio', 7776964, 46069, 100, 100],
      ['PERSONAL DESPEDIDO MINA'],
      ['PAGO SEMANA LIBRE'],
      ['', 'C.I.', 'Fecha de Ingreso', 'SEMANA'],
      ['Vidal Geraldo', 22981255, 45992, 100],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    const period = parseExcelNominaMatrix(wb, 'mayo-fixture.xlsx');

    const molinos = period.sections.find((s) => s.id === 'planta_operativos');
    assert.ok(molinos);
    assert.equal(molinos!.rows.find((r) => r.nombre_completo.includes('Gregorio'))?.total, 105);

    const pagoLibre = period.sections.find((s) => s.id === 'mina__pago_semana_libre');
    assert.ok(pagoLibre);
    assert.equal(pagoLibre!.rows.length, 1);
    assert.equal(pagoLibre!.sectionTotal, 100);
    assert.equal(period.stats.declaredSourceTotal, 605);
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

describe('resolvePeriodWorkers', () => {
  it('assigns distinct cédulas when Excel repeats the same CI for different names', async () => {
    const { resolvePeriodWorkers } = await import('@/lib/nomina/worker-match');
    const { buildImportCommitPayload } = await import('@/lib/nomina/import-commit');

    const workers = [
      { cedula: '11111111', nombre_completo: 'Alfredo Mendez' },
      { cedula: '22222222', nombre_completo: 'Ismael Mendez' },
    ];

    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [
        {
          weekStart: '2026-05-18',
          weekEnd: '2026-05-24',
          colIndex: 3,
          rawHeader: '',
          rawRange: { inicio: null, fin: null },
          header: '',
        },
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
          sectionTotal: 200,
          rows: [
            {
              nombre_completo: 'Alfredo Mendez',
              cedula: '28374511',
              cargo: 'Vertical',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: { '2026-05-18': { amount: 100 } },
              total: 100,
              _valid: true,
            },
            {
              nombre_completo: 'Ismael Mendez',
              cedula: '28374511',
              cargo: 'Vertical',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: { '2026-05-18': { amount: 100 } },
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
            nombre_completo: 'Alfredo Mendez',
            cedula: '28374511',
            cargo: 'Vertical',
            area: 'mina' as const,
            fecha_ingreso: '2026-05-18',
            weeks: { '2026-05-18': { amount: 100 } },
            total: 100,
            _valid: true,
          },
          cell: { amount: 100 },
        },
        {
          sectionId: 'mina__v1',
          weekStart: '2026-05-18',
          worker: {
            nombre_completo: 'Ismael Mendez',
            cedula: '28374511',
            cargo: 'Vertical',
            area: 'mina' as const,
            fecha_ingreso: '2026-05-18',
            weeks: { '2026-05-18': { amount: 100 } },
            total: 100,
            _valid: true,
          },
          cell: { amount: 100 },
        },
      ],
      stats: { workerCount: 2, cellCount: 2, skippedRows: 0, warnings: [] },
      grandTotal: 200,
    };

    const { period: resolved, correctedCount, warnings } = resolvePeriodWorkers(period, workers);
    assert.equal(correctedCount, 2);
    assert.equal(resolved.sections[0].rows[0].cedula, '11111111');
    assert.equal(resolved.sections[0].rows[1].cedula, '22222222');
    assert.equal(warnings.length, 2);

    const payload = buildImportCommitPayload(resolved, []);
    assert.equal(payload.semanas[0]?.registros.length, 2);
    assert.equal(payload.semanas[0]?.total_pagado, 200);
  });

  it('flags unmatched workers not in Base de Trabajadores', async () => {
    const { resolveRowWorker, buildWorkerLookup } = await import('@/lib/nomina/worker-match');
    const lookup = buildWorkerLookup([{ cedula: '12345678', nombre_completo: 'Juan Perez' }]);
    const result = resolveRowWorker(
      { nombre_completo: 'Desconocido Gomez', cedula: '99999999' },
      lookup,
    );
    assert.equal(result.kind, 'unmatched');
    assert.match(result.message ?? '', /no encontrado/i);
  });
});

describe('worker identity cases', () => {
  it('builds shared-cedula cases for duplicate CI with different names', async () => {
    const { buildIdentityCases, confirmIdentityCase } = await import(
      '@/lib/nomina/worker-identity-cases'
    );
    const { applyIdentityResolutions } = await import('@/lib/nomina/apply-identity-resolutions');
    const { buildImportCommitPayload } = await import('@/lib/nomina/import-commit');

    const workers = [
      { id: 'a1', cedula: '11111111', nombre_completo: 'Alfredo Mendez' },
      { id: 'a2', cedula: '22222222', nombre_completo: 'Ismael Mendez' },
    ];

    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [
        {
          weekStart: '2026-05-18',
          weekEnd: '2026-05-24',
          colIndex: 3,
          rawHeader: '',
          rawRange: { inicio: null, fin: null },
          header: '',
        },
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
          sectionTotal: 200,
          rows: [
            {
              nombre_completo: 'Alfredo Mendez',
              cedula: '28374511',
              cargo: 'Vertical',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: { '2026-05-18': { amount: 100 } },
              total: 100,
              _valid: true,
            },
            {
              nombre_completo: 'Ismael Mendez',
              cedula: '28374511',
              cargo: 'Vertical',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: { '2026-05-18': { amount: 100 } },
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
            nombre_completo: 'Alfredo Mendez',
            cedula: '28374511',
            cargo: 'Vertical',
            area: 'mina' as const,
            fecha_ingreso: '2026-05-18',
            weeks: { '2026-05-18': { amount: 100 } },
            total: 100,
            _valid: true,
          },
          cell: { amount: 100 },
        },
        {
          sectionId: 'mina__v1',
          weekStart: '2026-05-18',
          worker: {
            nombre_completo: 'Ismael Mendez',
            cedula: '28374511',
            cargo: 'Vertical',
            area: 'mina' as const,
            fecha_ingreso: '2026-05-18',
            weeks: { '2026-05-18': { amount: 100 } },
            total: 100,
            _valid: true,
          },
          cell: { amount: 100 },
        },
      ],
      stats: { workerCount: 2, cellCount: 2, skippedRows: 0, warnings: [] },
      grandTotal: 200,
    };

    const cases = buildIdentityCases(period, workers);
    assert.equal(cases.length, 2);
    assert.ok(cases.every((c) => c.kind === 'cedula_shared'));
    assert.ok(cases.every((c) => c.status === 'pending'));

    const confirmed = cases.map((c) => confirmIdentityCase(c, 'use_suggested'));
    const resolved = applyIdentityResolutions(structuredClone(period) as typeof period, confirmed);
    assert.equal(resolved.sections[0].rows[0].cedula, '11111111');
    assert.equal(resolved.sections[0].rows[1].cedula, '22222222');

    const payload = buildImportCommitPayload(resolved, []);
    assert.equal(payload.semanas[0]?.registros.length, 2);
  });

  it('blocks import validation when identity cases remain pending', async () => {
    const { buildIdentityCases, validateClientIdentityCases } = await import(
      '@/lib/nomina/worker-identity-cases'
    );

    const workers = [{ id: 'a1', cedula: '11111111', nombre_completo: 'Alfredo Mendez' }];
    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [],
      sections: [
        {
          id: 's1',
          rawTitle: 'T',
          title: 'T',
          area: 'mina' as const,
          cargo: 'T',
          areaDetalle: null,
          weekColumns: [],
          sectionTotal: 100,
          rows: [
            {
              nombre_completo: 'Alfredo Mendez',
              cedula: '28374511',
              cargo: 'T',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: { '2026-05-18': { amount: 100 } },
              total: 100,
              _valid: true,
            },
          ],
        },
      ],
      flatCells: [],
      stats: { workerCount: 1, cellCount: 1, skippedRows: 0, warnings: [] },
      grandTotal: 100,
    };

    const serverCases = buildIdentityCases(period, workers);
    const result = validateClientIdentityCases(serverCases, serverCases);
    assert.equal(result.ok, false);
  });
});

describe('identity policy and aliases', () => {
  it('rejects keep_excel for cedula conflict cases', async () => {
    const { validateResolutionPolicy } = await import('@/lib/nomina/worker-identity-policy');
    const result = validateResolutionPolicy({
      id: 'x',
      kind: 'cedula_conflict',
      excelNombre: 'Juan',
      excelCedula: '111',
      rowRefs: ['x'],
      status: 'confirmed',
      resolution: {
        personalId: '',
        cedula: '111',
        nombre: 'Juan',
        action: 'keep_excel',
      },
    });
    assert.equal(result.ok, false);
  });

  it('applies import aliases before building manual cases', async () => {
    const { prepareIdentityImport } = await import('@/lib/nomina/worker-identity-cases');

    const workers = [{ id: 'w1', cedula: '11111111', nombre_completo: 'Alfredo Mendez' }];
    const aliases = [
      {
        id: 'a1',
        alias_nombre_normalizado: 'alfredo mendez',
        alias_cedula_excel: '28374511',
        personal_id: 'w1',
      },
    ];
    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [],
      sections: [
        {
          id: 's1',
          rawTitle: 'T',
          title: 'T',
          area: 'mina' as const,
          cargo: 'T',
          areaDetalle: null,
          weekColumns: [],
          sectionTotal: 100,
          rows: [
            {
              nombre_completo: 'Alfredo Mendez',
              cedula: '28374511',
              cargo: 'T',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: { '2026-05-18': { amount: 100 } },
              total: 100,
              _valid: true,
            },
          ],
        },
      ],
      flatCells: [],
      stats: { workerCount: 1, cellCount: 1, skippedRows: 0, warnings: [] },
      grandTotal: 100,
    };

    const prep = prepareIdentityImport(period, workers, aliases);
    assert.equal(prep.cases.length, 0);
    assert.equal(prep.aliasApplications.length, 1);
    assert.equal(prep.periodForMatching.sections[0].rows[0].cedula, '11111111');
    assert.equal(prep.summary.aliasResolved, 1);
  });

  it('computes identity summary counters', async () => {
    const { computeIdentitySummary } = await import('@/lib/nomina/worker-identity-cases');
    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [],
      sections: [
        {
          id: 's1',
          rawTitle: 'T',
          title: 'T',
          area: 'mina' as const,
          cargo: 'T',
          areaDetalle: null,
          weekColumns: [],
          sectionTotal: 200,
          rows: [
            {
              nombre_completo: 'A',
              cedula: '1',
              cargo: 'T',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: {},
              total: 100,
              _valid: true,
            },
            {
              nombre_completo: 'B',
              cedula: '2',
              cargo: 'T',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: {},
              total: 100,
              _valid: true,
            },
          ],
        },
      ],
      flatCells: [],
      stats: { workerCount: 2, cellCount: 0, skippedRows: 0, warnings: [] },
      grandTotal: 200,
    };

    const summary = computeIdentitySummary(
      period,
      [
        {
          id: 'c1',
          kind: 'cedula_shared',
          excelNombre: 'A',
          excelCedula: '9',
          rowRefs: ['c1'],
          status: 'pending',
        },
      ],
      0,
    );

    assert.equal(summary.totalWorkers, 2);
    assert.equal(summary.shared, 1);
    assert.equal(summary.autoMatched, 1);
    assert.equal(summary.pending, 1);
  });
});

describe('worker name fuzzy matching', () => {
  it('suggests similar names without auto-assigning', async () => {
    const { findFuzzyWorkerCandidates } = await import('@/lib/nomina/worker-name-fuzzy');
    const workers = [{ id: 'w1', cedula: '123', nombre_completo: 'Enio Martinez' }];
    const candidates = findFuzzyWorkerCandidates('Enio Mrtinez', workers);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].worker.cedula, '123');
    assert.ok(candidates[0].score >= 0.85);
  });

  it('matches reversed name order in resolveRowWorker', async () => {
    const { resolveRowWorker, buildWorkerLookup } = await import('@/lib/nomina/worker-match');
    const lookup = buildWorkerLookup([
      { cedula: '111', nombre_completo: 'Alfredo Mendez' },
    ]);
    const result = resolveRowWorker(
      { nombre_completo: 'Mendez Alfredo', cedula: '999' },
      lookup,
    );
    assert.equal(result.kind, 'corrected');
    assert.equal(result.cedula, '111');
  });

  it('adds fuzzy candidates to identity cases for unknown workers', async () => {
    const { buildIdentityCases } = await import('@/lib/nomina/worker-identity-cases');
    const workers = [{ id: 'w1', cedula: '123', nombre_completo: 'Enio Martinez' }];
    const period = {
      source: 'excel' as const,
      rangeStart: '2026-05-18',
      rangeEnd: '2026-05-24',
      weekColumns: [],
      sections: [
        {
          id: 's1',
          rawTitle: 'T',
          title: 'Vertical',
          area: 'mina' as const,
          cargo: 'Vertical',
          areaDetalle: null,
          weekColumns: [],
          sectionTotal: 100,
          rows: [
            {
              nombre_completo: 'Enio Mrtinez',
              cedula: '99999',
              cargo: 'Vertical',
              area: 'mina' as const,
              fecha_ingreso: '2026-05-18',
              weeks: { '2026-05-18': { amount: 100 } },
              total: 100,
              _valid: true,
            },
          ],
        },
      ],
      flatCells: [],
      stats: { workerCount: 1, cellCount: 1, skippedRows: 0, warnings: [] },
      grandTotal: 100,
    };

    const cases = buildIdentityCases(period, workers);
    assert.equal(cases.length, 1);
    assert.ok(cases[0].fuzzyCandidates?.length);
    assert.equal(cases[0].suggested?.cedula, '123');
    assert.equal(cases[0].rowTotal, 100);
  });
});

describe('identity audit payload', () => {
  it('builds audit metadata for period import', async () => {
    const { buildIdentityAuditPayload } = await import('@/lib/nomina/identity-audit');
    const audit = buildIdentityAuditPayload(
      [
        {
          id: 'c1',
          kind: 'cedula_shared',
          excelNombre: 'A',
          excelCedula: '9',
          rowRefs: ['c1'],
          status: 'confirmed',
          resolution: {
            personalId: 'w1',
            cedula: '1',
            nombre: 'A',
            action: 'use_suggested',
          },
        },
      ],
      {
        totalWorkers: 2,
        autoMatched: 1,
        corrected: 0,
        shared: 1,
        unknown: 0,
        conflict: 0,
        aliasResolved: 0,
        pending: 0,
      },
    );
    assert.equal(audit.cases.length, 1);
    assert.equal(audit.summary.shared, 1);
    assert.ok(audit.importedAt);
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


