import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExplicitAsistenciaPay,
  calculateNominaRowPay,
  defaultDiasTrabajados,
  resolveEstadoYDias,
} from '@/lib/nomina-calculo';

const personal = {
  esquema_rotacion: 'FIJO_SEMANAL' as const,
  rotacion_inicio_fecha: '2026-01-01',
  salario_base: 700,
  salario_libre: 350,
  bono_transporte: 70,
  area: 'mina' as const,
  area_detalle: 'extracción',
};

describe('resolveEstadoYDias', () => {
  it('libre permanece libre con 0 días (no se confunde con falta)', () => {
    assert.deepEqual(resolveEstadoYDias('libre', 7), {
      estadoAsistencia: 'libre',
      diasTrabajados: 0,
    });
    assert.deepEqual(resolveEstadoYDias('libre', 0), {
      estadoAsistencia: 'libre',
      diasTrabajados: 0,
    });
  });

  it('falta permanece no_laborado con 0 días', () => {
    assert.deepEqual(resolveEstadoYDias('no_laborado', 0), {
      estadoAsistencia: 'no_laborado',
      diasTrabajados: 0,
    });
  });

  it('turno con días > 0 es trabajada', () => {
    assert.deepEqual(resolveEstadoYDias('trabajada', 7), {
      estadoAsistencia: 'trabajada',
      diasTrabajados: 7,
    });
  });

  it('turno con 0 días cae en falta', () => {
    assert.deepEqual(resolveEstadoYDias('trabajada', 0), {
      estadoAsistencia: 'no_laborado',
      diasTrabajados: 0,
    });
  });
});

describe('defaultDiasTrabajados', () => {
  it('libre y falta devuelven 0; turno 7', () => {
    assert.equal(defaultDiasTrabajados('libre'), 0);
    assert.equal(defaultDiasTrabajados('no_laborado'), 0);
    assert.equal(defaultDiasTrabajados('trabajada'), 7);
  });
});

describe('calculateNominaRowPay asistencia', () => {
  const week = '2026-05-11';

  it('turno paga salario base', () => {
    const pay = calculateNominaRowPay({
      personal,
      estadoAsistencia: 'trabajada',
      diasTrabajados: 7,
      weekStart: week,
      totalVales: 0,
    });
    assert.equal(pay.salarioBaseCalculado, 700);
    assert.equal(pay.esSemanaLibre, false);
  });

  it('libre paga salario libre', () => {
    const pay = calculateNominaRowPay({
      personal,
      estadoAsistencia: 'libre',
      diasTrabajados: 0,
      weekStart: week,
      totalVales: 0,
    });
    assert.equal(pay.salarioBaseCalculado, 350);
    assert.equal(pay.esSemanaLibre, true);
  });

  it('falta no paga sueldo', () => {
    const pay = calculateNominaRowPay({
      personal,
      estadoAsistencia: 'no_laborado',
      diasTrabajados: 0,
      weekStart: week,
      totalVales: 0,
    });
    assert.equal(pay.salarioBaseCalculado, 0);
    assert.equal(pay.esSemanaLibre, false);
  });

  it('turno fijo no administrativo cobra bono transporte maestro automáticamente', () => {
    const pay = calculateNominaRowPay({
      personal: {
        ...personal,
        area: 'mina',
        area_detalle: 'Vertical 1PD',
        bono_transporte: 70,
      },
      estadoAsistencia: 'trabajada',
      diasTrabajados: 7,
      weekStart: week,
      totalVales: 0,
    });
    assert.equal(pay.bonoTransporte, 70);
    assert.equal(pay.total, 770);
  });
});

