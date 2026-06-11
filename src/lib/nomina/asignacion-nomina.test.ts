import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_SNAPSHOT } from '@/lib/biblioteca-catalog';
import {
  isAsignacionNominaValueValid,
  resolveAsignacionNominaValue,
} from '@/lib/nomina/asignacion-nomina';

describe('asignacion-nomina', () => {
  it('acepta valores de biblioteca además de legacy', () => {
    assert.equal(isAsignacionNominaValueValid('Vertical 1PD', FALLBACK_SNAPSHOT), true);
    assert.equal(resolveAsignacionNominaValue('Vertical 1PD', FALLBACK_SNAPSHOT), 'Vertical 1PD');
  });

  it('acepta lista legacy Administración', () => {
    assert.equal(isAsignacionNominaValueValid('Administración'), true);
    assert.equal(resolveAsignacionNominaValue('Administración'), 'Administración');
  });
});
