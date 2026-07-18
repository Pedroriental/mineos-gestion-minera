import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  avanzarPosicionCuadrilla,
  posicionEfectivaCuadrilla,
  posicionInicialCuadrilla,
  resolveAsistenciaDesdePlantilla,
  resolveEstatusCuadrilla,
  resolveWorkerRotacionContext,
  buildInstanciaSnapshot,
  semanaAplicaInstanciaRotacion,
} from '@/lib/rotacion-plantillas/projection';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';

const plantillaBase: RotacionPlantillaRecord = {
  id: 'p1',
  nombre: 'Test',
  descripcion: '',
  area: 'mina',
  activo: true,
  created_at: '',
  updated_at: '',
  cuadrillas: [
    {
      id: 'c1',
      nombre: 'Vertical 1',
      asignacionKey: 'Vertical 1',
      orden: 0,
      semanas: [
        { id: 's1', nombre: 'Libre', orden: 0, estatusDefault: 'libre_paga' },
        { id: 's2', nombre: 'Trabajo', orden: 1, estatusDefault: 'trabajada_paga' },
      ],
      filas: [{ id: 'f1', personalId: 'worker-1', celdas: {} }],
    },
  ],
};

describe('rotacion projection', () => {
  it('posicionInicialCuadrilla aplica desfase', () => {
    assert.equal(posicionInicialCuadrilla(1, 4), 1);
    assert.equal(posicionInicialCuadrilla(5, 4), 1);
  });

  it('resolveEstatusCuadrilla usa columna activa', () => {
    const est = resolveEstatusCuadrilla(plantillaBase.cuadrillas[0], 1);
    assert.equal(est, 'trabajada_paga');
  });

  it('resolveAsistenciaDesdePlantilla mapea libre', () => {
    const r = resolveAsistenciaDesdePlantilla('libre_paga');
    assert.equal(r.estadoAsistencia, 'libre');
    assert.equal(r.diasInputBloqueado, true);
  });

  it('resolveWorkerRotacionContext devuelve contexto plantilla', () => {
    const snap = buildInstanciaSnapshot(
      { id: 'i1', plantilla_id: 'p1', fecha_inicio_ciclo: '2026-06-01', estado: 'ACTIVA' },
      plantillaBase,
      [{ id: 'ic1', cuadrilla_id: 'c1', posicion_activa: 0, estado: 'ACTIVA', ciclos_completados: 0 }],
      [{ id: 'c1', nombre: 'Vertical 1', asignacion_key: 'Vertical 1' }],
    );

    const ctx = resolveWorkerRotacionContext({ id: 'worker-1', cargo: '', area: 'mina', area_detalle: 'Vertical 1' }, snap, '2026-06-02');
    assert.ok(ctx);
    assert.equal(ctx!.cuadrillaNombre, 'Vertical 1');
    assert.equal(ctx!.estatus, 'libre_paga');
    assert.equal(ctx!.estadoAsistencia, 'libre');
  });

  it('fijo semanal no hereda libre de la columna en periodo manual', async () => {
    const { resolveManualPlantillaWorker } = await import(
      '@/lib/rotacion-plantillas/manual-plantilla-projection'
    );
    const admin = {
      id: 'worker-1',
      nombre_completo: 'Admin Molinos',
      cedula: '1',
      cargo: 'Administrativo',
      area: 'planta',
      area_detalle: 'Vertical 1',
      esquema_rotacion: 'MOLINO_FIJO',
      salario_base: 125,
      estatus: 'ACTIVO',
    } as unknown as import('@/lib/types').Personal;

    // Semana 1 del periodo → columna 0 = «Libre» en la plantilla
    const ctx = resolveManualPlantillaWorker(
      plantillaBase,
      admin,
      '2026-06-01',
      '2026-06-01',
      '2026-06-14',
    );
    assert.ok(ctx);
    assert.equal(ctx!.estatus, 'trabajada_paga');
    assert.equal(ctx!.estadoAsistencia, 'trabajada');

    // Un rotativo en la misma columna sí queda libre
    const rotativo = { ...admin, id: 'worker-1', esquema_rotacion: 'MINA_2X1' } as typeof admin;
    const ctxRot = resolveManualPlantillaWorker(
      plantillaBase,
      rotativo,
      '2026-06-01',
      '2026-06-01',
      '2026-06-14',
    );
    assert.ok(ctxRot);
    assert.equal(ctxRot!.estatus, 'libre_paga');
  });

  it('fijo semanal no hereda libre de la columna en instancia activa', () => {
    const snap = buildInstanciaSnapshot(
      { id: 'i1', plantilla_id: 'p1', fecha_inicio_ciclo: '2026-06-01', estado: 'ACTIVA' },
      plantillaBase,
      [{ id: 'ic1', cuadrilla_id: 'c1', posicion_activa: 0, estado: 'ACTIVA', ciclos_completados: 0 }],
      [{ id: 'c1', nombre: 'Vertical 1', asignacion_key: 'Vertical 1' }],
    );

    const ctx = resolveWorkerRotacionContext(
      {
        id: 'worker-1',
        cargo: 'Administrativo',
        area: 'planta',
        area_detalle: 'Vertical 1',
        esquema_rotacion: 'FIJO_SEMANAL',
      },
      snap,
      '2026-06-02',
    );
    assert.ok(ctx);
    assert.equal(ctx!.estatus, 'trabajada_paga');
    assert.equal(ctx!.estadoAsistencia, 'trabajada');
  });

  it('resolveWorkerRotacionContext permite semanas posteriores a la fecha fin del periodo operativo', () => {
    const snap = buildInstanciaSnapshot(
      {
        id: 'i1',
        plantilla_id: 'p1',
        fecha_inicio_ciclo: '2026-06-01',
        estado: 'ACTIVA',
        periodo_operativo_label: 'Junio 2026',
        periodo_operativo_inicio: '2026-06-01',
        periodo_operativo_fin: '2026-06-30',
      },
      plantillaBase,
      [{ id: 'ic1', cuadrilla_id: 'c1', posicion_activa: 0, estado: 'ACTIVA', ciclos_completados: 0 }],
      [{ id: 'c1', nombre: 'Vertical 1', asignacion_key: 'Vertical 1' }],
    );

    assert.equal(semanaAplicaInstanciaRotacion('2026-05-26', snap), false);
    assert.equal(semanaAplicaInstanciaRotacion('2026-06-09', snap), true);
    assert.equal(semanaAplicaInstanciaRotacion('2026-07-07', snap), true); // Semana posterior a 2026-06-30
    assert.equal(resolveWorkerRotacionContext({ id: 'worker-1', cargo: '', area: 'mina', area_detalle: 'Vertical 1' }, snap, '2026-05-26'), null);
    assert.ok(resolveWorkerRotacionContext({ id: 'worker-1', cargo: '', area: 'mina', area_detalle: 'Vertical 1' }, snap, '2026-06-09'));
    assert.ok(resolveWorkerRotacionContext({ id: 'worker-1', cargo: '', area: 'mina', area_detalle: 'Vertical 1' }, snap, '2026-07-07'));
  });

  it('avanzarPosicionCuadrilla detecta vuelta completa', () => {
    const r = avanzarPosicionCuadrilla(1, 2);
    assert.equal(r.nextPosicion, 0);
    assert.equal(r.cicloCompletado, true);
  });

  it('posicionEfectivaCuadrilla normaliza', () => {
    assert.equal(posicionEfectivaCuadrilla(4, 5), 1);
  });
});
