import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateNominaSemanas,
  assignNominaSemanaToMonthKey,
  buildNominaPeriodFilter,
  buildNominaPeriodFilterFromRange,
  buildNominaSemanasDateFilter,
  dedupeNominaSemanasForAggregation,
  inferNominaPeriodKind,
  nominaSemanaCierraEnMes,
  type NominaSemanaRow,
} from '@/lib/nomina/nomina-read-model';

const row = (
  partial: Partial<NominaSemanaRow> & Pick<NominaSemanaRow, 'id' | 'semana_inicio' | 'semana_fin'>,
): NominaSemanaRow => ({
  area: 'mina',
  total_pagado: 0,
  ...partial,
});

describe('inferNominaPeriodKind', () => {
  it('detects day, week, month and range', () => {
    assert.equal(inferNominaPeriodKind('2026-05-15', '2026-05-15'), 'day');
    assert.equal(inferNominaPeriodKind('2026-05-12', '2026-05-18'), 'week');
    assert.equal(inferNominaPeriodKind('2026-05-01', '2026-05-31'), 'month');
    assert.equal(inferNominaPeriodKind('2026-05-10', '2026-05-20'), 'range');
  });
});

describe('buildNominaPeriodFilter', () => {
  it('uses semana_fin for month and range', () => {
    const month = buildNominaPeriodFilter('month', { from: '2026-05-01', to: '2026-05-31' });
    assert.equal(month['mode'], 'semana_fin');
    if (month['mode'] === 'semana_fin') {
      assert.equal(month.semanaFinGte, '2026-05-01');
      assert.equal(month.semanaFinLte, '2026-05-31');
    }
  });

  it('uses semana_inicio for week', () => {
    const week = buildNominaPeriodFilter('week', { from: '2026-05-12', to: '2026-05-18' });
    assert.equal(week['mode'], 'semana_inicio');
  });

  it('uses overlap for day drill-down', () => {
    const day = buildNominaPeriodFilter('day', {
      from: '2026-05-15',
      to: '2026-05-15',
      dia: '2026-05-15',
    });
    assert.equal(day['mode'], 'contiene_dia');
  });
});

describe('buildNominaSemanasDateFilter', () => {
  it('matches gastos resumen month filter', () => {
    const filter = buildNominaSemanasDateFilter({
      desde: '2026-05-01',
      hasta: '2026-05-31',
      dia: null,
    });
    assert.equal(filter['mode'], 'semana_fin');
  });
});

describe('nominaSemanaCierraEnMes', () => {
  it('includes week ending May 3 in May', () => {
    assert.equal(nominaSemanaCierraEnMes('2026-05-03', '2026-05'), true);
  });

  it('excludes week ending May 3 from April', () => {
    assert.equal(nominaSemanaCierraEnMes('2026-05-03', '2026-04'), false);
  });
});

describe('dedupeNominaSemanasForAggregation', () => {
  it('sums mina and planta in same week', () => {
    const rows = [
      row({ id: '1', semana_inicio: '2026-05-05', semana_fin: '2026-05-11', area: 'mina', total_pagado: 100 }),
      row({ id: '2', semana_inicio: '2026-05-05', semana_fin: '2026-05-11', area: 'planta', total_pagado: 50 }),
    ];
    const agg = aggregateNominaSemanas(rows);
    assert.equal(agg.totalUsd, 150);
    assert.equal(agg.rowCount, 2);
  });

  it('dedupes same week and area keeping periodo_id row', () => {
    const rows = [
      row({
        id: '1',
        semana_inicio: '2026-05-05',
        semana_fin: '2026-05-11',
        area: 'mina',
        total_pagado: 100,
        periodo_id: null,
      }),
      row({
        id: '2',
        semana_inicio: '2026-05-05',
        semana_fin: '2026-05-11',
        area: 'mina',
        total_pagado: 120,
        periodo_id: 'p1',
      }),
    ];
    const deduped = dedupeNominaSemanasForAggregation(rows, { activePeriodoId: 'p1' });
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]!.id, '2');
    assert.equal(aggregateNominaSemanas(rows).totalUsd, 120);
  });
});

describe('assignNominaSemanaToMonthKey', () => {
  it('assigns cross-month week to closing month', () => {
    assert.match(assignNominaSemanaToMonthKey('2026-04-03'), /abril/i);
  });
});

describe('buildNominaPeriodFilterFromRange', () => {
  it('sums all weeks closing in range', () => {
    const filter = buildNominaPeriodFilterFromRange('2026-05-01', '2026-05-31');
    assert.equal(filter['mode'], 'semana_fin');
    const rows = [
      row({ id: '1', semana_inicio: '2026-04-28', semana_fin: '2026-05-03', total_pagado: 10 }),
      row({ id: '2', semana_inicio: '2026-05-05', semana_fin: '2026-05-11', total_pagado: 20 }),
      row({ id: '3', semana_inicio: '2026-05-05', semana_fin: '2026-05-11', area: 'planta', total_pagado: 5 }),
    ];
    const agg = aggregateNominaSemanas(rows);
    assert.equal(agg.totalUsd, 35);
  });
});
