import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBalanceModuleFilters,
  applyModuleFilters,
  matchesColumnFilter,
  recomputeBalanceTotals,
} from '@/lib/reports/apply-module-filters';

describe('apply-module-filters', () => {
  const rows = [
    {
      periodo_label: '2026-05-01',
      rentabilidad_usd: 100,
      ingreso_total_usd: 500,
      gasto_nomina_usd: 200,
      margen_pct: 20,
    },
    {
      periodo_label: '2026-05-02',
      rentabilidad_usd: -50,
      ingreso_total_usd: 300,
      gasto_nomina_usd: 350,
      margen_pct: -16.67,
    },
  ];

  it('matchesColumnFilter soporta gte/lte', () => {
    assert.equal(matchesColumnFilter(100, { gte: 50 }), true);
    assert.equal(matchesColumnFilter(100, { lte: 80 }), false);
  });

  it('applyModuleFilters filtra por rentabilidad_usd', () => {
    const filtered = applyModuleFilters(rows, {
      rentabilidad_usd: { gte: 0 },
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].periodo_label, '2026-05-01');
  });

  it('recomputeBalanceTotals suma filas filtradas', () => {
    const filtered = applyModuleFilters(rows, { rentabilidad_usd: { gte: 0 } });
    const totals = recomputeBalanceTotals(filtered);
    assert.equal(totals.rentabilidad_usd, 100);
    assert.equal(totals.ingreso_total_usd, 500);
    assert.equal(totals.margen_pct, 20);
  });

  it('applyBalanceModuleFilters recalcula totales post-filtro', () => {
    const result = applyBalanceModuleFilters(
      { rows, totals: { rentabilidad_usd: 50 } },
      { rentabilidad_usd: { gte: 0 } },
    );
    assert.equal(result.rows?.length, 1);
    assert.equal(result.totals?.rentabilidad_usd, 100);
  });
});
