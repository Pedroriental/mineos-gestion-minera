import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeManualPeriodProgress,
  formatManualWeekLabel,
  manualPeriodWeekStarts,
  nextWeekInManualPeriod,
  previousWeekInManualPeriod,
  resolveManualPeriodWeekColumn,
  weekInManualPeriod,
  stripPeriodoLabelPrefix,
  manualPeriodConsolidateLabel,
  dedupeNominaPeriodoSummaries,
  manualPeriodoDedupKey,
} from '@/lib/nomina/manual-period';

describe('manual-period', () => {
  it('manualPeriodWeekStarts filtra semanas dentro del mes', () => {
    const weeks = manualPeriodWeekStarts('2026-05-01', '2026-05-31');
    assert.ok(weeks.length >= 4);
    assert.ok(weeks.every((w) => w >= '2026-05-01' && w <= '2026-05-31'));
  });

  it('computeManualPeriodProgress cuenta cerradas y total', () => {
    const period = {
      id: 'test-may',
      label: 'Mayo 2026',
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      plantillaId: 'pl-1',
      plantillaNombre: 'Vertical',
    };
    const weeks = manualPeriodWeekStarts(period.rangeStart, period.rangeEnd);
    const semanas = [
      { semana_inicio: weeks[0], total_pagado: 1000 },
      { semana_inicio: weeks[1], total_pagado: 1200 },
    ];
    const p = computeManualPeriodProgress(period, semanas);
    assert.equal(p.closedCount, 2);
    assert.equal(p.totalUsd, 2200);
    assert.equal(p.weekTotalsUsd[weeks[0]], 1000);
    assert.equal(p.weekTotalsUsd[weeks[1]], 1200);
    assert.equal(p.allClosed, false);
  });

  it('formatManualWeekLabel cruza de mes correctamente', () => {
    assert.equal(formatManualWeekLabel('2026-06-29'), '29/06/2026 – 05/07/2026');
    assert.equal(formatManualWeekLabel('2026-06-08'), '08/06 – 14/06/2026');
  });

  it('resolveManualPeriodWeekColumn usa asignación explícita', () => {
    const assignment = ['2026-05-25', '2026-05-11', '2026-05-18'];
    assert.equal(
      resolveManualPeriodWeekColumn(
        '2026-05-11',
        '2026-05-01',
        '2026-05-31',
        assignment,
      ),
      1,
    );
    assert.equal(
      resolveManualPeriodWeekColumn(
        '2026-05-25',
        '2026-05-01',
        '2026-05-31',
        assignment,
      ),
      0,
    );
  });

  it('weekInManualPeriod', () => {
    const period = {
      id: 'p-1',
      label: 'Mayo',
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      plantillaId: '',
      plantillaNombre: '',
      weekColumnAssignment: [],
      weekColumnCuadrillas: [],
    };
    assert.equal(weekInManualPeriod('2026-05-05', period), true);
    assert.equal(weekInManualPeriod('2026-06-02', period), false);
  });

  it('nextWeekInManualPeriod y previousWeekInManualPeriod', () => {
    const period = {
      id: 'p-1',
      label: 'Mayo',
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      plantillaId: '',
      plantillaNombre: '',
      weekColumnAssignment: [],
      weekColumnCuadrillas: [],
    };
    const weeks = manualPeriodWeekStarts(period.rangeStart, period.rangeEnd);
    assert.equal(nextWeekInManualPeriod(period, weeks[0]), weeks[1]);
    assert.equal(previousWeekInManualPeriod(period, weeks[1]), weeks[0]);
    assert.equal(nextWeekInManualPeriod(period, weeks[weeks.length - 1]), null);
    assert.equal(previousWeekInManualPeriod(period, weeks[0]), null);
  });

  it('stripPeriodoLabelPrefix quita prefijo Manual', () => {
    assert.equal(stripPeriodoLabelPrefix('[Manual] Mayo 2026'), 'Mayo 2026');
    assert.equal(stripPeriodoLabelPrefix('Mayo 2026'), 'Mayo 2026');
  });

  it('manualPeriodConsolidateLabel usa nombre neto del ciclo', () => {
    const label = manualPeriodConsolidateLabel({
      id: 'test',
      label: 'Nómina Mina Belén 5ta Semana Mayo 2026',
      rangeStart: '2026-05-11',
      rangeEnd: '2026-05-31',
      plantillaId: 'pl',
      plantillaNombre: '14x7',
    });
    assert.equal(label, 'Nómina Mina Belén 5ta Semana Mayo 2026');
  });

  it('dedupeNominaPeriodoSummaries conserva el más reciente', () => {
    const base = {
      rangeStart: '2026-05-11',
      rangeEnd: '2026-05-31',
      totalUsd: 6000,
      origen: 'consolidacion_manual',
      metadata: { area: 'mina' },
      semanaCount: 3,
      label: 'Ciclo A',
    };
    const deduped = dedupeNominaPeriodoSummaries([
      { ...base, id: '1', createdAt: '2026-05-01T10:00:00Z' },
      { ...base, id: '2', createdAt: '2026-05-02T10:00:00Z' },
    ]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.id, '2');
    assert.equal(
      manualPeriodoDedupKey({
        rangeStart: base.rangeStart,
        rangeEnd: base.rangeEnd,
        area: 'mina',
        origen: base.origen,
      }),
      'consolidacion_manual|mina|2026-05-11|2026-05-31',
    );
  });
});
