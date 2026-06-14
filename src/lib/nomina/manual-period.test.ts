import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeManualPeriodProgress,
  formatManualWeekLabel,
  manualPeriodWeekStarts,
  nextWeekInManualPeriod,
  previousWeekInManualPeriod,
  resolveClosedOperationalSemana,
  resolveClosedSemanaForManualPeriod,
  resolveManualPeriodWeekColumn,
  weekInManualPeriod,
  stripPeriodoLabelPrefix,
  manualPeriodConsolidateLabel,
  dedupeNominaPeriodoSummaries,
  manualPeriodoDedupKey,
} from '@/lib/nomina/manual-period';
import {
  filterManualPeriodsEnCurso,
  isManualPeriodEnCurso,
  periodsEnCurso,
  resolveManualPeriodForWeek,
  sanitizeManualPeriodsSession,
  type ManualPeriodsSession,
} from '@/lib/nomina/manual-period-session';

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
      { id: 's-1', semana_inicio: weeks[0], total_pagado: 1000 },
      { id: 's-2', semana_inicio: weeks[1], total_pagado: 1200 },
    ];
    const p = computeManualPeriodProgress(period, semanas);
    assert.equal(p.closedCount, 2);
    assert.equal(p.totalUsd, 2200);
    assert.equal(p.weekTotalsUsd[weeks[0]], 1000);
    assert.equal(p.weekTotalsUsd[weeks[1]], 1200);
    assert.equal(p.allClosed, false);
  });

  it('resolveClosedSemanaForManualPeriod ignora cierre de otro ciclo con misma fecha', () => {
    const period4 = {
      id: 'ciclo-4',
      label: '4ta semana',
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-24',
      plantillaId: 'pl-1',
      plantillaNombre: '14x7',
      semanaIds: ['sem-4'],
    };
    const semanas = [
      { id: 'sem-4', semana_inicio: '2026-05-18', total_pagado: 1200 },
      { id: 'sem-5', semana_inicio: '2026-05-18', total_pagado: 1989 },
    ];
    const hit = resolveClosedSemanaForManualPeriod(period4, semanas, '2026-05-18', 'mina');
    assert.equal(hit?.id, 'sem-4');
    assert.equal(hit?.total_pagado, 1200);
    assert.equal(
      resolveClosedSemanaForManualPeriod(period4, semanas, '2026-05-18', 'mina')?.id,
      'sem-4',
    );
    assert.equal(
      resolveClosedSemanaForManualPeriod(
        { ...period4, semanaIds: [] },
        semanas,
        '2026-05-18',
        'mina',
      ),
      undefined,
    );
    assert.equal(
      resolveClosedSemanaForManualPeriod(period4, semanas, '2026-05-25', 'mina'),
      undefined,
    );
  });

  it('resolveClosedOperationalSemana no cruza Mina con Molinos por coincidir fecha', () => {
    const semanas = [
      { id: 'molinos', semana_inicio: '2026-04-27', area: 'planta', total_pagado: 950 },
      { id: 'mina-next', semana_inicio: '2026-05-04', area: 'mina', total_pagado: 1075 },
    ];
    assert.equal(
      resolveClosedOperationalSemana(semanas, '2026-04-27', 'mina'),
      undefined,
    );
    assert.equal(
      resolveClosedOperationalSemana(semanas, '2026-04-27', 'planta')?.id,
      'molinos',
    );
  });

  it('resolveClosedOperationalSemana conserva fallback legacy solo si la semana no tiene area', () => {
    const semanas = [
      { id: 'legacy', semana_inicio: '2026-04-27', total_pagado: 800 },
      { id: 'molinos', semana_inicio: '2026-04-27', area: 'planta', total_pagado: 950 },
    ];
    assert.equal(
      resolveClosedOperationalSemana(semanas, '2026-04-27', 'mina')?.id,
      'legacy',
    );
  });

  it('isManualPeriodEnCurso excluye réplicas arch- y deduplica ciclos locales', () => {
    const mp = {
      id: 'mp-1',
      label: '5ta Semana',
      rangeStart: '2026-05-11',
      rangeEnd: '2026-05-31',
      plantillaId: 'pl',
      plantillaNombre: 'P',
      semanaIds: [],
    };
    const arch = { ...mp, id: 'arch-db-1', periodoArchivoId: 'db-1' };
    assert.equal(isManualPeriodEnCurso(mp), true);
    assert.equal(isManualPeriodEnCurso(arch), false);
    const deduped = filterManualPeriodsEnCurso([
      mp,
      { ...mp, id: 'mp-2' },
      arch,
    ]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.id, 'mp-2');
    const session = sanitizeManualPeriodsSession({
      periods: [mp, arch, { ...mp, id: 'mp-2' }],
      editorPeriodId: 'arch-db-1',
      workingWeekPeriodId: 'arch-db-1',
      historicalPeriodId: 'arch-db-1',
    });
    assert.equal(periodsEnCurso(session).length, 1);
    assert.equal(session.editorPeriodId, 'mp-2');
  });

  it('resolveManualPeriodForWeek prefiere editor sobre histórico en rangos solapados', () => {
    const session: ManualPeriodsSession = {
      periods: [
        {
          id: 'c4',
          label: '4ta',
          rangeStart: '2026-05-04',
          rangeEnd: '2026-05-24',
          plantillaId: 'pl',
          plantillaNombre: 'P',
          semanaIds: [],
        },
        {
          id: 'c5',
          label: '5ta',
          rangeStart: '2026-05-18',
          rangeEnd: '2026-06-14',
          plantillaId: 'pl',
          plantillaNombre: 'P',
          semanaIds: [],
        },
      ],
      editorPeriodId: 'c4',
      workingWeekPeriodId: null,
      historicalPeriodId: 'c5',
    };
    const resolved = resolveManualPeriodForWeek(session, '2026-05-18', '2026-06-01');
    assert.equal(resolved?.id, 'c4');
  });

  it('computeManualPeriodProgress solo cuenta semanas del ciclo (semanaIds)', () => {
    const period = {
      id: 'ciclo-a',
      label: '4ta semana',
      rangeStart: '2026-05-04',
      rangeEnd: '2026-06-24',
      plantillaId: 'pl-1',
      plantillaNombre: '14x7',
      semanaIds: ['sem-a'],
    };
    const semanas = [
      { id: 'sem-a', semana_inicio: '2026-05-11', total_pagado: 1675 },
      { id: 'sem-b', semana_inicio: '2026-05-18', total_pagado: 1989 },
    ];
    const p = computeManualPeriodProgress(period, semanas, 'mina');
    assert.equal(p.closedCount, 1);
    assert.equal(p.totalUsd, 1675);
    assert.equal(p.weekTotalsUsd['2026-05-11'], 1675);
    assert.equal(p.weekTotalsUsd['2026-05-18'], undefined);
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
