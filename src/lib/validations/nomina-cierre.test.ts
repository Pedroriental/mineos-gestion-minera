import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CierreNominaV3Schema,
  RegistroCierreSchema,
  verificarTotalesCierre,
  type PersonalCierre,
  type RegistroCierreInput,
} from '@/lib/validations/nomina-cierre';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function basePersonal(overrides: Partial<PersonalCierre> = {}): PersonalCierre {
  return {
    id: UUID_A,
    cedula: '12345678',
    nombre_completo: 'Trabajador Prueba',
    cargo: 'Operador',
    area: 'mina',
    area_detalle: 'Vertical 1PD',
    salario_base: 140,
    salario_libre: 0,
    bono_transporte: 0,
    esquema_rotacion: 'FIJO_SEMANAL',
    rotacion_inicio_fecha: undefined,
    ...overrides,
  };
}

function baseRow(overrides: Partial<RegistroCierreInput> = {}): RegistroCierreInput {
  return {
    personalId: UUID_A,
    estadoAsistencia: 'trabajada',
    diasTrabajados: 7,
    total: 140,
    bonoTransporte: 0,
    bonificaciones: 0,
    totalVales: 0,
    novedadTurno: 'ACTIVO',
    novedadTurnoObs: '',
    ...overrides,
  };
}

function basePayload(rows: unknown[]) {
  return {
    area: 'mina',
    inicio: '2026-06-01',
    fin: '2026-06-07',
    rows,
    distribucion: [
      { id: 'pedro', nombre: '50%', porcentaje: 50, pagoDirecto: 0 },
      { id: 'la_fe', nombre: '50%', porcentaje: 50, pagoDirecto: 0 },
    ],
  };
}

describe('RegistroCierreSchema', () => {
  it('acepta un registro válido', () => {
    assert.equal(RegistroCierreSchema.safeParse(baseRow()).success, true);
  });

  it('rechaza no_laborado con días > 0', () => {
    const res = RegistroCierreSchema.safeParse(
      baseRow({ estadoAsistencia: 'no_laborado', diasTrabajados: 3 }),
    );
    assert.equal(res.success, false);
  });

  it('rechaza trabajada con 0 días', () => {
    const res = RegistroCierreSchema.safeParse(baseRow({ diasTrabajados: 0 }));
    assert.equal(res.success, false);
  });

  it('acepta libre con 0 días (tarifa plana con días bloqueados)', () => {
    const res = RegistroCierreSchema.safeParse(
      baseRow({ estadoAsistencia: 'libre', diasTrabajados: 0 }),
    );
    assert.equal(res.success, true);
  });

  it('rechaza montos negativos, no finitos o absurdos', () => {
    assert.equal(RegistroCierreSchema.safeParse(baseRow({ total: -5 })).success, false);
    assert.equal(RegistroCierreSchema.safeParse(baseRow({ total: Infinity })).success, false);
    assert.equal(RegistroCierreSchema.safeParse(baseRow({ total: 1_000_000 })).success, false);
  });

  it('rechaza días fuera de rango o no enteros', () => {
    assert.equal(RegistroCierreSchema.safeParse(baseRow({ diasTrabajados: 8 })).success, false);
    assert.equal(RegistroCierreSchema.safeParse(baseRow({ diasTrabajados: 2.5 })).success, false);
  });

  it('rechaza ajusteMotivo demasiado corto', () => {
    assert.equal(
      RegistroCierreSchema.safeParse(baseRow({ ajusteMotivo: 'ok' })).success,
      false,
    );
  });
});

