import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildManualPlantillaNominaRows,
  nominaRowBelongsToCuadrilla,
  remapWeekColumnCuadrillasForPlantilla,
} from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import type { Personal } from '@/lib/types';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';

const plantilla: RotacionPlantillaRecord = {
  id: 'pl-1',
  nombre: 'Vertical',
  descripcion: '',
  area: 'mina',
  activo: true,
  created_at: '',
  updated_at: '',
  columnasVista: [],
  cuadrillas: [
    {
      id: 'cq-1',
      nombre: 'MINA BELÉN - ADMINISTRACIÓN MINA - TRAB.',
      asignacionKey: 'MINA BELÉN - ADMINISTRACIÓN MINA - TRAB.',
      orden: 0,
      semanas: [
        {
          id: 's1',
          nombre: 'Semana 1',
          orden: 0,
          estatusDefault: 'trabajada_paga',
        },
      ],
      filas: [],
    },
  ],
};

const worker: Personal = {
  id: 'p-1',
  nombre_completo: 'Cedeño Alexander',
  cedula: '21.669.002',
  cargo: 'Operador',
  area: 'mina',
  area_detalle: 'MINA BELÉN - ADMINISTRACIÓN MINA - TRAB.',
  salario_base: 125,
  esquema_rotacion: 'FIJO_SEMANAL',
  activo: true,
  estatus: 'ACTIVO',
  salario_libre: 100,
  bono_transporte: 0,
  fecha_ingreso: '2026-01-01',
  created_at: '',
  updated_at: '',
};

describe('buildManualPlantillaNominaRows', () => {
  it('no incluye trabajadores por coincidencia de cuadrilla sin personalIds explícitos', () => {
    const rows = buildManualPlantillaNominaRows({
      plantilla,
      personalCatalog: [worker],
      personalIds: [],
      weekStart: '2026-05-11',
      periodStart: '2026-05-11',
      periodEnd: '2026-05-17',
      valesMap: {},
      weekEnd: '2026-05-17',
    });
    assert.equal(rows.length, 0);
  });

  it('proyecta fila solo para personalIds indicados', () => {
    const rows = buildManualPlantillaNominaRows({
      plantilla,
      personalCatalog: [worker],
      personalIds: [worker.id],
      weekStart: '2026-05-11',
      periodStart: '2026-05-11',
      periodEnd: '2026-05-17',
      valesMap: {},
      weekEnd: '2026-05-17',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].personal.id, worker.id);
    assert.equal(rows[0].rotacionFuente, 'plantilla');
  });

  it('alinea cuadrillaNombre de carga manual con la plantilla aunque area_detalle difiera', () => {
    const workerBiblioteca: Personal = {
      ...worker,
      id: 'p-2',
      area_detalle: 'Mina Belén - Administración',
    };
    const rows = buildManualPlantillaNominaRows({
      plantilla,
      personalCatalog: [workerBiblioteca],
      personalIds: [workerBiblioteca.id],
      weekStart: '2026-05-11',
      periodStart: '2026-05-11',
      periodEnd: '2026-05-17',
      valesMap: {},
      weekEnd: '2026-05-17',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].cuadrillaNombre, plantilla.cuadrillas[0].nombre);
    assert.ok(
      nominaRowBelongsToCuadrilla(rows[0], plantilla.cuadrillas[0].nombre, plantilla),
    );
  });
});

describe('remapWeekColumnCuadrillasForPlantilla', () => {
  const plantillaV2: RotacionPlantillaRecord = {
    ...plantilla,
    cuadrillas: [
      { ...plantilla.cuadrillas[0], id: 'cq-new-1' },
      {
        id: 'cq-new-2',
        nombre: 'Vertical 1PD',
        asignacionKey: 'Vertical 1PD',
        orden: 1,
        semanas: plantilla.cuadrillas[0].semanas,
        filas: [],
      },
    ],
  };

  it('remapea por nombre cuando los UUID de cuadrilla cambiaron', () => {
    const remapped = remapWeekColumnCuadrillasForPlantilla(
      [['cq-old-1'], ['cq-old-1', 'cq-old-2']],
      plantillaV2,
      2,
      [['MINA BELÉN - ADMINISTRACIÓN MINA - TRAB.'], ['MINA BELÉN - ADMINISTRACIÓN MINA - TRAB.', 'Vertical 1PD']],
    );
    assert.deepEqual(remapped, [['cq-new-1'], ['cq-new-1', 'cq-new-2']]);
  });

  it('usa todas las cuadrillas si los ids guardados ya no existen y no hay nombres', () => {
    const remapped = remapWeekColumnCuadrillasForPlantilla(
      [['cq-old-1']],
      plantillaV2,
      1,
    );
    assert.deepEqual(remapped, [['cq-new-1', 'cq-new-2']]);
  });
});
