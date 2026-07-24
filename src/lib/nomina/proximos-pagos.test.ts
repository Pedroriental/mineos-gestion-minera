import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildProximosPagosForecast } from '@/lib/nomina/proximos-pagos';
import type { InstanciaActivaSnapshot } from '@/lib/rotacion-plantillas/projection';
import type { Personal } from '@/lib/types';

function makePersonal(overrides: Partial<Personal> = {}): Personal {
  return {
    id: 'p-1',
    cedula: '12345678',
    nombre_completo: 'Trabajador Prueba',
    cargo: 'Vertical 1PD',
    area: 'mina',
    area_detalle: 'Vertical 1PD',
    salario_base: 140,
    salario_libre: 100,
    bono_transporte: 0,
    estatus: 'ACTIVO',
    fecha_ingreso: '2026-01-01',
    activo: true,
    estado_laboral: 'ACTIVO',
    esquema_rotacion: 'MINA_2X1',
    rotacion_inicio_fecha: '2026-06-01',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makeInstanciaActiva(personalId = 'p-1'): InstanciaActivaSnapshot {
  return {
    id: 'inst-1',
    plantillaId: 'tpl-1',
    plantillaNombre: 'Plantilla mina',
    area: 'mina',
    fechaInicioCiclo: '2026-06-01',
    periodoOperativo: null,
    estado: 'ACTIVA',
    personalCuadrillaMap: new Map([[personalId, 'cuad-1']]),
    cuadrillas: [
      {
        id: 'inst-cuad-1',
        cuadrillaId: 'cuad-1',
        cuadrillaNombre: 'Vertical 1PD',
        asignacionKey: 'Vertical 1PD',
        posicionActiva: 2,
        estado: 'ACTIVA',
        ciclosCompletados: 0,
        desfaseInicial: 0,
        modoRepeticion: 'continua',
        semanas: [
          { id: 's-1', nombre: 'Día', orden: 0, estatusDefault: 'trabajada_paga' },
          { id: 's-2', nombre: 'Noche', orden: 1, estatusDefault: 'trabajada_paga' },
          { id: 's-3', nombre: 'Libre', orden: 2, estatusDefault: 'libre_paga' },
        ],
        filas: [{ id: 'fila-1', personalId, celdas: {} }],
      },
    ],
  };
}

describe('buildProximosPagosForecast', () => {
  it('arranca en la semana operativa abierta, no en la siguiente', () => {
    const [first, second, third] = buildProximosPagosForecast({
      personal: [makePersonal()],
      area: 'mina',
      fromWeekStart: '2026-06-01',
      weeksAhead: 3,
    });

    assert.equal(first.weekStart, '2026-06-01');
    assert.equal(first.totalUsd, 140);
    assert.equal(second.totalUsd, 140);
    assert.equal(third.totalUsd, 100);
  });

  it('respeta Molino 14x14: dos trabajadas, libre pagada y libre sin pago', () => {
    const forecast = buildProximosPagosForecast({
      personal: [
        makePersonal({
          area: 'planta',
          area_detalle: 'Molinos- Grupo (mixto)',
          cargo: 'Molinos- Grupo (mixto)',
          esquema_rotacion: 'MOLINO_14X14',
          rotacion_inicio_fecha: '2026-06-01',
        }),
      ],
      area: 'planta',
      fromWeekStart: '2026-06-01',
      weeksAhead: 4,
    });

    assert.deepEqual(
      forecast.map((week) => week.totalUsd),
      [140, 140, 100, 0],
    );
    assert.equal(forecast[3].sinPago, 1);
  });

  it('descuenta vales pendientes solo en la primera semana proyectada', () => {
    const forecast = buildProximosPagosForecast({
      personal: [makePersonal({ esquema_rotacion: 'FIJO_SEMANAL', salario_base: 200 })],
      area: 'mina',
      fromWeekStart: '2026-06-01',
      weeksAhead: 2,
      valesPorPersonal: { 'p-1': 50 },
    });

    assert.equal(forecast[0].totalUsd, 150);
    assert.equal(forecast[0].valesAplicados, 50);
    assert.equal(forecast[1].totalUsd, 200);
    assert.equal(forecast[1].valesAplicados, 0);
  });

  it('usa plantilla operativa activa antes que la rotación base', () => {
    const forecast = buildProximosPagosForecast({
      personal: [makePersonal()],
      area: 'mina',
      fromWeekStart: '2026-06-01',
      weeksAhead: 1,
      instanciaActiva: makeInstanciaActiva(),
    });

    assert.equal(forecast[0].totalUsd, 100);
    assert.equal(forecast[0].porPlantilla, 1);
    assert.equal(forecast[0].porRotacion, 0);
    assert.equal(forecast[0].confianza, 'alta');
  });

  it('marca baja confianza cuando un esquema rotativo no tiene ancla de rotación', () => {
    const forecast = buildProximosPagosForecast({
      personal: [
        makePersonal({
          esquema_rotacion: 'MOLINO_15X15',
          rotacion_inicio_fecha: undefined,
        }),
      ],
      area: 'mina',
      fromWeekStart: '2026-06-01',
      weeksAhead: 1,
    });

    assert.equal(forecast[0].configIncompleta, 1);
    assert.equal(forecast[0].confianza, 'baja');
    assert.match(forecast[0].notas.join(' '), /sin fecha de inicio/);
  });

  it('resuelve turnos escalonados en cargos operativos (ej. Cocina con Lilibeth y su par)', () => {
    const cocineroA = makePersonal({
      id: 'p-lilibeth',
      nombre_completo: 'Lilibeth Cocinera',
      cargo: 'Cocina',
      area: 'mina',
      esquema_rotacion: 'MINA_2X1',
      rotacion_inicio_fecha: '2025-12-01',
      salario_base: 140,
      salario_libre: 100,
    });

    const cocineroB = makePersonal({
      id: 'p-cocinero2',
      nombre_completo: 'Cocinero Par',
      cargo: 'Cocina',
      area: 'mina',
      esquema_rotacion: 'MINA_2X1',
      rotacion_inicio_fecha: '2025-12-08',
      salario_base: 140,
      salario_libre: 100,
    });

    const forecast = buildProximosPagosForecast({
      personal: [cocineroA, cocineroB],
      area: 'mina',
      fromWeekStart: '2026-01-12',
      weeksAhead: 2,
    });

    // Semana 1 (2026-01-12):
    // Cocinero A (ancla 01/12/2025 -> +6 sem % 3 = 0): 'trabajada' ($140)
    // Cocinero B (ancla 08/12/2025 -> +5 sem % 3 = 2): 'libre' ($100)
    const week1Workers = forecast[0].workers;
    const workerA_W1 = week1Workers.find((w) => w.personalId === 'p-lilibeth');
    const workerB_W1 = week1Workers.find((w) => w.personalId === 'p-cocinero2');

    assert.equal(workerA_W1?.estado, 'trabajada');
    assert.equal(workerA_W1?.amount, 140);
    assert.equal(workerB_W1?.estado, 'libre');
    assert.equal(workerB_W1?.amount, 100);
    assert.equal(forecast[0].enTurno, 1);
    assert.equal(forecast[0].libresPagadas, 1);
    assert.equal(forecast[0].totalUsd, 240);

    // Semana 2 (2026-01-19):
    // Cocinero A (+7 sem % 3 = 1): 'trabajada' ($140)
    // Cocinero B (+6 sem % 3 = 0): 'trabajada' ($140)
    const week2Workers = forecast[1].workers;
    const workerA_W2 = week2Workers.find((w) => w.personalId === 'p-lilibeth');
    const workerB_W2 = week2Workers.find((w) => w.personalId === 'p-cocinero2');

    assert.equal(workerA_W2?.estado, 'trabajada');
    assert.equal(workerB_W2?.estado, 'trabajada');
    assert.equal(forecast[1].enTurno, 2);
    assert.equal(forecast[1].totalUsd, 280);
  });

  it('fuerza bono_transporte = 0 en mina pero permite evaluarlo en molinos', () => {
    const minaWorker = makePersonal({
      id: 'p-mina',
      cargo: 'Vertical 1PD',
      area_detalle: 'Vertical 1PD',
      area: 'mina',
      bono_transporte: 0,
      esquema_rotacion: 'MINA_2X1',
      salario_base: 150,
    });

    const molinoWorker = makePersonal({
      id: 'p-molino',
      cargo: 'Molinos- Grupo (mixto)',
      area_detalle: 'Molinos- Grupo (mixto)',
      area: 'planta',
      bono_transporte: 50,
      esquema_rotacion: 'MOLINO_14X14',
      salario_base: 150,
    });

    const instanciaMina: InstanciaActivaSnapshot = {
      ...makeInstanciaActiva('p-mina'),
      area: 'mina',
      personalCuadrillaMap: new Map([['p-mina', 'cuad-1']]),
      cuadrillas: [
        {
          id: 'c-1',
          cuadrillaId: 'cuad-1',
          cuadrillaNombre: 'Vertical 1PD',
          asignacionKey: 'Vertical 1PD',
          posicionActiva: 0,
          estado: 'ACTIVA',
          ciclosCompletados: 0,
          desfaseInicial: 0,
          modoRepeticion: 'continua',
          semanas: [{ id: 's-1', nombre: 'Bono', orden: 0, estatusDefault: 'bono_transporte_paga' }],
          filas: [{ id: 'f-1', personalId: 'p-mina', celdas: {} }],
        },
      ],
    };

    const instanciaMolino: InstanciaActivaSnapshot = {
      ...makeInstanciaActiva('p-molino'),
      area: 'planta',
      personalCuadrillaMap: new Map([['p-molino', 'cuad-2']]),
      cuadrillas: [
        {
          id: 'c-2',
          cuadrillaId: 'cuad-2',
          cuadrillaNombre: 'Molinos- Grupo (mixto)',
          asignacionKey: 'Molinos- Grupo (mixto)',
          posicionActiva: 0,
          estado: 'ACTIVA',
          ciclosCompletados: 0,
          desfaseInicial: 0,
          modoRepeticion: 'continua',
          semanas: [{ id: 's-1', nombre: 'Bono', orden: 0, estatusDefault: 'bono_transporte_paga' }],
          filas: [{ id: 'f-2', personalId: 'p-molino', celdas: {} }],
        },
      ],
    };

    const forecastMina = buildProximosPagosForecast({
      personal: [minaWorker],
      area: 'mina',
      fromWeekStart: '2026-06-01',
      weeksAhead: 1,
      instanciaActiva: instanciaMina,
    });

    const forecastMolino = buildProximosPagosForecast({
      personal: [molinoWorker],
      area: 'planta',
      fromWeekStart: '2026-06-01',
      weeksAhead: 1,
      instanciaActiva: instanciaMolino,
    });

    // En mina no hay bono de transporte ($0)
    assert.equal(forecastMina[0].totalUsd, 0);

    // En planta se evalúa normalmente el bono de transporte ($50)
    assert.equal(forecastMolino[0].totalUsd, 50);
  });

  it('asigna confianza según la integridad de las fechas de rotación', () => {
    const completeWorker = makePersonal({
      id: 'p-ok',
      esquema_rotacion: 'MINA_2X1',
      rotacion_inicio_fecha: '2026-01-01',
    });

    const incompleteWorker = makePersonal({
      id: 'p-no-date',
      esquema_rotacion: 'MINA_2X1',
      rotacion_inicio_fecha: undefined,
    });

    const altaForecast = buildProximosPagosForecast({
      personal: [completeWorker],
      area: 'mina',
      fromWeekStart: '2026-06-01',
      weeksAhead: 1,
    });

    const bajaForecast = buildProximosPagosForecast({
      personal: [completeWorker, incompleteWorker],
      area: 'mina',
      fromWeekStart: '2026-06-01',
      weeksAhead: 1,
    });

    assert.equal(altaForecast[0].confianza, 'alta');
    assert.equal(bajaForecast[0].confianza, 'baja');
  });
});

