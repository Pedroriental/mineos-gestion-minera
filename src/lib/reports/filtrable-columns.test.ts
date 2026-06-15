import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FILTRABLE_COLUMNS, getTableConfig } from '@/lib/reports/filtrable-columns';

describe('filtrable-columns', () => {
  it('expone balance_diario para el constructor', () => {
    assert.ok(FILTRABLE_COLUMNS.balance_diario);
    assert.equal(FILTRABLE_COLUMNS.balance_diario.table, 'balance_diario');
    assert.equal(FILTRABLE_COLUMNS.balance_diario.defaultGroupBy, 'dia');
    assert.deepEqual(FILTRABLE_COLUMNS.balance_diario.groupByOptions, ['dia', 'semana', 'mes', 'ano']);
  });

  it('getTableConfig(balance) resuelve balance_diario', () => {
    const cfg = getTableConfig('balance');
    assert.ok(cfg);
    assert.equal(cfg?.dateColumn, 'fecha');
    assert.ok(cfg?.columns.some((c) => c.key === 'rentabilidad_usd'));
    assert.ok(cfg?.columns.some((c) => c.key === 'gasto_nomina_usd'));
  });

  it('getTableConfig(reconciliacion) expone filtros opcionales', () => {
    const cfg = getTableConfig('reconciliacion');
    assert.ok(cfg);
    assert.deepEqual(cfg?.groupByOptions, ['periodo']);
    assert.ok(cfg?.columns.some((c) => c.key === 'molino'));
  });
});
