import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDiasGuardiaToFilaCorte,
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

  it('parsea OCR de foto de cuadro de supervisor (14d, 12d, 7d, cédulas OCR y nombres pegados)', () => {
    const catalog = [
      makeWorker({ id: 'm1', nombre_completo: 'Manuel Bermudez', cedula: '23924471', salario_base: 150 }),
      makeWorker({ id: 'm2', nombre_completo: 'Geraldine Betancourt', cedula: '16812724', salario_base: 100 }),
      makeWorker({ id: 'm3', nombre_completo: 'Jose Carvajal', cedula: '26228445', salario_base: 100 }),
      makeWorker({ id: 'm4', nombre_completo: 'Luis Garcia', cedula: '27077687', salario_base: 100 }),
    ];

    const ocrSample = [
      'LISTADO DE TRABAJADORES - NOMINA MINA',
      'Item | Nombre y Apellido | Cedula | Cargos | Frente | USD / Semana',
      '| + [BermudesManuel | 23924471 | Martilero | vi |i5000|2143|14 | 0000) 15000] —- | — ssoco]',
      '| 2 IaetancoutGeraldime — | 1612724 | Cocinera | vi | 10000] 1429] 7 | woo] -| — | 1000]',
      '| 13 [Carahllose | 26220405 | Recortero | VI | 1000] 1429|12] ma| -—| -—|',
      '22 [Garcia | 27077687 | Recorero | v2 | 10000] 1420/14] 200) -—| -| 200',
    ].join('\n');

    const parsed = parseSupervisorListInput(ocrSample, catalog, 'mina');
    assert.equal(parsed.length, 4);

    // 1. Manuel Bermudez: 14 días, con libre, $150/sem
    assert.equal(parsed[0].matchedPersonal?.id, 'm1');
    assert.equal(parsed[0].diasGuardiaTotal, 14);
    assert.equal(parsed[0].cobraSemanaLibre, true);
    assert.equal(parsed[0].salarioOverride, 150);

    // 2. Geraldine Betancourt: cédula OCR 1612724 -> 16812724, 7 días, sin libre ($100)
    assert.equal(parsed[1].matchedPersonal?.id, 'm2');
    assert.equal(parsed[1].diasGuardiaTotal, 7);
    assert.equal(parsed[1].cobraSemanaLibre, false);

    // 3. Jose Carvajal: cédula OCR 26220405 -> 26228445, 12 días, sin libre ($171.43)
    assert.equal(parsed[2].matchedPersonal?.id, 'm3');
    assert.equal(parsed[2].diasGuardiaTotal, 12);
    assert.equal(parsed[2].cobraSemanaLibre, false);

    // 4. Luis Garcia: 14 días pero con "- | - | 200" (sin semana libre, $200)
    assert.equal(parsed[3].matchedPersonal?.id, 'm4');
    assert.equal(parsed[3].diasGuardiaTotal, 14);
    assert.equal(parsed[3].cobraSemanaLibre, false);

    // Verificar cálculo exacto de 12 días ($171.43) en la matriz de corte
    const columnas = buildColumnasCorte('mina_corte_3sem', '2026-10-12');
    let filaCarvajal = buildFilaCorteTrabajador({
      personal: catalog[2],
      area: 'mina',
      columnas,
      esNuevoEnCiclo: true,
    });
    filaCarvajal = applyDiasGuardiaToFilaCorte(filaCarvajal, 12, columnas);
    assert.equal(filaCarvajal.totalNetoCorte, 171.43);
  });
});
