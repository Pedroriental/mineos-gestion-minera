import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildNominaSemanasDateFilter,
  nominaSemanaCierraEnMes,
  resolveGastosResumenPeriod,
} from '@/lib/gastos-resumen';

describe('buildNominaSemanasDateFilter', () => {
  it('uses semana_fin bounds for calendar month', () => {
    const period = resolveGastosResumenPeriod('2026-05');
    const filter = buildNominaSemanasDateFilter(period);
    assert.equal(filter.mode, 'semana_fin');
    if (filter.mode === 'semana_fin') {
      assert.equal(filter.semanaFinGte, '2026-05-01');
      assert.equal(filter.semanaFinLte, '2026-05-31');
    }
  });

  it('uses day overlap when filtering a single day', () => {
    const period = resolveGastosResumenPeriod('2026-05', '2026-05-15');
    const filter = buildNominaSemanasDateFilter(period);
    assert.equal(filter.mode, 'contiene_dia');
    if (filter.mode === 'contiene_dia') {
      assert.equal(filter.semanaInicioLte, '2026-05-15');
      assert.equal(filter.semanaFinGte, '2026-05-15');
    }
  });
});

describe('nominaSemanaCierraEnMes', () => {
  it('includes week ending May 3 in May', () => {
    assert.equal(nominaSemanaCierraEnMes('2026-05-03', '2026-05'), true);
  });

  it('excludes week ending April 26 from May', () => {
    assert.equal(nominaSemanaCierraEnMes('2026-04-26', '2026-05'), false);
  });

  it('excludes week ending May 3 from April', () => {
    assert.equal(nominaSemanaCierraEnMes('2026-05-03', '2026-04'), false);
  });
});
