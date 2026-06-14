import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildNominaSemanaCsv } from '@/lib/nomina/nomina-semana-export';

describe('buildNominaSemanaCsv', () => {
  it('includes novedad turno and vertical columns', () => {
    const csv = buildNominaSemanaCsv(
      [
        {
          personal: {
            nombre_completo: 'Juan Pérez',
            cedula: '12345678',
            cargo: 'Palero',
            area_detalle: 'Vertical 1PD',
          },
          estadoAsistencia: 'trabajada',
          diasTrabajados: 6,
          novedadTurno: 'REPOSO',
          novedadTurnoObs: 'Médico',
          reposoCondicion: 'PAGO_UNICO',
          salarioBaseCalculado: 100,
          bonoTransporte: 20,
          bonificaciones: 0,
          deducciones: 0,
          totalVales: 10,
          total: 110,
        },
      ],
      {
        area: 'mina',
        areaLabel: 'Nómina Mina',
        weekStart: '2026-06-09',
        weekEnd: '2026-06-15',
        cerrada: false,
        workerCount: 1,
        totalSemana: 110,
      },
    );

    assert.match(csv, /Vertical\/Sector/);
    assert.match(csv, /Novedad turno/);
    assert.match(csv, /Juan Pérez/);
    assert.match(csv, /Vertical 1PD/);
    assert.match(csv, /110\.00/);
  });
});
