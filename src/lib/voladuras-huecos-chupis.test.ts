import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateChupisLineas,
  aggregateHuecosLineas,
  huecosLineasFromRecord,
  normalizeHuecosLineas,
} from './voladuras-huecos-chupis';
import type { ReporteVoladura } from './types';

describe('voladuras-huecos-chupis', () => {
  it('agrega totales y pies ponderados de huecos', () => {
    const agg = aggregateHuecosLineas([
      { tipo: 'hueco', cantidad: 4, pies: 10 },
      { tipo: 'hueco_salida', cantidad: 2, pies: 16 },
    ]);
    assert.equal(agg.cantidad, 6);
    assert.equal(agg.pies, 12);
  });

  it('agrega totales y pies ponderados de chupis', () => {
    const agg = aggregateChupisLineas([
      { cantidad: 3, pies: 4 },
      { cantidad: 1, pies: 8 },
    ]);
    assert.equal(agg.cantidad, 4);
    assert.equal(agg.pies, 5);
  });

  it('normaliza filas del formulario ignorando cantidad cero', () => {
    const lineas = normalizeHuecosLineas([
      { tipo: 'hueco', cantidad: '5', pies: '12' },
      { tipo: 'hueco_salida', cantidad: '', pies: '8' },
    ]);
    assert.deepEqual(lineas, [{ tipo: 'hueco', cantidad: 5, pies: 12 }]);
  });

  it('reconstruye líneas desde registro legacy', () => {
    const record = {
      huecos_cantidad: 7,
      huecos_pies: 9,
    } as ReporteVoladura;
    assert.deepEqual(huecosLineasFromRecord(record), [
      { tipo: 'hueco', cantidad: '7', pies: '9' },
    ]);
  });
});
