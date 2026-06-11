import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarCierreRotacionInstancia,
  validarCierreRotacionParaSemana,
  calcularSubtotalesCuadrilla,
} from '@/lib/rotacion-plantillas/cierre-rotacion';
import { buildInstanciaSnapshot } from '@/lib/rotacion-plantillas/projection';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';

const plantilla: RotacionPlantillaRecord = {
  id: 'p1',
  nombre: 'Mina',
  descripcion: '',
  area: 'mina',
  activo: true,
  created_at: '',
  updated_at: '',
  cuadrillas: [
    {
      id: 'c1',
      nombre: 'V1',
      asignacionKey: '',
      orden: 0,
      semanas: [
        { id: 's1', nombre: 'Sem1', orden: 0, estatusDefault: 'libre_paga' },
        { id: 's2', nombre: 'Sem2', orden: 1, estatusDefault: 'trabajada_paga' },
      ],
      filas: [{ id: 'f1', personalId: 'w1', celdas: {} }],
    },
  ],
};

function snap(posicion: number) {
  return buildInstanciaSnapshot(
    { id: 'i1', plantilla_id: 'p1', fecha_inicio_ciclo: '2026-06-01', estado: 'ACTIVA' },
    plantilla,
    [{ id: 'ic1', cuadrilla_id: 'c1', posicion_activa: posicion, estado: 'ACTIVA', ciclos_completados: 0 }],
    [{ id: 'c1', nombre: 'V1', asignacion_key: null }],
  );
}

describe('rotacion cierre integracion', () => {
  it('bloquea posición 1 si posición 0 no auditada', () => {
    const instancia = snap(1);
    const cuadrilla = instancia.cuadrillas[0];
    const v = validarCierreRotacionParaSemana({
      instancia,
      cuadrilla,
      semanaInicio: '2026-06-08',
      semanaFin: '2026-06-14',
      hoy: '2026-06-14',
      historialInstancia: [],
    });
    assert.equal(v.ok, false);
  });

  it('permite posición 0 en primera semana', () => {
    const instancia = snap(0);
    const v = validarCierreRotacionInstancia({
      instancia,
      rows: [{ personalId: 'w1', total: 100, bonoTransporte: 0, diasTrabajados: 0 }],
      semanaInicio: '2026-06-01',
      semanaFin: '2026-06-07',
      hoy: '2026-06-07',
      historialInstancia: [],
    });
    assert.equal(v.ok, true);
  });

  it('calcularSubtotalesCuadrilla suma filas', () => {
    const instancia = snap(0);
    const sub = calcularSubtotalesCuadrilla(instancia.cuadrillas[0], [
      { personalId: 'w1', total: 150, bonoTransporte: 20, diasTrabajados: 7 },
    ]);
    assert.equal(sub.subtotalUsd, 150);
    assert.equal(sub.trabajadoresCount, 1);
  });
});
