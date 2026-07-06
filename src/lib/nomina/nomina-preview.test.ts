import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNominaPreviewReport,
  isNominaPreviewEmpty,
  resolvePreviewSectionFromPersonal,
  type NominaRegistroCerrado,
} from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';

const trabajadorMock: Personal = {
  id: 'p-test-mock',
  nombre_completo: 'Trabajador Test Mock',
  cedula: '00000001',
  area: 'planta',
  cargo: 'Administrativo',
  salario_base: 125,
  fecha_ingreso: '2025-10-14',
  estatus: 'ACTIVO',
} as Personal;

describe('buildNominaPreviewReport', () => {
  const range = { rangeStart: '2026-05-25', rangeEnd: '2026-05-31' };

  it('does not project roster when allowProjection is false', () => {
    const report = buildNominaPreviewReport({
      personal: [trabajadorMock],
      registrosCerrados: [],
      allowProjection: false,
      ...range,
    });

    assert.equal(report.sections.length, 0);
    assert.equal(report.grandTotal, 0);
    assert.equal(report.stats.closedCells, 0);
    assert.equal(report.stats.calculatedCells, 0);
  });

  it('projects roster when allowProjection is true', () => {
    const report = buildNominaPreviewReport({
      personal: [trabajadorMock],
      registrosCerrados: [],
      allowProjection: true,
      ...range,
    });

    assert.ok(report.grandTotal > 0);
    assert.ok(report.stats.calculatedCells > 0);
  });

  it('shows closed registros without projection flag', () => {
    const registro: NominaRegistroCerrado = {
      personal_id: trabajadorMock.id,
      semana_inicio: '2026-05-25',
      area: 'planta',
      monto_pagado: 125,
      es_semana_libre: false,
    } as NominaRegistroCerrado;

    const report = buildNominaPreviewReport({
      personal: [trabajadorMock],
      registrosCerrados: [registro],
      allowProjection: false,
      ...range,
    });

    assert.equal(report.stats.closedCells, 1);
    assert.equal(report.grandTotal, 125);
    assert.equal(report.sections[0]?.rows[0]?.personal.id, trabajadorMock.id);
  });

  it('groups imported molinos admin by area_detalle, not mina vertical', () => {
    const adminMolinos: Personal = {
      ...trabajadorMock,
      id: 'p-admin-molinos',
      area: 'mina',
      cargo: 'Contadora',
      area_detalle: 'Nómina Administrativos Molinos',
    } as Personal;

    const registro: NominaRegistroCerrado = {
      personal_id: adminMolinos.id,
      semana_inicio: '2026-05-04',
      area: 'mina',
      monto_pagado: 200,
      es_semana_libre: false,
    };

    const report = buildNominaPreviewReport({
      personal: [adminMolinos],
      registrosCerrados: [registro],
      allowProjection: false,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-10',
      importSectionOrder: [{ id: 'planta_admin', title: 'Nómina Administrativos Molinos' }],
    });

    assert.equal(report.sections.length, 1);
    assert.equal(report.sections[0]?.id, 'planta_admin');
    assert.equal(report.sections[0]?.title, 'Nómina Administrativos Molinos');
  });

  it('resolvePreviewSectionFromPersonal uses area_detalle over area', () => {
    const meta = resolvePreviewSectionFromPersonal({
      id: 'x',
      area: 'mina',
      cargo: 'Operador',
      area_detalle: 'Nómina Administrativos Molinos',
    } as Personal);
    assert.equal(meta.id, 'planta_admin');
  });

  it('falls back to cargo when area_detalle is Generic', () => {
    const meta = resolvePreviewSectionFromPersonal({
      id: 'x',
      area: 'mina',
      cargo: 'Vertical 1PD',
      area_detalle: 'General',
    } as Personal);
    assert.equal(meta.id, 'mina__Vertical 1PD');
  });

  it('uses snapshot section_id when import order is available', () => {
    const worker: Personal = {
      ...trabajadorMock,
      id: 'p-snap',
      area: 'mina',
      cargo: 'Contadora',
      area_detalle: 'General',
    } as Personal;

    const report = buildNominaPreviewReport({
      personal: [worker],
      registrosCerrados: [
        {
          personal_id: worker.id,
          semana_inicio: '2026-05-04',
          area: 'mina',
          monto_pagado: 200,
          es_semana_libre: false,
        },
      ],
      allowProjection: false,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-10',
      importSectionOrder: [{ id: 'planta_admin', title: 'Nómina Administrativos Molinos' }],
      personalSnapshots: {
        [worker.id]: {
          cedula: worker.cedula,
          nombre_completo: worker.nombre_completo,
          cargo: worker.cargo,
          area: 'mina',
          area_detalle: 'General',
          section_id: 'planta_admin',
          salario_base: 200,
          salario_libre: 0,
          bono_transporte: 0,
          esquema_rotacion: 'FIJO_SEMANAL',
          rotacion_inicio_fecha: null,
        },
      },
    });

    assert.equal(report.sections[0]?.id, 'planta_admin');
    assert.equal(report.sections[0]?.title, 'Nómina Administrativos Molinos');
  });

  it('import archive mode lists only workers with registros in range', () => {
    const w1: Personal = { ...trabajadorMock, id: 'p1' } as Personal;
    const w2: Personal = { ...trabajadorMock, id: 'p2', nombre_completo: 'Otro' } as Personal;
    const registro: NominaRegistroCerrado = {
      personal_id: w1.id,
      semana_inicio: '2026-05-04',
      area: 'mina',
      monto_pagado: 100,
      es_semana_libre: false,
    };

    const report = buildNominaPreviewReport({
      personal: [w1, w2],
      registrosCerrados: [registro],
      allowProjection: false,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-10',
      importSectionOrder: [{ id: 'planta_admin', title: 'Nómina Administrativos Molinos' }],
      personalSnapshots: {
        [w1.id]: {
          cedula: w1.cedula,
          nombre_completo: w1.nombre_completo,
          cargo: w1.cargo,
          area: 'mina',
          area_detalle: 'Nómina Administrativos Molinos',
          section_id: 'planta_admin',
          section_title: 'Nómina Administrativos Molinos',
          salario_base: 100,
          salario_libre: 0,
          bono_transporte: 0,
          esquema_rotacion: 'FIJO_SEMANAL',
          rotacion_inicio_fecha: null,
        },
      },
    });

    const rowIds = report.sections.flatMap((s) => s.rows.map((r) => r.personal.id));
    assert.deepEqual(rowIds, [w1.id]);
    assert.equal(report.grandTotal, 100);
  });

  it('matches import section by section_title when section_id is missing', () => {
    const worker: Personal = {
      ...trabajadorMock,
      id: 'p-title',
      area: 'mina',
      area_detalle: 'General',
    } as Personal;

    const report = buildNominaPreviewReport({
      personal: [worker],
      registrosCerrados: [
        {
          personal_id: worker.id,
          semana_inicio: '2026-05-04',
          area: 'mina',
          monto_pagado: 50,
          es_semana_libre: false,
        },
      ],
      allowProjection: false,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-10',
      importSectionOrder: [{ id: 'admin_mina', title: 'Nómina Administrativos Mina' }],
      personalSnapshots: {
        [worker.id]: {
          cedula: worker.cedula,
          nombre_completo: worker.nombre_completo,
          cargo: worker.cargo,
          area: 'mina',
          area_detalle: 'General',
          section_title: 'Nómina Administrativos Mina',
          salario_base: 50,
          salario_libre: 0,
          bono_transporte: 0,
          esquema_rotacion: 'FIJO_SEMANAL',
          rotacion_inicio_fecha: null,
        },
      },
    });

    assert.equal(report.sections[0]?.id, 'admin_mina');
  });
});

