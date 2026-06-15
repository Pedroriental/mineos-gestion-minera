import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBalanceOperativoDivergence,
  parseBalanceOperativoRpc,
} from '@/lib/reconciliation/balance-operativo-rpc';
import { buildRawInputs } from '@/lib/reconciliation/reconciliation-engine';

describe('balance-operativo-rpc', () => {
  it('parseBalanceOperativoRpc normaliza campos numéricos', () => {
    const parsed = parseBalanceOperativoRpc({
      ingreso_oro_usd: '1200.5',
      nomina_semanas_usd: 800,
      gastos_usd: 300,
    });
    assert.ok(parsed);
    assert.equal(parsed!.ingreso_oro_usd, 1200.5);
    assert.equal(parsed!.nomina_semanas_usd, 800);
  });

  it('buildBalanceOperativoDivergence marca diferencias relevantes', () => {
    const inputs = buildRawInputs({
      sacosExtraccion: 0,
      sacosProduccion: 0,
      oroPlantaG: 10,
      oroQuemadoG: 10,
      tonProcesadas: 1,
      ingresoArenasUsd: 0,
      gastoNominaUsd: 1000,
      gastoOperativoUsd: 500,
      nominaRegistrosUsd: 1000,
      nominaSemanasUsd: 1000,
      precioOroUsd: 80,
    });

    const divergence = buildBalanceOperativoDivergence(
      inputs,
      parseBalanceOperativoRpc({
        ingreso_oro_usd: 700,
        nomina_semanas_usd: 500,
        gastos_usd: 500,
      }),
      3,
    );

    assert.ok(divergence);
    assert.equal(divergence!.flagged, true);
    assert.equal(divergence!.nominaDiffUsd, 500);
  });
});
