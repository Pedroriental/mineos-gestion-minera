import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNominaSplitCols } from './nomina-split-cols';

describe('resolveNominaSplitCols', () => {
  it('returns empty array on non-nomina tabs even when divisiones config is missing', () => {
    assert.deepEqual(resolveNominaSplitCols('reconciliacion', undefined, undefined), []);
    assert.deepEqual(resolveNominaSplitCols('balance', undefined, undefined), []);
  });

  it('falls back to biblioteca divisiones on nomina tab', () => {
    const cols = resolveNominaSplitCols('nomina', undefined, [
      { id: 'a', nombre: 'Parte A', porcentaje: 50 },
    ]);
    assert.deepEqual(cols, [{ id: 'a', nombre: 'Parte A', montoUsd: 0 }]);
  });

  it('prefers aggregated KPI divisiones when present', () => {
    const fromKpis = [{ id: 'k', nombre: 'KPI', montoUsd: 120 }];
    const cols = resolveNominaSplitCols('nomina', fromKpis, [
      { id: 'a', nombre: 'Parte A', porcentaje: 50 },
    ]);
    assert.deepEqual(cols, fromKpis);
  });
});
