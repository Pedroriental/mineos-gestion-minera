import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertGramosToUsd,
  formatGastoOroResumen,
  isGastoPagoOro,
  isLegacyGastoOroNota,
  roundUsd,
} from '@/lib/gastos-oro';

test('convertGramosToUsd redondea a 2 decimales', () => {
  assert.equal(convertGramosToUsd(40, 98.5), 3940);
  assert.equal(convertGramosToUsd(25, 99.68), roundUsd(25 * 99.68));
});

test('isGastoPagoOro detecta pagos en oro', () => {
  assert.equal(isGastoPagoOro({ monto_gramos_oro: 40 }), true);
  assert.equal(isGastoPagoOro({ monto_gramos_oro: null }), false);
});

test('formatGastoOroResumen', () => {
  const text = formatGastoOroResumen({
    monto: 3940,
    monto_gramos_oro: 40,
    precio_oro_usd_gramo: 98.5,
  });
  assert.match(text, /40 g × \$98\.50\/g/);
});

test('isLegacyGastoOroNota', () => {
  assert.equal(isLegacyGastoOroNota('Pago en oro (gramos)'), true);
  assert.equal(isLegacyGastoOroNota(''), false);
});
