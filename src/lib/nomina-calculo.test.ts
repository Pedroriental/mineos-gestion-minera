import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExplicitAsistenciaPay,
  calculateNominaRowPay,
  defaultDiasTrabajados,
  resolveEstadoYDias,
} from '@/lib/nomina-calculo';

const personal = {
  esquema_rotacion: 'FIJO_SEMANAL',
  rotacion_inicio_fecha: '2026-01-01',
  salario_base: 700,
  salario_libre: 350,
  bono_transporte: 70,
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
});

describe('calculateExplicitAsistenciaPay plantilla', () => {
  const admin = {
    salario_base: 150,
    salario_libre: 150,
    bono_transporte: 0,
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