describe('isNominaPreviewEmpty', () => {
  it('is empty when only projections exist and includeProjection is false', () => {
    const report = buildNominaPreviewReport({
      personal: [trabajadorMock],
      registrosCerrados: [],
      allowProjection: true,
      rangeStart: '2026-05-25',
      rangeEnd: '2026-05-31',
    });

    assert.equal(isNominaPreviewEmpty({ report, includeProjection: false }), true);
    assert.equal(isNominaPreviewEmpty({ report, includeProjection: true }), false);
  });
});

describe('anotaciones derivadas (salen libre / retirado)', () => {
  const range = { rangeStart: '2026-05-25', rangeEnd: '2026-05-31' };

  const minero: Personal = {
    id: 'p-minero-rotativo',
    nombre_completo: 'Minero Rotativo',
    cedula: '11111111',
    area: 'mina',
    cargo: 'Operador',
    salario_base: 100,
    fecha_ingreso: '2026-01-05',
    estatus: 'ACTIVO',
    esquema_rotacion: 'MINA_2X1',
  } as Personal;

  function registroCerrado(personalId: string, area: string): NominaRegistroCerrado {
    return {
      personal_id: personalId,
      semana_inicio: '2026-05-25',
      area,
      monto_pagado: 100,
      es_semana_libre: false,
      estado_asistencia: 'trabajada',
    } as NominaRegistroCerrado;
  }

  it('marca «Salen libre» cuando la semana siguiente es libre por rotación', () => {
    // inicio 18/05 → 25/05 = posición 1 (noche); 01/06 = posición 2 (libre)
    const p = { ...minero, rotacion_inicio_fecha: '2026-05-18' } as Personal;
    const report = buildNominaPreviewReport({
      personal: [p],
      registrosCerrados: [registroCerrado(p.id, 'mina')],
      allowProjection: false,
      ...range,
    });
    const row = report.sections[0]?.rows[0];
    assert.equal(row?.saleLibre, true);
    assert.match(row?.observaciones ?? '', /Salen libre/);
  });

  it('no marca «Salen libre» cuando la semana siguiente es trabajada', () => {
    // inicio 11/05 → 25/05 = posición 2 (libre); 01/06 = posición 0 (día)
    const p = { ...minero, rotacion_inicio_fecha: '2026-05-11' } as Personal;
    const report = buildNominaPreviewReport({
      personal: [p],
      registrosCerrados: [registroCerrado(p.id, 'mina')],
      allowProjection: false,
      ...range,
    });
    const row = report.sections[0]?.rows[0];
    assert.equal(row?.saleLibre, false);
    assert.doesNotMatch(row?.observaciones ?? '', /Salen libre/);
  });

  it('marca «Retirado» para personal con estado laboral DESPEDIDO', () => {
    const p = {
      ...minero,
      id: 'p-retirado',
      estado_laboral: 'DESPEDIDO',
      despido_fecha: '2026-05-28',
    } as Personal;
    const report = buildNominaPreviewReport({
      personal: [p],
      registrosCerrados: [registroCerrado(p.id, 'mina')],
      allowProjection: false,
      ...range,
    });
    const despedidosSection = report.sections.find((s) => s.id.includes('despedidos'));
    const row = despedidosSection?.rows[0];
    assert.match(row?.observaciones ?? '', /Retirado/);
  });
});

