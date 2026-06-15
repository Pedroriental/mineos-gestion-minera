import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateBalance,
  buildBalanceModuleReportData,
  normalizeBalanceGroupBy,
} from '@/lib/reconciliation/aggregate-balance';

const sampleBalance = {
  produccion: [
    { fecha: '2026-05-01', oro_recuperado_g: 100, sacos: 10, toneladas_procesadas: 5 } as never,
    { fecha: '2026-05-02', oro_recuperado_g: 50, sacos: 5, toneladas_procesadas: 2 } as never,
  ],
  gastos: [{ fecha: '2026-05-01', monto: 500 } as never],
  nomina: [
    {
      semana_inicio: '2026-04-28',
      semana_fin: '2026-05-04',
      monto_pagado: 1000,
    } as never,
  ],
  ventasArenas: [{ fecha: '2026-05-01', total_venta: 200 } as never],
};

describe('aggregate-balance constructor parity', () => {
  it('normalizeBalanceGroupBy acepta dia/semana/mes/ano', () => {
    assert.equal(normalizeBalanceGroupBy('mes'), 'mes');
    assert.equal(normalizeBalanceGroupBy('invalid'), 'dia');
  });

  it('buildBalanceModuleReportData usa los mismos KPIs que aggregateBalance', () => {
    const precio = 80;
    const summary = aggregateBalance(sampleBalance, 'semana', precio, 0, 0, 1000);
    const moduleData = buildBalanceModuleReportData(sampleBalance, 'semana', precio, 0, 0, 1000);

    assert.equal(moduleData.totals?.ingreso_oro_usd, summary.kpis.ingresoOroUsd);
    assert.equal(moduleData.totals?.rentabilidad_usd, summary.kpis.rentabilidadUsd);
    assert.equal(moduleData.totals?.gasto_nomina_usd, summary.kpis.gastoNominaUsd);
    assert.ok(moduleData.rows && moduleData.rows.length > 0);
    assert.ok('periodo_label' in moduleData.rows![0]);
    assert.ok('rentabilidad_usd' in moduleData.rows![0]);
  });

  it('agrupa por dia cuando el constructor lo pide', () => {
    const moduleData = buildBalanceModuleReportData(sampleBalance, 'dia', 80, 0, 0, 1000);
    const labels = moduleData.rows?.map((r) => r.periodo_label) ?? [];
    assert.ok(labels.some((l) => String(l).includes('01')));
    assert.ok(labels.some((l) => String(l).includes('02')));
  });
});
