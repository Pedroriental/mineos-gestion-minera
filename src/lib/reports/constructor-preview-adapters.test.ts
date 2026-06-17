import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { balanceSummaryFromModuleData } from '@/lib/reports/constructor-preview-adapters';

describe('constructor-preview-adapters', () => {
  it('reconstruye BalanceSummary desde ModuleReportData', () => {
    const summary = balanceSummaryFromModuleData({
      rows: [
        {
          periodo: '2026-05',
          periodo_label: 'May 2026',
          oro_g: 10,
          ingreso_oro_usd: 1000,
          ingreso_arenas_usd: 200,
          ingreso_total_usd: 1200,
          gasto_nomina_usd: 300,
          gasto_insumos_usd: 50,
          gasto_operativo_usd: 150,
          gasto_total_usd: 500,
          rentabilidad_usd: 700,
          margen_pct: 58.3,
        },
      ],
      totals: {
        ingreso_oro_usd: 1000,
        ingreso_arenas_usd: 200,
        ingreso_total_usd: 1200,
        gasto_nomina_usd: 300,
        gasto_operativo_usd: 200,
        gasto_total_usd: 500,
        rentabilidad_usd: 700,
        margen_pct: 58.3,
      },
    });

    assert.ok(summary);
    assert.equal(summary!.kpis.ingresoTotalUsd, 1200);
    assert.equal(summary!.rows.length, 1);
    assert.equal(summary!.rows[0]!.grupo, 'May 2026');
    assert.equal(summary!.rows[0]!.gastosInsumos, 50);
  });

  it('retorna null sin filas ni totales', () => {
    assert.equal(balanceSummaryFromModuleData({}), null);
  });
});