describe('plantilla cuadrillas en vista previa', () => {
  it('groups workers by plantilla cuadrilla when plantilla is provided', () => {
    const compresor = {
      id: 'cq-comp',
      nombre: 'MINA BELÉN - TÉCNICO OPERADOR DE COMPRESOR - TRAB.',
      asignacionKey: 'MINA BELÉN - TÉCNICO OPERADOR DE COMPRESOR - TRAB.',
      orden: 0,
      semanas: [{ id: 's1', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
      filas: [{ id: 'f1', personalId: 'p-yosel', orden: 0, celdas: {} }],
    };
    const plantilla = {
      id: 'pl-1',
      nombre: 'Vertical',
      descripcion: '',
      area: 'mina' as const,
      activo: true,
      created_at: '',
      updated_at: '',
      columnasVista: [],
      cuadrillas: [compresor],
    };
    const worker: Personal = {
      ...trabajadorMock,
      id: 'p-yosel',
      area: 'mina',
      area_detalle: 'Mina Belén - Técnico Ayudante Barrenador',
      cargo: 'Operador',
    } as Personal;

    const report = buildNominaPreviewReport({
      personal: [worker],
      registrosCerrados: [
        {
          personal_id: worker.id,
          semana_inicio: '2026-05-04',
          area: 'mina',
          monto_pagado: 100,
          es_semana_libre: false,
        },
      ],
      allowProjection: false,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-10',
      plantilla,
      manualPeriodPlantilla: {
        rangeStart: '2026-05-04',
        rangeEnd: '2026-05-24',
      },
    });

    assert.equal(report.sections[0]?.id, 'plantilla__cq-comp');
    assert.match(report.sections[0]?.title ?? '', /COMPRESOR/);
    assert.equal(report.sections[0]?.rows[0]?.total, 100);
  });

  it('attributes section totals per week when cuadrilla is active only in later weeks', () => {
    const admin = {
      id: 'cq-admin',
      nombre: 'Mina Belén - Administración Mina',
      asignacionKey: 'Administración Mina',
      orden: 0,
      semanas: [{ id: 's1', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
      filas: [{ id: 'f1', personalId: 'p-admin', orden: 0, celdas: {} }],
    };
    const barrenador = {
      id: 'cq-bar',
      nombre: 'Mina Bélen - Técnico Ayudante Barrenador',
      asignacionKey: 'Mina Belén - Técnico Ayudante Barrenador',
      orden: 1,
      semanas: [{ id: 's2', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
      filas: [{ id: 'f2', personalId: 'p-bar', orden: 0, celdas: {} }],
    };
    const plantilla = {
      id: 'pl-1',
      nombre: '14x7',
      descripcion: '',
      area: 'mina' as const,
      activo: true,
      created_at: '',
      updated_at: '',
      columnasVista: [],
      cuadrillas: [admin, barrenador],
    };
    const adminWorker: Personal = {
      ...trabajadorMock,
      id: 'p-admin',
      area: 'mina',
      area_detalle: 'Administración Mina',
      cargo: 'Admin',
    } as Personal;
    const barWorker: Personal = {
      ...trabajadorMock,
      id: 'p-bar',
      area: 'mina',
      area_detalle: 'Mina Belén - Técnico Ayudante Barrenador',
      cargo: 'Ayudante',
    } as Personal;

    const manualPeriodPlantilla = {
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-24',
      weekColumnAssignment: ['2026-05-04', '2026-05-11', '2026-05-18'],
      weekColumnCuadrillas: [[admin.id], [admin.id, barrenador.id], [admin.id, barrenador.id]],
    };

    const report = buildNominaPreviewReport({
      personal: [adminWorker, barWorker],
      registrosCerrados: [
        {
          personal_id: adminWorker.id,
          semana_inicio: '2026-05-04',
          area: 'mina',
          monto_pagado: 200,
          es_semana_libre: false,
        },
        {
          personal_id: barWorker.id,
          semana_inicio: '2026-05-11',
          area: 'mina',
          monto_pagado: 150,
          es_semana_libre: false,
        },
      ],
      allowProjection: false,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-24',
      plantilla,
      manualPeriodPlantilla,
    });

    const adminSection = report.sections.find((s) => s.id === 'plantilla__cq-admin');
    const barSection = report.sections.find((s) => s.id === 'plantilla__cq-bar');
    assert.equal(adminSection?.sectionTotal, 200);
    assert.equal(barSection?.sectionTotal, 150);
    assert.equal(report.grandTotal, 350);
  });

  it('prioriza cuadrilla persistida en snapshot sobre inferencia por plantilla', () => {
    const compresor = {
      id: 'cq-comp',
      nombre: 'MINA BELÉN - TÉCNICO OPERADOR DE COMPRESOR - TRAB.',
      asignacionKey: 'MINA BELÉN - TÉCNICO OPERADOR DE COMPRESOR - TRAB.',
      orden: 0,
      semanas: [{ id: 's1', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
      filas: [{ id: 'f1', personalId: 'p-yosel', orden: 0, celdas: {} }],
    };
    const barrenador = {
      id: 'cq-bar',
      nombre: 'Mina Bélen - Técnico Ayudante Barrenador',
      asignacionKey: 'Mina Belén - Técnico Ayudante Barrenador',
      orden: 1,
      semanas: [{ id: 's2', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
      filas: [],
    };
    const plantilla = {
      id: 'pl-1',
      nombre: 'Vertical',
      descripcion: '',
      area: 'mina' as const,
      activo: true,
      created_at: '',
      updated_at: '',
      columnasVista: [],
      cuadrillas: [compresor, barrenador],
    };
    const worker: Personal = {
      ...trabajadorMock,
      id: 'p-yosel',
      area: 'mina',
      area_detalle: 'Mina Belén - Técnico Ayudante Barrenador',
      cargo: 'Operador',
    } as Personal;

    const report = buildNominaPreviewReport({
      personal: [worker],
      registrosCerrados: [
        {
          personal_id: worker.id,
          semana_inicio: '2026-05-04',
          area: 'mina',
          monto_pagado: 100,
          es_semana_libre: false,
          personal_snapshot: {
            cedula: worker.cedula,
            nombre_completo: worker.nombre_completo,
            cargo: worker.cargo,
            area: worker.area,
            area_detalle: worker.area_detalle,
            cuadrilla_id: compresor.id,
            cuadrilla_nombre: compresor.nombre,
            section_id: `plantilla__${compresor.id}`,
            section_title: `Semanas Mina Belén — ${compresor.nombre}`,
            salario_base: 0,
            salario_libre: 0,
            bono_transporte: 0,
            esquema_rotacion: 'FIJO_SEMANAL',
            rotacion_inicio_fecha: null,
          },
        },
      ],
      allowProjection: false,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-10',
      plantilla,
      manualPeriodPlantilla: {
        rangeStart: '2026-05-04',
        rangeEnd: '2026-05-24',
      },
    });

    assert.equal(report.sections[0]?.id, 'plantilla__cq-comp');
    assert.match(report.sections[0]?.title ?? '', /COMPRESOR/);
  });

  it('incluye cuadrilla solo marcada en semana temprana aunque esté desmarcada en la última', () => {
    const admin = {
      id: 'cq-admin',
      nombre: 'Mina Belén - Administración Mina',
      asignacionKey: 'Administración Mina',
      orden: 0,
      semanas: [{ id: 's1', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
      filas: [{ id: 'f1', personalId: 'p-admin', orden: 0, celdas: {} }],
    };
    const barrenador = {
      id: 'cq-bar',
      nombre: 'Mina Bélen - Técnico Ayudante Barrenador',
      asignacionKey: 'Mina Belén - Técnico Ayudante Barrenador',
      orden: 1,
      semanas: [{ id: 's2', nombre: 'Semana 1', orden: 0, estatusDefault: 'trabajada_paga' as const }],
      filas: [{ id: 'f2', personalId: 'p-bar', orden: 0, celdas: {} }],
    };
    const plantilla = {
      id: 'pl-1',
      nombre: '14x7',
      descripcion: '',
      area: 'mina' as const,
      activo: true,
      created_at: '',
      updated_at: '',
      columnasVista: [],
      cuadrillas: [admin, barrenador],
    };
    const adminWorker: Personal = {
      ...trabajadorMock,
      id: 'p-admin',
      area: 'mina',
      area_detalle: 'Administración Mina',
      cargo: 'Admin',
    } as Personal;

    const manualPeriodPlantilla = {
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-24',
      weekColumnAssignment: ['2026-05-04', '2026-05-11', '2026-05-18'],
      // Barrenador solo semana 1; semanas 2-3 solo admin (como si se desmarcara al final).
      weekColumnCuadrillas: [[admin.id, barrenador.id], [admin.id], [admin.id]],
    };

    const report = buildNominaPreviewReport({
      personal: [adminWorker],
      registrosCerrados: [
        {
          personal_id: adminWorker.id,
          semana_inicio: '2026-05-04',
          area: 'mina',
          monto_pagado: 200,
          es_semana_libre: false,
        },
      ],
      allowProjection: false,
      rangeStart: '2026-05-04',
      rangeEnd: '2026-05-24',
      plantilla,
      manualPeriodPlantilla,
    });

    const barSection = report.sections.find((s) => s.id === 'plantilla__cq-bar');
    assert.ok(barSection, 'debe listar la cuadrilla barrenador aunque no esté en la última semana');
    assert.equal(barSection?.sectionTotal, 0);
    assert.equal(barSection?.rows.length, 0);
  });
});
