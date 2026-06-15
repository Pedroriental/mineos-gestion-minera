import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReconciliationModuleReportData,
  parseReconciliationFiltersFromModule,
} from '@/lib/reconciliation/reconciliation-module-data';
import { DEFAULT_RECONCILIATION_PARAMS } from '@/lib/reconciliation/types';
import { buildRawInputs, buildSnapshot } from '@/lib/reconciliation/reconciliation-engine';

describe('reconciliation-module-data', () => {
  it('parseReconciliationFiltersFromModule lee molino/mina', () => {
    const filters = parseReconciliationFiltersFromModule({
      molino: 'M1',
      mina: 'V1, V2',
    });
    assert.deepEqual(filters?.molinos, ['M1']);
    assert.deepEqual(filters?.minas, ['V1', 'V2']);
  });

  it('buildReconciliationModuleReportData expone reglas tabulares', () => {
    const inputs = buildRawInputs({
      sacosExtraccion: 100,
      sacosProduccion: 98,
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

    const snapshot = buildSnapshot(
      { from: '2026-05-01', to: '2026-05-07' },
      DEFAULT_RECONCILIATION_PARAMS,
      inputs,
      null,
      {
        usdPorGramo: 80,
        modo: 'manual',
        fuenteEtiqueta: 'manual',
        origenUi: 'Biblioteca',
        fechaCache: null,
      },
    );

    const moduleData = buildReconciliationModuleReportData(snapshot);
    assert.ok(moduleData.rows && moduleData.rows.length > 0);
    assert.ok('regla' in moduleData.rows[0]);
    assert.ok(moduleData.totals?.oro_real_g !== undefined);
  });
});