describe('CierreNominaV3Schema', () => {
  it('acepta un payload válido sin userId', () => {
    assert.equal(CierreNominaV3Schema.safeParse(basePayload([baseRow()])).success, true);
  });

  it('no acepta userId del cliente (campo desconocido se ignora, nunca se usa)', () => {
    const res = CierreNominaV3Schema.safeParse({
      ...basePayload([baseRow()]),
      userId: 'fake-user-id',
    });
    assert.equal(res.success, true);
    assert.equal('userId' in res.data!, false);
  });

  it('rechaza semanas que no son de 7 días exactos', () => {
    const payload = { ...basePayload([baseRow()]), fin: '2026-06-08' };
    assert.equal(CierreNominaV3Schema.safeParse(payload).success, false);
  });

  it('rechaza áreas fuera de la lista cerrada', () => {
    const payload = { ...basePayload([baseRow()]), area: 'otra-area' };
    assert.equal(CierreNominaV3Schema.safeParse(payload).success, false);
  });

  it('rechaza trabajadores duplicados', () => {
    const payload = basePayload([baseRow(), baseRow()]);
    assert.equal(CierreNominaV3Schema.safeParse(payload).success, false);
  });

  it('rechaza cierres sin filas', () => {
    assert.equal(CierreNominaV3Schema.safeParse(basePayload([])).success, false);
  });
});

