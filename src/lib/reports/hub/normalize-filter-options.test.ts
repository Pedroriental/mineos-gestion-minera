import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FILTER_OPTIONS,
  normalizeFilterOptions,
  uniqueMinasFromOptions,
} from './report-tab-fetch';

describe('normalizeFilterOptions', () => {
  it('returns empty arrays when input is partial or missing', () => {
    assert.deepEqual(normalizeFilterOptions(undefined), EMPTY_FILTER_OPTIONS);
    assert.deepEqual(normalizeFilterOptions({}), EMPTY_FILTER_OPTIONS);
    assert.deepEqual(normalizeFilterOptions({ nomina: {} }), {
      ...EMPTY_FILTER_OPTIONS,
      nomina: { cargos: [], personal: [] },
    });
  });

  it('preserves defined list fields', () => {
    const normalized = normalizeFilterOptions({
      produccion: { molinos: ['M1'], materiales: [] },
      nomina: { cargos: ['Op'], personal: [{ id: '1', nombre_completo: 'A', cedula: '1' }] },
    });
    assert.deepEqual(normalized.produccion.molinos, ['M1']);
    assert.deepEqual(normalized.nomina.personal.length, 1);
  });
});

describe('uniqueMinasFromOptions', () => {
  it('merges minas without throwing when lists are empty', () => {
    assert.deepEqual(uniqueMinasFromOptions(EMPTY_FILTER_OPTIONS), []);
    assert.deepEqual(
      uniqueMinasFromOptions(
        normalizeFilterOptions({
          voladuras: { minas: ['Alpha'], verticales: [] },
          extraccion: { minas: ['Beta'], verticales: [] },
        }),
      ),
      ['Alpha', 'Beta'],
    );
  });
});
