import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  weekDraftToRowOverrides,
  preNominaRowToWeekDraft,
  parseEstadoAsistenciaDraft,
  patchAlMarcarNovedadTurno,
  patchAlCambiarAsistencia,
  formatNovedadTurnoObsForSave,
  parseReposoCondicionFromObs,
  reposoPagoUnicoMontoFromRow,
  describeNovedadTurnoSemana,
} from '@/lib/nomina-novedad-turno';
import { aplicarPoliticaReposoSemanal } from '@/lib/nomina-calculo';

describe('nomina week draft', () => {
  it('restaura asistencia y días desde borrador semanal', () => {
    const overrides = weekDraftToRowOverrides({
      novedadTurno: 'ACTIVO',
      novedadTurnoObs: '',
      estadoAsistencia: 'no_laborado',
      diasTrabajados: 0,
    });
    assert.equal(overrides.estadoAsistencia, 'no_laborado');
    assert.equal(overrides.diasTrabajados, 0);
  });

  it('serializa fila completa para persistencia', () => {
    const draft = preNominaRowToWeekDraft({
      novedadTurno: 'REPOSO',
      novedadTurnoObs: 'Médico',
      reposoCondicion: 'PARCIAL',
      estadoAsistencia: 'no_laborado',
      diasTrabajados: 0,
      bonificaciones: 0,
      bonoTransporte: 15,
    });
    assert.equal(draft.novedadTurno, 'REPOSO');
    assert.equal(draft.reposoCondicion, 'PARCIAL');
    assert.equal(draft.estadoAsistencia, 'no_laborado');
    assert.equal(parseEstadoAsistenciaDraft('libre'), 'libre');
  });

  it('al marcar reposo aplica falta y condición de sueldo por defecto', () => {
    const patch = patchAlMarcarNovedadTurno(
      { novedadTurnoObs: '', reposoCondicion: null },
      'REPOSO',
    );
    assert.equal(patch.estadoAsistencia, 'no_laborado');
    assert.equal(patch.diasTrabajados, 0);
    assert.equal(patch.reposoCondicion, 'SIN_PAGO');
  });

  it('al cambiar asistencia limpia reposo y aplica turno/libre/falta', () => {
    const turno = patchAlCambiarAsistencia('trabajada');
    assert.equal(turno.novedadTurno, 'ACTIVO');
    assert.equal(turno.estadoAsistencia, 'trabajada');
    assert.equal(turno.diasTrabajados, 7);

    const libre = patchAlCambiarAsistencia('libre');
    assert.equal(libre.estadoAsistencia, 'libre');
    assert.equal(libre.diasTrabajados, 0);

    const falta = patchAlCambiarAsistencia('no_laborado');
    assert.equal(falta.estadoAsistencia, 'no_laborado');
    assert.equal(falta.diasTrabajados, 0);
  });

  it('guarda y recupera condición de reposo en observación de cierre', () => {
    const saved = formatNovedadTurnoObsForSave('REPOSO', 'Accidente menor', 'PAGO_COMPLETO');
    const parsed = parseReposoCondicionFromObs(saved);
    assert.equal(parsed.reposoCondicion, 'PAGO_COMPLETO');
    assert.equal(parsed.novedadTurnoObs, 'Accidente menor');
  });

  it('guarda pago único con monto y descripción en observación de cierre', () => {
    const saved = formatNovedadTurnoObsForSave('REPOSO', 'Compensación accidente', 'PAGO_UNICO', {
      reposoCompensacionMonto: 50,
    });
    const parsed = parseReposoCondicionFromObs(saved);
    assert.equal(parsed.reposoCondicion, 'PAGO_UNICO');
    assert.equal(parsed.reposoCompensacionMonto, 50);
    assert.equal(parsed.novedadTurnoObs, 'Compensación accidente');
  });

  it('restaura pago único desde borrador semanal', () => {
    const overrides = weekDraftToRowOverrides({
      novedadTurno: 'REPOSO',
      novedadTurnoObs: 'Extra',
      reposoCondicion: 'PAGO_UNICO',
      reposoCompensacionMonto: 75,
    });
    assert.equal(overrides.reposoCondicion, 'PAGO_UNICO');
    assert.equal(overrides.reposoCompensacionMonto, 75);
  });

  it('describe novedad con pago único y nota', () => {
    const line = describeNovedadTurnoSemana({
      novedadTurno: 'REPOSO',
      reposoCondicion: 'PAGO_UNICO',
      novedadTurnoObs: 'Indemnización',
    });
    assert.match(line, /Pago único/);
    assert.match(line, /Indemnización/);
    assert.equal(
      reposoPagoUnicoMontoFromRow({
        novedadTurno: 'REPOSO',
        reposoCondicion: 'PAGO_UNICO',
        reposoCompensacionMonto: 40,
      }),
      40,
    );
  });
});

describe('aplicarPoliticaReposoSemanal', () => {
  const personal = { salario_base: 125 };

  it('sin pago deja sueldo en 0 (distinto a falta por camino de novedad)', () => {
    assert.equal(aplicarPoliticaReposoSemanal('SIN_PAGO', personal, 7), 0);
  });

  it('pago completo respeta salario base', () => {
    assert.equal(aplicarPoliticaReposoSemanal('PAGO_COMPLETO', personal, 7), 125);
  });
});
