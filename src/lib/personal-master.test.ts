import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatNombrePropio } from '@/lib/personal-master';

describe('formatNombrePropio', () => {
  it('capitaliza cada palabra sin importar cómo se ingresó', () => {
    assert.equal(formatNombrePropio('CEDENO ALEXANDER'), 'Cedeno Alexander');
    assert.equal(formatNombrePropio('cedeno alexander'), 'Cedeno Alexander');
    assert.equal(formatNombrePropio('  maría   elena  '), 'María Elena');
  });

  it('respeta guiones en apellidos compuestos', () => {
    assert.equal(formatNombrePropio('PÉREZ-GÓMEZ'), 'Pérez-Gómez');
  });
});
