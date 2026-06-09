import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_SNAPSHOT } from '@/lib/biblioteca-catalog';
import { resolveBibliotecaLabel } from './biblioteca-display';

describe('resolveBibliotecaLabel', () => {
  it('convierte mina_belen a Mina Belén', () => {
    assert.equal(resolveBibliotecaLabel(FALLBACK_SNAPSHOT, 'minas', 'mina_belen'), 'Mina Belén');
  });

  it('convierte mina-belen a Mina Belén', () => {
    assert.equal(resolveBibliotecaLabel(FALLBACK_SNAPSHOT, 'minas', 'mina-belen'), 'Mina Belén');
  });

  it('deja pasar etiqueta ya legible', () => {
    assert.equal(resolveBibliotecaLabel(FALLBACK_SNAPSHOT, 'minas', 'Mina Belén'), 'Mina Belén');
  });
});
