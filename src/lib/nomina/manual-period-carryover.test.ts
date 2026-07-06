import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCarryoverDraftFromRows,
  buildRosterEntriesFromCarryoverRows,
  carryManualWeekToNext,
  carryoverRowsFromSemanaRegistros,
  mergeCarryoverDraft,
  mergeCarryoverRoster,
  preNominaRowToCarryoverDraft,
  resetNovedadDraftForRoster,
  type ManualWeekCarryoverRow,
} from '@/lib/nomina/manual-period-carryover';
import { readManualWeekRosterEntries } from '@/lib/nomina/manual-period-roster';
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

  it('mergeCarryoverRoster reproduce el caso de cierre de semana 1 -> semana 2', () => {
    // Caso típico: usuario cierra la semana 1 con 5 trabajadores de la plantilla.
    // La semana 2 está vacía. El carryover debe poblarla con los 5.
    const semana1Rows: ManualWeekCarryoverRow[] = [
      { personal: { id: 'a', area_detalle: 'Cuadrilla A' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, bonificaciones: 0 },
      { personal: { id: 'b', area_detalle: 'Cuadrilla A' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, bonificaciones: 0 },
      { personal: { id: 'c', area_detalle: 'Cuadrilla B' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'libre', diasTrabajados: 0, bonoTransporte: 0, bonificaciones: 0 },
    ];
    const week2Roster: { id: string; areaDetalle?: string }[] = [];
    const merged = mergeCarryoverRoster(week2Roster, semana1Rows);
    assert.equal(merged.length, 3);
    assert.deepEqual(
      merged.map((e) => e.id).sort(),
      ['a', 'b', 'c'],
    );
    assert.equal(merged.find((e) => e.id === 'a')?.areaDetalle, 'Cuadrilla A');
  });
});

describe('carryManualWeekToNext (con localStorage mockeado)', () => {
  let storage: Map<string, string>;
  let originalWindow: typeof globalThis.window;
  let originalLocalStorage: typeof globalThis.localStorage;

  beforeEach(() => {
    storage = new Map();
    originalWindow = globalThis.window;
    originalLocalStorage = globalThis.localStorage;
    (globalThis as { window?: unknown }).window = {};
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
      setItem: (k: string, v: string) => {
        storage.set(k, String(v));
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
      clear: () => {
        storage.clear();
      },
    };
  });

  function restore() {
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
  }

  it('cierre de semana 1 (con 3 trabajadores) escribe el roster de la semana 2', () => {
    // Cierra la semana 1 con 3 filas preNomina. Espera ver el roster en la
    // clave de la semana 2.
    const semana1Rows: ManualWeekCarryoverRow[] = [
      { personal: { id: 'a', area_detalle: 'Cuadrilla A' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, bonificaciones: 0 },
      { personal: { id: 'b', area_detalle: 'Cuadrilla A' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, bonificaciones: 0 },
      { personal: { id: 'c', area_detalle: 'Cuadrilla B' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'libre', diasTrabajados: 0, bonoTransporte: 0, bonificaciones: 0 },
    ];
    const result = carryManualWeekToNext(area, period, '2026-05-04', semana1Rows);
    restore();
    assert.equal(result, '2026-05-11');
    const week2Key = 'nomina-manual-week-roster-v2-mina-p-1-2026-05-11';
    const raw = storage.get(week2Key);
    assert.ok(raw, 'la clave de la semana 2 debe existir tras el carryover');
    const parsed = JSON.parse(raw!);
    assert.equal(parsed.length, 3);
    assert.deepEqual(
      parsed.map((e: { id: string }) => e.id).sort(),
      ['a', 'b', 'c'],
    );
  });

  it('cierre de la semana 1 con carryRows vacío NO elimina un roster existente de la semana 2', () => {
    // El usuario cerró la semana 1 sin filas (caso raro). El roster existente
    // de la semana 2 debe preservarse.
    const week2Key = 'nomina-manual-week-roster-v2-mina-p-1-2026-05-11';
    storage.set(
      week2Key,
      JSON.stringify([{ id: 'manual-1', areaDetalle: 'Manual A' }]),
    );
    const result = carryManualWeekToNext(area, period, '2026-05-04', []);
    restore();
    assert.equal(result, '2026-05-11');
    const raw = storage.get(week2Key);
    assert.ok(raw, 'el roster existente debe seguir ahí');
    const parsed = JSON.parse(raw!);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, 'manual-1');
  });

  it('cierre de la semana 1 deja el draft de la semana 2 con todos los IDs en ACTIVO', () => {
    // El borrador de novedades de la semana 2 debe tener una entrada por
    // cada ID arrastrado, todas en ACTIVO sin reposo.
    const semana1Rows: ManualWeekCarryoverRow[] = [
      { personal: { id: 'a', area_detalle: 'Cuadrilla A' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, bonificaciones: 0 },
      { personal: { id: 'b', area_detalle: 'Cuadrilla B' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 50, bonificaciones: 100 },
    ];
    carryManualWeekToNext(area, period, '2026-05-04', semana1Rows);
    const draftKey = 'mineos-nomina-novedad-turno-v2:mina:p-1:2026-05-11';
    const raw = storage.get(draftKey);
    restore();
    assert.ok(raw, 'el draft de la semana 2 debe existir');
    const parsed = JSON.parse(raw!);
    assert.equal(parsed.a?.novedadTurno, 'ACTIVO');
    assert.equal(parsed.b?.bonoTransporte, 50);
    assert.equal(parsed.b?.bonificaciones, 100);
  });

  it('readManualWeekRosterEntries tras carryover devuelve los IDs arrastrados', () => {
    // Simula el flujo: carryover de la semana 1, luego initRows de la semana 2.
    // El bug del usuario: la semana 2 queda vacía. Vamos a verificar que
    // el read tras el carryover devuelve lo esperado.
    const semana1Rows: ManualWeekCarryoverRow[] = [
      { personal: { id: 'a', area_detalle: 'Cuadrilla A' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, bonificaciones: 0 },
      { personal: { id: 'b', area_detalle: 'Cuadrilla B' }, novedadTurno: 'ACTIVO', novedadTurnoObs: '', estadoAsistencia: 'trabajada', diasTrabajados: 7, bonoTransporte: 0, bonificaciones: 0 },
    ];
    carryManualWeekToNext(area, period, '2026-05-04', semana1Rows);
    const entries = readManualWeekRosterEntries(area, '2026-05-11', 'p-1');
    restore();
    assert.equal(entries.length, 2);
    assert.deepEqual(
      entries.map((e) => e.id).sort(),
      ['a', 'b'],
    );
  });
});