describe('calculateNominaRowPay ciclos reales', () => {
  it('Mina 14x7 paga dos semanas trabajadas y la tercera libre plana', () => {
    const mina = {
      ...personal,
      esquema_rotacion: 'MINA_2X1' as const,
      rotacion_inicio_fecha: '2026-06-01',
      salario_base: 140,
      salario_libre: 100,
      bono_transporte: 0,
    };

    assert.equal(
      calculateNominaRowPay({
        personal: mina,
        estadoAsistencia: 'trabajada',
        diasTrabajados: 7,
        weekStart: '2026-06-01',
      }).total,
      140,
    );
    assert.equal(
      calculateNominaRowPay({
        personal: mina,
        estadoAsistencia: 'trabajada',
        diasTrabajados: 3,
        weekStart: '2026-06-08',
      }).total,
      60,
    );
    assert.equal(
      calculateNominaRowPay({
        personal: mina,
        estadoAsistencia: 'libre',
        diasTrabajados: 0,
        weekStart: '2026-06-15',
      }).total,
      100,
    );
  });

  it('Molinos 14x14 paga dos trabajadas, una libre pagada y una libre $0 sin transporte automático', () => {
    const molino = {
      ...personal,
      area: 'planta' as const,
      area_detalle: 'Molinos- Grupo (mixto)',
      esquema_rotacion: 'MOLINO_14X14' as const,
      rotacion_inicio_fecha: '2026-06-01',
      salario_base: 140,
      salario_libre: 100,
      bono_transporte: 35,
    };

    const semanaTrabajada1 = calculateNominaRowPay({
      personal: molino,
      estadoAsistencia: 'trabajada',
      diasTrabajados: 7,
      weekStart: '2026-06-01',
    });
    assert.equal(semanaTrabajada1.salarioBaseCalculado, 140);
    assert.equal(semanaTrabajada1.bonoTransporte, 0);
    assert.equal(semanaTrabajada1.total, 140);

    const semanaTrabajada2 = calculateNominaRowPay({
      personal: molino,
      estadoAsistencia: 'trabajada',
      diasTrabajados: 7,
      weekStart: '2026-06-08',
    });
    assert.equal(semanaTrabajada2.salarioBaseCalculado, 140);
    assert.equal(semanaTrabajada2.bonoTransporte, 0);
    assert.equal(semanaTrabajada2.total, 140);

    const librePagada = calculateNominaRowPay({
      personal: molino,
      estadoAsistencia: 'libre',
      diasTrabajados: 0,
      weekStart: '2026-06-15',
    });
    assert.equal(librePagada.salarioBaseCalculado, 100);
    assert.equal(librePagada.bonoTransporte, 0);
    assert.equal(librePagada.total, 100);

    const libreSinPago = calculateNominaRowPay({
      personal: molino,
      estadoAsistencia: 'no_laborado',
      diasTrabajados: 0,
      weekStart: '2026-06-22',
    });
    assert.equal(libreSinPago.salarioBaseCalculado, 0);
    assert.equal(libreSinPago.bonoTransporte, 0);
    assert.equal(libreSinPago.total, 0);
  });

  it('Molinos 14x14 permite capturar transporte como componente separado con motivo en cierre', () => {
    const molino = {
      ...personal,
      area: 'planta' as const,
      area_detalle: 'Molinos- Grupo (mixto)',
      esquema_rotacion: 'MOLINO_14X14' as const,
      rotacion_inicio_fecha: '2026-06-01',
      salario_base: 140,
      salario_libre: 100,
      bono_transporte: 35,
    };
    const pay = calculateNominaRowPay({
      personal: molino,
      estadoAsistencia: 'trabajada',
      diasTrabajados: 7,
      weekStart: '2026-06-01',
      bonoTransporte: 35,
    });
    assert.equal(pay.salarioBaseCalculado, 140);
    assert.equal(pay.bonoTransporte, 35);
    assert.equal(pay.total, 175);
  });
});

describe('calculateExplicitAsistenciaPay plantilla', () => {
  const admin = {
    salario_base: 150,
    salario_libre: 150,
    bono_transporte: 0,
    area: 'administracion' as const,
    area_detalle: 'Recursos Humanos',
  };

  it('falta explícita no paga aunque el esquema personal esté en semana libre', () => {
    const pay = calculateExplicitAsistenciaPay({
      personal: admin,
      estadoAsistencia: 'no_laborado',
      diasTrabajados: 0,
      totalVales: 0,
    });
    assert.equal(pay.salarioBaseCalculado, 0);
    assert.equal(pay.total, 0);
  });

  it('turno paga salario base proporcional', () => {
    const pay = calculateExplicitAsistenciaPay({
      personal: admin,
      estadoAsistencia: 'trabajada',
      diasTrabajados: 7,
      totalVales: 0,
    });
    assert.equal(pay.salarioBaseCalculado, 150);
  });

  it('libre paga salario libre', () => {
    const pay = calculateExplicitAsistenciaPay({
      personal: { ...admin, salario_libre: 125 },
      estadoAsistencia: 'libre',
      diasTrabajados: 0,
      totalVales: 0,
    });
    assert.equal(pay.salarioBaseCalculado, 125);
  });
});
