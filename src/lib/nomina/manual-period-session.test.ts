import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyManualPeriodsSession,
  resolveManualPeriodForWeek,
  upsertPeriodInSession,
} from '@/lib/nomina/manual-period-session';

describe('manual-period-session', () => {
  it('resolveManualPeriodForWeek usa workingWeekPeriodId en semana de curso', () => {
    const live = {
      id: 'live',
      label: 'Junio curso',
      rangeStart: '2026-06-01',
      rangeEnd: '2026-06-30',
      plantillaId: 'pl-1',
      plantillaNombre: '14x7',
    };
    const hist = {
      id: 'hist',
      label: 'Mayo histórico',
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      plantillaId: 'pl-1',
      plantillaNombre: '14x7',
    };
    let session = emptyManualPeriodsSession();
    session = upsertPeriodInSession(session, live);
    session = upsertPeriodInSession(session, hist);
    session = {
      ...session,
      editorPeriodId: hist.id,
      workingWeekPeriodId: live.id,
      historicalPeriodId: hist.id,
    };

    assert.equal(
      resolveManualPeriodForWeek(session, '2026-06-09', '2026-06-09')?.id,
      'live',
    );
    assert.equal(
      resolveManualPeriodForWeek(session, '2026-05-11', '2026-06-09')?.id,
      'hist',
    );
    assert.equal(resolveManualPeriodForWeek(session, '2026-06-09', '2026-06-09')?.id, 'live');
  });
});
