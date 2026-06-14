import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  puedeAvanzarASiguienteSemana,
  validarCierreSemanal,
  buildBalanceExport,
  plantillaPermiteAjusteAsistencia,
  resolveDiasInputBloqueadoPlantilla,
  coerceEstatusPlantillaParaEsquema,
  esquemaEsFijoSemanal,
  calculatePayForPlantillaNominaRow,
} from '@/lib/rotacion-plantillas/semana-cierre';

describe('fijo semanal vs columnas libres de plantilla', () => {
  it('detecta esquemas fijos', () => {
    assert.equal(esquemaEsFijoSemanal('FIJO_SEMANAL'), true);
    assert.equal(esquemaEsFijoSemanal('MOLINO_FIJO'), true);
    assert.equal(esquemaEsFijoSemanal('MINA_2X1'), false);
    assert.equal(esquemaEsFijoSemanal('MOLINO_14X14'), false);
  });

  it('fijo semanal nunca hereda libre del default de columna', () => {
    assert.equal(coerceEstatusPlantillaParaEsquema('libre_paga', 'FIJO_SEMANAL', false), 'trabajada_paga');
    assert.equal(coerceEstatusPlantillaParaEsquema('libre_sin_pago', 'MOLINO_FIJO', false), 'trabajada_paga');
  });

  it('respeta overrides explícitos de celda y esquemas rotativos', () => {
    // Override manual (vacaciones, libre puntual) sí aplica al fijo
    assert.equal(coerceEstatusPlantillaParaEsquema('libre_paga', 'FIJO_SEMANAL', true), 'libre_paga');
    // Los rotativos siguen la columna
    assert.equal(coerceEstatusPlantillaParaEsquema('libre_paga', 'MINA_2X1', false), 'libre_paga');
    // Estados deliberados no se tocan (reposo, vacaciones, no laborada)
    assert.equal(coerceEstatusPlantillaParaEsquema('no_laborada', 'FIJO_SEMANAL', false), 'no_laborada');
    assert.equal(coerceEstatusPlantillaParaEsquema('vacaciones', 'FIJO_SEMANAL', false), 'vacaciones');
  });
});

describe('plantilla asistencia ajustable', () => {
  it('nunca bloquea botones de asistencia', () => {
    assert.equal(plantillaPermiteAjusteAsistencia('libre_paga'), true);
    assert.equal(plantillaPermiteAjusteAsistencia('trabajada_paga'), true);
  });

  it('días editables solo con asistencia trabajada', () => {
    assert.equal(resolveDiasInputBloqueadoPlantilla('libre_paga', 'libre'), true);
    assert.equal(resolveDiasInputBloqueadoPlantilla('libre_paga', 'no_laborado'), true);
    assert.equal(resolveDiasInputBloqueadoPlantilla('libre_paga', 'trabajada'), false);
    assert.equal(resolveDiasInputBloqueadoPlantilla('trabajada_paga', 'trabajada'), false);
    assert.equal(resolveDiasInputBloqueadoPlantilla('trabajada_paga', 'no_laborado'), true);
  });

  it('libre_paga respeta turno explícito (Molinos/Mina manual)', () => {
    const molino = {
      salario_base: 140,
      salario_libre: 100,
      bono_transporte: 30,
      area: 'planta' as const,
      area_detalle: 'Molinos- Grupo (mixto)',
    };

    const defaultLibre = calculatePayForPlantillaNominaRow({
      estatus: 'libre_paga',
      personal: molino,
      estadoAsistencia: 'libre',
      diasTrabajados: 0,
    });
    assert.equal(defaultLibre.estadoAsistencia, 'libre');
    assert.equal(defaultLibre.salarioBaseCalculado, 100);

    const overrideTurno = calculatePayForPlantillaNominaRow({
      estatus: 'libre_paga',
      personal: molino,
      estadoAsistencia: 'trabajada',
      diasTrabajados: 7,
    });
    assert.equal(overrideTurno.estadoAsistencia, 'trabajada');
    assert.equal(overrideTurno.salarioBaseCalculado, 140);
    assert.equal(overrideTurno.esSemanaLibre, false);
  });
});

describe('rotacion plantillas — cierre semanal', () => {
  it('bloquea semana 2 si semana 1 no está auditada', () => {
    const semanas = [
      { orden: 0, estado: 'ABIERTA' as const },
      { orden: 1, estado: 'ABIERTA' as const },
    ];
    const r = puedeAvanzarASiguienteSemana(semanas, 1);
    assert.equal(r.ok, false);
  });

  it('permite semana 2 tras cierre auditado de semana 1', () => {
    const semanas = [
      { orden: 0, estado: 'CERRADA_AUDITADA' as const },
      { orden: 1, estado: 'ABIERTA' as const },
    ];
    const r = puedeAvanzarASiguienteSemana(semanas, 1);
    assert.equal(r.ok, true);
  });

  it('validarCierreSemanal exige fin de rango', () => {
    const r = validarCierreSemanal(
      {
        orden: 0,
        estado: 'ABIERTA',
        semanaInicio: '2026-06-01',
        semanaFin: '2026-06-07',
      },
      [],
      '2026-06-05',
    );
    assert.equal(r.ok, false);
  });

  it('buildBalanceExport suma subtotales cerrados', () => {
    const exp = buildBalanceExport({
      plantillaId: 'p1',
      plantillaNombre: 'Test',
      area: 'mina',
      semanasCerradas: [
        {
          orden: 0,
          semanaInicio: '2026-06-01',
          semanaFin: '2026-06-07',
          estado: 'CERRADA_AUDITADA',
          subtotalUsd: 1000,
          subtotalDias: 35,
          subtotalBonos: 200,
          trabajadoresCount: 5,
        },
        {
          orden: 1,
          semanaInicio: '2026-06-08',
          semanaFin: '2026-06-14',
          estado: 'ABIERTA',
          subtotalUsd: 500,
          subtotalDias: 0,
          subtotalBonos: 0,
          trabajadoresCount: 5,
        },
      ],
    });
    assert.equal(exp.totalUsd, 1000);
    assert.equal(exp.semanasCerradas.length, 1);
  });
});