describe('verificarTotalesCierre (checksum server-side)', () => {
  it('acepta cuando el total del cliente coincide con el recalculado', () => {
    const res = verificarTotalesCierre([baseRow()], [basePersonal()], '2026-06-01');
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.totalNomina, 140);
      assert.equal(res.ajustes.length, 0);
      assert.equal(res.registros[0].salarioBaseCalculado, 140);
    }
  });

  it('rechaza un total manipulado por el cliente sin ajuste explícito', () => {
    const res = verificarTotalesCierre(
      [baseRow({ total: 9000 })],
      [basePersonal()],
      '2026-06-01',
    );
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.message, /Ajuste no auditado/);
      assert.match(res.message, /9000\.00/);
    }
  });

  it('acepta una discrepancia con ajusteMotivo explícito y la reporta', () => {
    const res = verificarTotalesCierre(
      [baseRow({ total: 120, ajusteMotivo: 'Descuento acordado por inasistencia parcial' })],
      [basePersonal()],
      '2026-06-01',
    );
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.ajustes.length, 1);
      assert.equal(res.ajustes[0].totalCliente, 120);
      assert.equal(res.ajustes[0].totalRecalculado, 140);
      assert.equal(res.totalNomina, 120);
    }
  });

  it('tolera diferencias de redondeo de hasta $0.01', () => {
    const res = verificarTotalesCierre(
      [baseRow({ total: 140.01 })],
      [basePersonal()],
      '2026-06-01',
    );
    assert.equal(res.ok, true);
  });

  it('rechaza trabajadores que no existen en la base maestra', () => {
    const res = verificarTotalesCierre(
      [baseRow({ personalId: UUID_B })],
      [basePersonal()],
      '2026-06-01',
    );
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.message, /no existe/);
  });

  it('usa el salario de BD, no el del cliente (anti-manipulación de maestros)', () => {
    // El cliente "cree" que el salario es 9999, pero la BD dice 140.
    const res = verificarTotalesCierre(
      [baseRow({ total: 9999 })],
      [basePersonal({ salario_base: 140 })],
      '2026-06-01',
    );
    assert.equal(res.ok, false);
  });

  it('prorratea semanas parciales: 3 de 7 días con salario 140 = 60', () => {
    const res = verificarTotalesCierre(
      [baseRow({ diasTrabajados: 3, total: 60 })],
      [basePersonal()],
      '2026-06-01',
    );
    assert.equal(res.ok, true);
  });

  it('Mina 14x7: semana libre (posición 2) paga tarifa plana completa con días bloqueados', () => {
    // rotacion_inicio 2026-06-01 → la semana 2026-06-15 es posición 2 (libre)
    const personal = basePersonal({
      esquema_rotacion: 'MINA_2X1',
      rotacion_inicio_fecha: '2026-06-01',
      salario_base: 140,
      salario_libre: 100,
    });
    const res = verificarTotalesCierre(
      [baseRow({ estadoAsistencia: 'libre', diasTrabajados: 0, total: 100 })],
      [personal],
      '2026-06-15',
    );
    assert.equal(res.ok, true);
  });

  it('Molinos 14x14: primera libre física paga tarifa plana y segunda libre fuerza $0.00', () => {
    // rotacion_inicio 2026-06-01 → 2026-06-15 es libre pagada y 2026-06-22 es libre sin pago
    const personal = basePersonal({
      esquema_rotacion: 'MOLINO_14X14',
      rotacion_inicio_fecha: '2026-06-01',
      salario_base: 200,
      salario_libre: 150,
    });
    const ok = verificarTotalesCierre(
      [baseRow({ estadoAsistencia: 'libre', diasTrabajados: 0, total: 150 })],
      [personal],
      '2026-06-15',
    );
    assert.equal(ok.ok, true);

    const descanso = verificarTotalesCierre(
      [baseRow({ estadoAsistencia: 'no_laborado', diasTrabajados: 0, total: 0 })],
      [personal],
      '2026-06-22',
    );
    assert.equal(descanso.ok, true);

    // Intento de cobrar la libre sin pago → rechazo
    const fraude = verificarTotalesCierre(
      [baseRow({ estadoAsistencia: 'no_laborado', diasTrabajados: 0, total: 200 })],
      [personal],
      '2026-06-22',
    );
    assert.equal(fraude.ok, false);
  });

  it('Molinos 14x14: primera trabajada paga solo trabajo actual', () => {
    const personal = basePersonal({
      area: 'planta',
      area_detalle: 'Molinos- Grupo (mixto)',
      esquema_rotacion: 'MOLINO_14X14',
      rotacion_inicio_fecha: '2026-06-01',
      salario_base: 200,
      salario_libre: 150,
      bono_transporte: 50,
    });
    const res = verificarTotalesCierre(
      [baseRow({ estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, total: 200 })],
      [personal],
      '2026-06-01',
    );
    assert.equal(res.ok, true);
  });

  it('Molinos 14x14: segunda trabajada paga solo trabajo actual; transporte requiere motivo', () => {
    const personal = basePersonal({
      area: 'planta',
      area_detalle: 'Molinos- Grupo (mixto)',
      esquema_rotacion: 'MOLINO_14X14',
      rotacion_inicio_fecha: '2026-06-01',
      salario_base: 200,
      salario_libre: 150,
      bono_transporte: 50,
    });
    const res = verificarTotalesCierre(
      [baseRow({ estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, total: 200 })],
      [personal],
      '2026-06-08',
    );
    assert.equal(res.ok, true);

    const transporte = verificarTotalesCierre(
      [
        baseRow({
          estadoAsistencia: 'trabajada',
          diasTrabajados: 7,
          bonoTransporte: 50,
          total: 250,
          ajusteMotivo: 'Bono de transporte indicado en nomina origen',
        }),
      ],
      [personal],
      '2026-06-08',
    );
    assert.equal(transporte.ok, true);
    if (transporte.ok) assert.equal(transporte.ajustes.length, 1);
  });

  it('deduce vales y bonos en el recálculo (total = salario + bono + bonif − vales)', () => {
    const res = verificarTotalesCierre(
      [
        baseRow({
          bonoTransporte: 10,
          bonificaciones: 20,
          totalVales: 30,
          total: 140,
          ajusteMotivo: 'Bono transporte aprobado por gerencia',
        }),
      ],
      [basePersonal()],
      '2026-06-01',
    );
    // 140 + 10 + 20 − 30 = 140
    assert.equal(res.ok, true);
  });

  it('rechaza bono transporte manipulado aunque el total coincida', () => {
    const res = verificarTotalesCierre(
      [baseRow({ bonoTransporte: 10, bonificaciones: 0, totalVales: 10, total: 140 })],
      [basePersonal()],
      '2026-06-01',
    );
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.message, /bono transporte/);
  });

  it('acepta bono transporte manual solo con motivo auditable', () => {
    const res = verificarTotalesCierre(
      [
        baseRow({
          bonoTransporte: 10,
          bonificaciones: 0,
          totalVales: 10,
          total: 140,
          ajusteMotivo: 'Transporte manual aprobado por administración',
        }),
      ],
      [basePersonal()],
      '2026-06-01',
    );
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.ajustes.length, 1);
      assert.match(res.ajustes[0].campos?.join(' ') ?? '', /bono transporte/);
    }
  });
});
