import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aplicarPrediccionBonoColumnas,
  posicionColumnaBonoTransporteEsquema,
  sugerirEstatusDefaultSemana,
} from '@/lib/rotacion-plantillas/bono-transporte-semana';

describe('bono-transporte-semana', () => {
  it('MOLINO_15X15 predice bono en columna índice 1', () => {
    assert.equal(posicionColumnaBonoTransporteEsquema('MOLINO_15X15'), 1);
    assert.equal(sugerirEstatusDefaultSemana(1, 'MOLINO_15X15'), 'bono_transporte_paga');
    assert.equal(sugerirEstatusDefaultSemana(0, 'MOLINO_15X15'), 'libre_paga');
  });

  it('MOLINO_14X14 no predice columna bono automática', () => {
    assert.equal(posicionColumnaBonoTransporteEsquema('MOLINO_14X14'), null);
  });

  it('aplicarPrediccionBonoColumnas marca columna 1 en 15x15', () => {
    const semanas = [
      { id: 'a', nombre: 'Libre', orden: 0, estatusDefault: 'libre_paga' as const },
      { id: 'b', nombre: 'Trabajo', orden: 1, estatusDefault: 'trabajada_paga' as const },
    ];
    const out = aplicarPrediccionBonoColumnas(semanas, 'MOLINO_15X15');
    assert.equal(out[1]?.estatusDefault, 'bono_transporte_paga');
  });
});
