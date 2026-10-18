import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildColumnasCorte,
  buildFilaCorteTrabajador,
  parseSupervisorListInput,
} from './corte-grupo-engine';
import type { Personal } from '@/lib/types';

function makeWorker(overrides: Partial<Personal> = {}): Personal {
  return {
    id: overrides.id ?? 'w-1',
    cedula: overrides.cedula ?? '12345678',
    nombre_completo: overrides.nombre_completo ?? 'Juan Perez',
    cargo: overrides.cargo ?? 'Minero',
    area: overrides.area ?? 'mina',
    area_detalle: overrides.area_detalle ?? 'Grupo 1',
    salario_base: overrides.salario_base ?? 100,
    salario_libre: overrides.salario_libre ?? 100,
    bono_transporte: overrides.bono_transporte ?? 0,
    esquema_rotacion: 'MINA_2X1',
    estatus: 'ACTIVO',
    fecha_ingreso: '2026-01-01',
    activo: true,
    created_at: '',
    updated_at: '',
  };
}

describe('corte-grupo-engine', () => {
  it('calcula $300 para veterano y $200 para nuevo en corte de Mina de 3 semanas ($100/sem)', () => {
    const columnas = buildColumnasCorte('mina_corte_3sem', '2026-10-12');
    assert.equal(columnas.length, 3);
    assert.equal(columnas[0].weekStart, '2026-09-28'); // Libre previa
    assert.equal(columnas[1].weekStart, '2026-10-05'); // Trabajada 1
    assert.equal(columnas[2].weekStart, '2026-10-12'); // Trabajada 2

    const veteran = makeWorker({ id: 'vet-1', salario_base: 100, salario_libre: 100 });
    const newHire = makeWorker({ id: 'new-1', salario_base: 100, salario_libre: 100 });

    const filaVet = buildFilaCorteTrabajador({
      personal: veteran,
      area: 'mina',
      columnas,
      esNuevoEnCiclo: false,
      valesTotal: 0,
    });
    assert.equal(filaVet.semanas['2026-09-28'].estadoAsistencia, 'libre');
    assert.equal(filaVet.semanas['2026-09-28'].totalSemana, 100);
    assert.equal(filaVet.totalNetoCorte, 300);

    const filaNew = buildFilaCorteTrabajador({
      personal: newHire,
      area: 'mina',
      columnas,
      esNuevoEnCiclo: true,
      valesTotal: 0,
    });
    assert.equal(filaNew.semanas['2026-09-28'].estadoAsistencia, 'no_laborado');
    assert.equal(filaNew.semanas['2026-09-28'].totalSemana, 0);
    assert.equal(filaNew.totalNetoCorte, 200);
  });

  it('calcula Molinos Regreso (1 Libre Pagada + 1 Libre $0 + 1 Trabajada) y Salida (+30$ Bono Carro)', () => {
    const workerMolino = makeWorker({
      id: 'mol-1',
      area: 'planta',
      salario_base: 100,
      salario_libre: 100,
      bono_transporte: 30,
    });

    const colsRegreso = buildColumnasCorte('molino_regreso_3sem', '2026-10-19', undefined, 'planta');
    const filaRegreso = buildFilaCorteTrabajador({
      personal: workerMolino,
      area: 'planta',
      columnas: colsRegreso,
      esNuevoEnCiclo: false,
      valesTotal: 0,
    });
    assert.equal(filaRegreso.totalBrutoCorte, 200);
    assert.equal(filaRegreso.totalBonoTransporteCorte, 0);
    assert.equal(filaRegreso.totalNetoCorte, 200);

    const colsSalida = buildColumnasCorte('molino_salida_1sem', '2026-10-12', undefined, 'planta');
    const filaSalida = buildFilaCorteTrabajador({
      personal: workerMolino,
      area: 'planta',
      columnas: colsSalida,
      esNuevoEnCiclo: false,
      valesTotal: 0,
    });
    assert.equal(filaSalida.totalBrutoCorte, 100);
    assert.equal(filaSalida.totalBonoTransporteCorte, 30);
    assert.equal(filaSalida.totalNetoCorte, 130);
  });

  it('parsea lista de supervisor de WhatsApp con fuzzy match, días, pago extra, nuevo y carro $30', () => {
    const catalog = [
      makeWorker({ id: '1', nombre_completo: 'Carlos Eduardo Rodriguez', cedula: '19888777' }),
      makeWorker({ id: '2', nombre_completo: 'Jose Gregorio Martinez', cedula: '20111222' }),
    ];

    const raw = [
      '1. Carlos Rodriguez - 4d +25$ extra nuevo',
      '2. Jose Martinez carro 30$',
    ].join('\n');

    const parsed = parseSupervisorListInput(raw, catalog, 'mina');
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].matchedPersonal?.id, '1');
    assert.equal(parsed[0].diasTrabajados, 4);
    assert.equal(parsed[0].pagoExtra, 25);
    assert.equal(parsed[0].esNuevoExplicito, true);

    assert.equal(parsed[1].matchedPersonal?.id, '2');
    assert.equal(parsed[1].bonoTransporteOverride, 30);
  });
});
