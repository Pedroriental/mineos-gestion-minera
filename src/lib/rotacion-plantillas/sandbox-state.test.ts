import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptySandbox,
  sandboxReducer,
  validateSandbox,
} from '@/lib/rotacion-plantillas/sandbox-state';

describe('rotacion plantilla sandbox', () => {
  it('no permite quitar la ultima semana si no es plantilla solo bono transporte', () => {
    const state = {
      ...createEmptySandbox('planta'),
      nombre: 'Molinos normal',
    };
    const cuadrilla = state.cuadrillas[0];
    const semana = cuadrilla.semanas[0];

    const next = sandboxReducer(state, {
      type: 'REMOVE_SEMANA',
      payload: { cuadrillaId: cuadrilla.id, id: semana.id },
    });

    assert.equal(next.cuadrillas[0].semanas.length, 1);
    assert.equal(validateSandbox(next), null);
  });

  it('permite una plantilla sin semanas cuando solo se carga bono transporte', () => {
    const base = {
      ...createEmptySandbox('planta'),
      nombre: 'Molinos Bono Transporte',
    };
    const cuadrilla = base.cuadrillas[0];
    const semana = cuadrilla.semanas[0];
    const withBonoColumn = sandboxReducer(base, {
      type: 'SET_CUADRILLA_COLUMNAS',
      payload: { id: cuadrilla.id, columnasVista: ['nombre', 'cedula', 'bono_transporte', 'total_periodo'] },
    });

    const next = sandboxReducer(withBonoColumn, {
      type: 'REMOVE_SEMANA',
      payload: { cuadrillaId: cuadrilla.id, id: semana.id },
    });

    assert.equal(next.cuadrillas[0].semanas.length, 0);
    assert.equal(validateSandbox(next), null);
  });
});
