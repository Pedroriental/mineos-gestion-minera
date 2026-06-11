import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  asignacionMatchesCuadrilla,
  cuadrillaMatchScore,
} from '@/lib/rotacion-plantillas/sandbox-state';
import {
  resolveCuadrillaForPersonal,
  nominaRowBelongsToCuadrilla,
  buildManualPlantillaNominaRows,
} from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import { resolveWorkerRotacionContext } from '@/lib/rotacion-plantillas/projection';
import type { Personal } from '@/lib/types';
import type { InstanciaActivaSnapshot } from '@/lib/rotacion-plantillas/projection';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';

const compresor = {
  id: 'cq-comp',
  nombre: 'MINA BELÉN - TÉCNICO OPERADOR DE COMPRESOR - TRAB.',
  asignacionKey: 'MINA BELÉN - TÉCNICO OPERADOR DE COMPRESOR - TRAB.',
  orden: 0,
  semanas: [{ id: 's1', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
  filas: [{ id: 'f1', personalId: 'p-yosel', orden: 0 }],
};

const barrenador = {
  id: 'cq-bar',
  nombre: 'MINA BELÉN - TÉCNICO AYUDANTE BARRENADOR - TRAB.',
  asignacionKey: 'MINA BELÉN - TÉCNICO AYUDANTE BARRENADOR - TRAB.',
  orden: 1,
  semanas: [{ id: 's2', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
  filas: [],
};

const plantilla: RotacionPlantillaRecord = {
  id: 'pl-1',
  nombre: 'Vertical',
  descripcion: '',
  area: 'mina',
  columnasVista: [],
  cuadrillas: [compresor, barrenador],
};

const yosel: Personal = {
  id: 'p-yosel',
  nombre_completo: 'Yosel Lereico',
  cedula: '25.552.939',
  cargo: '',
  area: 'mina',
  area_detalle: 'Mina Belén - Técnico Ayudante Barrenador',
  salario_base: 150,
  esquema_rotacion: 'FIJO_SEMANAL',
  activo: true,
  estatus: 'ACTIVO',
};

describe('asignacionMatchesCuadrilla', () => {
  it('no confunde cuadrillas técnicas distintas', () => {
    assert.ok(
      asignacionMatchesCuadrilla(
        'Mina Belén - Técnico Ayudante Barrenador',
        barrenador,
      ),
    );
    assert.equal(
      asignacionMatchesCuadrilla(
        'Mina Belén - Técnico Ayudante Barrenador',
        compresor,
      ),
      false,
    );
    assert.ok(
      cuadrillaMatchScore('Mina Belén - Técnico Ayudante Barrenador', barrenador) >
        cuadrillaMatchScore('Mina Belén - Técnico Ayudante Barrenador', compresor),
    );
  });

  it('sigue aceptando asignación biblioteca más corta', () => {
    assert.ok(
      asignacionMatchesCuadrilla('Mina Belén - Administración', {
        nombre: 'MINA BELÉN - ADMINISTRACIÓN MINA - TRAB.',
        asignacionKey: 'MINA BELÉN - ADMINISTRACIÓN MINA - TRAB.',
      }),
    );
  });
});

describe('resolveCuadrillaForPersonal', () => {
  it('prioriza asignación del modal sobre fila previa de plantilla', () => {
    const match = resolveCuadrillaForPersonal(plantilla, yosel, [
      compresor.id,
      barrenador.id,
    ]);
    assert.equal(match?.id, barrenador.id);
  });
});

describe('buildManualPlantillaNominaRows con asignación explícita', () => {
  it('no agrupa en compresor si la fila ya proyectó barrenador (aunque siga en fila de plantilla)', () => {
    const row = buildManualPlantillaNominaRows({
      plantilla,
      personalCatalog: [yosel],
      personalIds: [yosel.id],
      weekStart: '2026-05-11',
      periodStart: '2026-05-11',
      periodEnd: '2026-05-17',
      valesMap: {},
      weekEnd: '2026-05-17',
    })[0];
    assert.equal(row.cuadrillaNombre, barrenador.nombre);
    assert.equal(
      nominaRowBelongsToCuadrilla(row, compresor.nombre, plantilla),
      false,
    );
    assert.ok(nominaRowBelongsToCuadrilla(row, barrenador.nombre, plantilla));
  });

  it('cuadrillaNombre resuelto manda sobre fuzzy match al agrupar', () => {
    const row = {
      personal: { ...yosel, area_detalle: 'Mina Belén' },
      cuadrillaNombre: barrenador.nombre,
    };
    assert.equal(
      nominaRowBelongsToCuadrilla(row, compresor.nombre, plantilla),
      false,
    );
    assert.ok(nominaRowBelongsToCuadrilla(row, barrenador.nombre, plantilla));
  });
});

describe('resolveWorkerRotacionContext', () => {
  it('no aplica rotación de plantilla si la asignación apunta a otra cuadrilla', () => {
    const instancia: InstanciaActivaSnapshot = {
      id: 'inst-1',
      plantillaId: plantilla.id,
      plantillaNombre: plantilla.nombre,
      area: 'mina',
      fechaInicioCiclo: '2026-05-01',
      periodoOperativo: null,
      estado: 'ACTIVA',
      personalCuadrillaMap: new Map([[yosel.id, compresor.id]]),
      cuadrillas: [
        {
          id: 'ic-comp',
          cuadrillaId: compresor.id,
          cuadrillaNombre: compresor.nombre,
          asignacionKey: compresor.asignacionKey,
          posicionActiva: 0,
          estado: 'ACTIVA',
          ciclosCompletados: 0,
          desfaseInicial: 0,
          semanas: compresor.semanas,
          filas: compresor.filas,
        },
      ],
    };

    const ctx = resolveWorkerRotacionContext(yosel, instancia, '2026-05-11');
    assert.equal(ctx, null);
  });
});
