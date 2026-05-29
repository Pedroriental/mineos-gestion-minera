import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RECONCILIATION_PARAMS, type PrecioOroAplicado } from '@/lib/reconciliation/types';
import {
  buildRawInputs,
  buildSnapshot,
  evaluateRules,
} from '@/lib/reconciliation/reconciliation-engine';
import { aggregateBalance } from '@/lib/reconciliation/aggregate-balance';
import { computeOperationalInputs } from '@/lib/reconciliation/operational-inputs';
import { metaForPeriod, projectToPeriodEnd, cumplimientoPct } from '@/lib/reconciliation/projection';

describe('projection', () => {
  it('calculates meta for period', () => {
    const meta = metaForPeriod(15, '2026-05-01', '2026-05-07');
    assert.equal(meta, 15 * 7);
  });

  it('projects linear closure', () => {
    const proj = projectToPeriodEnd(30, '2026-05-01', '2026-05-10', new Date('2026-05-05'));
    assert.ok(proj > 30);
  });

  it('cumplimiento pct', () => {
    assert.equal(cumplimientoPct(75, 100), 75);
  });
});

describe('reconciliation-engine', () => {
  const inputs = buildRawInputs({
    sacosExtraccion: 1000,
    sacosProduccion: 980,
    oroPlantaG: 90,
    oroQuemadoG: 88,
    tonProcesadas: 10,
    ingresoArenasUsd: 500,
    gastoNominaUsd: 2000,
    gastoOperativoUsd: 1500,
    nominaRegistrosUsd: 2000,
    nominaSemanasUsd: 2010,
    precioOroUsd: 80,
  });

  it('flags sacos rule within tolerance', () => {
    const rules = evaluateRules(inputs, DEFAULT_RECONCILIATION_PARAMS, null);
    const sacos = rules.find((r) => r.id === 'sacos_mina_planta');
    assert.ok(sacos);
    assert.equal(sacos!.status, 'ok');
  });

  it('builds snapshot with macro', () => {
    const precioOro: PrecioOroAplicado = {
      usdPorGramo: 80,
      modo: 'manual',
      fuenteEtiqueta: 'manual',
      origenUi: 'Biblioteca',
      fechaCache: null,
    };
    const snap = buildSnapshot(
      { from: '2026-05-01', to: '2026-05-07' },
      DEFAULT_RECONCILIATION_PARAMS,
      inputs,
      null,
      precioOro,
    );
    assert.ok(snap.macro.realOroG > 0);
    assert.ok(snap.rules.length >= 5);
  });
});

describe('aggregate-balance uses motor KPIs', () => {
  it('balance KPIs match computeOperationalInputs', () => {
    const balance = {
      produccion: [
        { fecha: '2026-05-01', oro_recuperado_g: 100, sacos: 10, toneladas_procesadas: 5 } as never,
      ],
      gastos: [{ fecha: '2026-05-01', monto: 500 } as never],
      nomina: [{ semana_inicio: '2026-05-01', monto_pagado: 1000 } as never],
      ventasArenas: [{ fecha: '2026-05-01', total_venta: 200 } as never],
    };
    const precio = 80;
    const inputs = computeOperationalInputs({
      balance,
      produccion: balance.produccion,
      sacosExtraccion: 0,
      oroQuemadoG: 0,
      nominaSemanasUsd: 1000,
      precioOroUsd: precio,
    });
    const summary = aggregateBalance(balance, 'semana', precio, 0, 0, 1000);
    assert.equal(summary.kpis.ingresoOroUsd, Number(inputs.ingresoOroUsd.toFixed(2)));
    assert.equal(summary.kpis.margenRentabilidadPct, Number(inputs.margenPct.toFixed(2)));
    assert.equal(summary.kpis.costoPorGramoOro, Number(inputs.costoPorGramo.toFixed(2)));
  });
});
