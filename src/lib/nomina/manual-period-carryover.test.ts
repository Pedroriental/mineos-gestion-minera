import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCarryoverDraftFromRows,
  buildRosterEntriesFromCarryoverRows,
  carryoverRowsFromSemanaRegistros,
  mergeCarryoverDraft,
  mergeCarryoverRoster,
  preNominaRowToCarryoverDraft,
  resetNovedadDraftForRoster,
  type ManualWeekCarryoverRow,
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

  it('mergeCarryoverRoster conserva entradas manuales y añade arrastradas', () => {
    const existing = [
      { id: 'manual-1', areaDetalle: 'Manual' },
      { id: 'ambos', areaDetalle: 'Manual' },
    ];
    const carryRows: ManualWeekCarryoverRow[] = [
      {
        personal: { id: 'ambos', area_detalle: 'Carry' },
        novedadTurno: 'ACTIVO',
        novedadTurnoObs: '',
        estadoAsistencia: 'trabajada',
        diasTrabajados: 7,
        bonoTransporte: 0,
        bonificaciones: 0,
      },
      {
        personal: { id: 'nuevo', area_detalle: 'Carry' },
        novedadTurno: 'ACTIVO',
        novedadTurnoObs: '',
        estadoAsistencia: 'trabajada',
        diasTrabajados: 7,
        bonoTransporte: 0,
        bonificaciones: 0,
      },
    ];
    const merged = mergeCarryoverRoster(existing, carryRows);
    const ids = merged.map((e) => e.id).sort();
    assert.deepEqual(ids, ['ambos', 'manual-1', 'nuevo']);
    const ambos = merged.find((e) => e.id === 'ambos');
    assert.equal(ambos?.areaDetalle, 'Carry', 'entrada compartida usa el carryover');
  });

  it('mergeCarryoverRoster con existing vacío añade todos los arrastrados', () => {
    const carryRows: ManualWeekCarryoverRow[] = [
      {
        personal: { id: 'a', area_detalle: 'X' },
        novedadTurno: 'ACTIVO',
        novedadTurnoObs: '',
        estadoAsistencia: 'trabajada',
        diasTrabajados: 7,
        bonoTransporte: 0,
        bonificaciones: 0,
      },
    ];
    const merged = mergeCarryoverRoster([], carryRows);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, 'a');
  });

  it('mergeCarryoverRoster con carryRows vacío preserva existing tal cual', () => {
    const existing = [{ id: 'manual-1', areaDetalle: 'Manual' }];
    const merged = mergeCarryoverRoster(existing, []);
    assert.deepEqual(merged, existing);
  });

  it('mergeCarryoverDraft conserva draft manual del destino y rellena pagos arrastrados', () => {
    const existing = {
      'manual-1': {
        novedadTurno: 'REPOSO' as const,
        novedadTurnoObs: 'Editado por usuario',
        reposoCondicion: 'PARCIAL' as const,
        reposoDiasPagados: 2,
        reposoCompensacionMonto: 0,
        bonoTransporte: 0,
        bonificaciones: 0,
      },
    };
    const carryRows: ManualWeekCarryoverRow[] = [
      {
        personal: { id: 'manual-1', area_detalle: '' },
        novedadTurno: 'ACTIVO',
        novedadTurnoObs: '',
        estadoAsistencia: 'trabajada',
        diasTrabajados: 7,
        bonoTransporte: 50,
        bonificaciones: 120,
      },
      {
        personal: { id: 'nuevo', area_detalle: '' },
        novedadTurno: 'ACTIVO',
        novedadTurnoObs: '',
        estadoAsistencia: 'trabajada',
        diasTrabajados: 7,
        bonoTransporte: 30,
        bonificaciones: 0,
      },
    ];
    const merged = mergeCarryoverDraft(existing, carryRows);
    assert.equal(merged['manual-1']?.novedadTurno, 'REPOSO', 'preserva novedad manual');
    assert.equal(merged['manual-1']?.novedadTurnoObs, 'Editado por usuario');
    assert.equal(merged['manual-1']?.reposoDiasPagados, 2);
    assert.equal(merged['manual-1']?.bonoTransporte, 50, 'sí actualiza pagos');
    assert.equal(merged['manual-1']?.bonificaciones, 120);
    assert.equal(merged['nuevo']?.bonoTransporte, 30);
  });

  it('mergeCarryoverDraft con carryRows vacío devuelve existing sin cambios', () => {
    const existing = {
      a: {
        novedadTurno: 'ACTIVO' as const,
        novedadTurnoObs: '',
        reposoCondicion: null,
        reposoDiasPagados: 0,
        reposoCompensacionMonto: 0,
        bonoTransporte: 10,
        bonificaciones: 0,
      },
    };
    const merged = mergeCarryoverDraft(existing, []);
    assert.deepEqual(merged, existing);
  });

  it('resetNovedadDraftForRoster crea entradas ACTIVO sin reposo ni bonos', () => {
    const draft = resetNovedadDraftForRoster(['a', 'b']);
    assert.equal(draft.a?.novedadTurno, 'ACTIVO');
    assert.equal(draft.a?.novedadTurnoObs, '');
    assert.equal(draft.a?.reposoCondicion, null);
    assert.equal(draft.a?.reposoDiasPagados, 0);
    assert.equal(draft.a?.reposoCompensacionMonto, 0);
    assert.equal(draft.a?.bonoTransporte, 0);
    assert.equal(draft.a?.bonificaciones, 0);
    assert.equal(draft.b?.novedadTurno, 'ACTIVO');
  });

  it('resetNovedadDraftForRoster con roster vacío devuelve objeto vacío', () => {
    const draft = resetNovedadDraftForRoster([]);
    assert.deepEqual(draft, {});
  });

  it('resetNovedadDraftForRoster no muta la entrada por defecto entre llamadas', () => {
    const draft1 = resetNovedadDraftForRoster(['x']);
    const draft2 = resetNovedadDraftForRoster(['y']);
    // Cada llamada crea objetos independientes para evitar referencias compartidas
    assert.notEqual(draft1.x, draft2.y);
  });
});
