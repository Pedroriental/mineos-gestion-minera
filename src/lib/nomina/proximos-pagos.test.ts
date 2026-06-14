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
});
