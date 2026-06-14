import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWeekRangeAfterOperationalCierre,
  resolveWorkingWeek,
} from '@/lib/nomina/temporal-context';

describe('temporal-context', () => {
  it('resolveWeekRangeAfterOperationalCierre avanza a la semana de trabajo calculada', () => {
    const closed = '2026-05-04';
    const semanas = [{ semana_inicio: '2026-04-27', semana_fin: '2026-05-03' }];
    const withClosed = [...semanas, { semana_inicio: closed, semana_fin: '2026-05-10' }];
    const next = resolveWeekRangeAfterOperationalCierre(semanas, closed, '2026-05-10');
    assert.deepEqual(next, resolveWorkingWeek(withClosed));
  });

  it('resolveWeekRangeAfterOperationalCierre no duplica si la semana ya está en historial', () => {
    const closed = '2026-05-04';
    const semanas = [
      { semana_inicio: '2026-04-27', semana_fin: '2026-05-03' },
      { semana_inicio: closed, semana_fin: '2026-05-10' },
    ];
    const a = resolveWeekRangeAfterOperationalCierre(semanas, closed, '2026-05-10');
    const b = resolveWorkingWeek(semanas);
    assert.deepEqual(a, b);
  });
});
