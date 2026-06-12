import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCarryoverDraftFromRows,
  buildRosterEntriesFromCarryoverRows,
  carryoverRowsFromSemanaRegistros,
  preNominaRowToCarryoverDraft,
} from '@/lib/nomina/manual-period-carryover';
import { nextWeekInManualPeriod } from '@/lib/nomina/manual-period';
import type { ManualNominaPeriod } from '@/lib/nomina/manual-period';

const area = 'mina';
const period: ManualNominaPeriod = {
  id: 'p-1',
  label: 'Mayo 2026',
  rangeStart: '2026-05-01',
  rangeEnd: '2026-05-31',
  plantillaId: 'pl-1',
  plantillaNombre: 'Vertical',
  weekColumnAssignment: [],
  weekColumnCuadrillas: [],
};

describe('manual-period-carryover', () => {
  it('preNominaRowToCarryoverDraft conserva pagos, reinicia novedades y no arrastra asistencia', () => {
    const draft = preNominaRowToCarryoverDraft({
      personal: { id: 'p1', area_detalle: 'Barrenador' },
      novedadTurno: 'REPOSO',
      novedadTurnoObs: 'Parcial 3',
      reposoCondicion: 'PARCIAL',
      reposoDiasPagados: 3,
      reposoCompensacionMonto: 0,
      estadoAsistencia: 'libre',
      diasTrabajados: 0,
      bonoTransporte: 50,
      bonificaciones: 120,
    });
    assert.equal(draft.novedadTurno, 'ACTIVO');
    assert.equal(draft.novedadTurnoObs, '');
    assert.equal(draft.bonoTransporte, 50);
    assert.equal(draft.bonificaciones, 120);
    assert.equal((draft as any).estadoAsistencia, undefined);
    assert.equal((draft as any).diasTrabajados, undefined);
  });

  it('preNominaRowToCarryoverDraft excluye pago único de bonificaciones arrastradas', () => {
    const draft = preNominaRowToCarryoverDraft({
      personal: { id: 'p1', area_detalle: '' },
      novedadTurno: 'REPOSO',
      novedadTurnoObs: 'Pago único 200',
      reposoCondicion: 'PAGO_UNICO',
      reposoDiasPagados: 0,
      reposoCompensacionMonto: 200,
      estadoAsistencia: 'trabajada',
      diasTrabajados: 0,
      bonoTransporte: 0,
      bonificaciones: 200,
    });
    assert.equal(draft.bonificaciones, 0);
    assert.equal(draft.novedadTurno, 'ACTIVO');
  });

  it('nextWeekInManualPeriod enlaza semanas del periodo para carryover', () => {
    assert.equal(nextWeekInManualPeriod(period, '2026-05-04'), '2026-05-11');
  });

  it('buildRosterEntriesFromCarryoverRows conserva areaDetalle', () => {
    const entries = buildRosterEntriesFromCarryoverRows([
      {
        personal: { id: 'p1', area_detalle: 'Barrenador' },
        novedadTurno: 'ACTIVO',
        novedadTurnoObs: '',
        estadoAsistencia: 'trabajada',
        diasTrabajados: 7,
        bonoTransporte: 0,
        bonificaciones: 0,
      },
    ]);
    assert.equal(entries[0].id, 'p1');
    assert.equal(entries[0].areaDetalle, 'Barrenador');
  });

  it('carryoverRowsFromSemanaRegistros mapea registros cerrados', () => {
    const rows = carryoverRowsFromSemanaRegistros(
      [
        {
          personal_id: 'p1',
          personal_snapshot: {
            nombre_completo: 'Juan',
            area_detalle: 'Barrenador',
            salario_base: 100,
          },
          estado_asistencia: 'trabajada',
          dias_trabajados: 6,
          bono_transporte_pagado: 25,
          bonificaciones: 15,
          novedad_turno: 'ACTIVO',
        },
      ],
      area,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].personal.id, 'p1');
    assert.equal(rows[0].personal.area_detalle, 'Barrenador');
    assert.equal(rows[0].diasTrabajados, 6);
    assert.equal(rows[0].bonoTransporte, 25);
  });

  it('buildCarryoverDraftFromRows indexa por personal id sin asistencia', () => {
    const draft = buildCarryoverDraftFromRows([
      {
        personal: { id: 'a', area_detalle: '' },
        novedadTurno: 'ACTIVO',
        novedadTurnoObs: '',
        estadoAsistencia: 'trabajada',
        diasTrabajados: 5,
        bonoTransporte: 10,
        bonificaciones: 0,
      },
    ]);
    assert.equal(draft.a?.bonoTransporte, 10);
    assert.equal(draft.a?.estadoAsistencia, undefined);
  });
});
