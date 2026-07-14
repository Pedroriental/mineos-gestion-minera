import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularBonoTransportePorPosicion,
  calcularSalarioPorPosicionCiclo,
  etiquetaEstadoRotacion,
  estadoObservadoOpcionesPorEsquema,
  fechaInicioRotacionDesdeEstadoObservado,
  fechaInicioCicloParaPosicion,
  planificarVinculoCiclo,
  posicionEnCicloDesdeSemana,
  posicionGrupoDesdeTrabajadores,
  rolSemanaPorPosicion,
  semanasTranscurridas,
  tarifaPlanaSemanaLibre,
  totalSemanasEsquema,
} from '@/lib/nomina/perfil-ciclo-reglas';

const PERSONAL = { salario_base: 140, salario_libre: 0 };
const PERSONAL_CON_TRANSPORTE = { salario_base: 140, salario_libre: 100, bono_transporte: 35 };

describe('coherencia etiqueta ↔ rol ↔ pago (single source of truth para UI)', () => {
  it('MOLINO_14X14: dos trabajadas, una libre pagada y una libre $0; transporte separado', () => {
    assert.equal(etiquetaEstadoRotacion('MOLINO_14X14', 0), 'Labor (1)');
    assert.equal(rolSemanaPorPosicion('MOLINO_14X14', 0), 'trabajada');
    assert.equal(
      calcularSalarioPorPosicionCiclo('MOLINO_14X14', PERSONAL_CON_TRANSPORTE, 0, 'trabajada', 7),
      140,
    );
    assert.equal(
      calcularBonoTransportePorPosicion('MOLINO_14X14', PERSONAL_CON_TRANSPORTE, 0, 'trabajada', 7),
      0,
    );

    assert.equal(etiquetaEstadoRotacion('MOLINO_14X14', 1), 'Labor (2)');
    assert.equal(rolSemanaPorPosicion('MOLINO_14X14', 1), 'trabajada');
    assert.equal(
      calcularSalarioPorPosicionCiclo('MOLINO_14X14', PERSONAL_CON_TRANSPORTE, 1, 'trabajada', 7),
      140,
    );
    assert.equal(
      calcularBonoTransportePorPosicion('MOLINO_14X14', PERSONAL_CON_TRANSPORTE, 1, 'trabajada', 7),
      0,
    );

    assert.equal(etiquetaEstadoRotacion('MOLINO_14X14', 2), 'Libre Pagada');
    assert.equal(rolSemanaPorPosicion('MOLINO_14X14', 2), 'libre');
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_14X14', PERSONAL_CON_TRANSPORTE, 2, 'libre', 0), 100);

    assert.equal(etiquetaEstadoRotacion('MOLINO_14X14', 3), 'Libre $0');
    assert.equal(rolSemanaPorPosicion('MOLINO_14X14', 3), 'no_laborada');
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_14X14', PERSONAL_CON_TRANSPORTE, 3, 'no_laborado', 0), 0);
  });

  it('MOLINO_15X15: etiquetas nuevas alineadas con rol y pago', () => {
    assert.equal(etiquetaEstadoRotacion('MOLINO_15X15', 0), 'Labor (1)');
    assert.equal(rolSemanaPorPosicion('MOLINO_15X15', 0), 'trabajada');

    assert.equal(etiquetaEstadoRotacion('MOLINO_15X15', 2), 'Libre Pagada');
    assert.equal(rolSemanaPorPosicion('MOLINO_15X15', 2), 'libre');
    assert.equal(
      calcularSalarioPorPosicionCiclo('MOLINO_15X15', PERSONAL, 2, 'libre', 0),
      140, // salario_libre=0 → cae a salario_base
    );

    assert.equal(etiquetaEstadoRotacion('MOLINO_15X15', 3), 'Libre $0');
    assert.equal(rolSemanaPorPosicion('MOLINO_15X15', 3), 'no_laborada');
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_15X15', PERSONAL, 3, 'no_laborado', 0), 0);
  });

  it('MINA_2X1 y MINA_ROTATIVA_3G: trabaja día, trabaja noche, libre pagada', () => {
    for (const esquema of ['MINA_2X1', 'MINA_ROTATIVA_3G'] as const) {
      assert.equal(etiquetaEstadoRotacion(esquema, 0), 'Labor Día');
      assert.equal(rolSemanaPorPosicion(esquema, 0), 'trabajada');
      assert.equal(calcularSalarioPorPosicionCiclo(esquema, PERSONAL, 0, 'trabajada', 7), 140);

      assert.equal(etiquetaEstadoRotacion(esquema, 1), 'Labor Noche');
      assert.equal(rolSemanaPorPosicion(esquema, 1), 'trabajada');

      assert.equal(etiquetaEstadoRotacion(esquema, 2), 'Libre Pagada');
      assert.equal(rolSemanaPorPosicion(esquema, 2), 'libre');
      assert.equal(calcularSalarioPorPosicionCiclo(esquema, PERSONAL, 2, 'libre', 0), 140);
    }
  });

  it('esquemas sin rotación no tienen etiqueta de ciclo', () => {
    assert.equal(etiquetaEstadoRotacion('FIJO_SEMANAL', 0), null);
    assert.equal(etiquetaEstadoRotacion('MOLINO_FIJO', 0), null);
  });

  it('posicionEnCicloDesdeSemana cubre los largos de ciclo de cada esquema', () => {
    // 3 semanas (21 días) para mina, 4 semanas (28 días) para molinos 14x14
    assert.equal(totalSemanasEsquema('MINA_2X1'), 3);
    assert.equal(totalSemanasEsquema('MOLINO_14X14'), 4);
    assert.equal(posicionEnCicloDesdeSemana('2026-06-01', '2026-06-01', 3), 0);
    assert.equal(posicionEnCicloDesdeSemana('2026-06-01', '2026-06-08', 3), 1);
    assert.equal(posicionEnCicloDesdeSemana('2026-06-01', '2026-06-22', 3), 0); // ciclo reinicia
    assert.equal(posicionEnCicloDesdeSemana('2026-06-01', '2026-05-25', 3), 2); // semanas previas
  });
});

describe('tarifaPlanaSemanaLibre (D2 — única fuente de verdad)', () => {
  it('sin tarifa libre propia, paga el salario base', () => {
    assert.equal(tarifaPlanaSemanaLibre({ salario_base: 140, salario_libre: 0 }), 140);
  });

  it('con tarifa libre propia, ésta tiene prioridad en TODOS los esquemas', () => {
    const personal = { salario_base: 140, salario_libre: 100 };
    assert.equal(tarifaPlanaSemanaLibre(personal), 100);
    // Misma regla en cada motor de posición (antes divergían: D2)
    assert.equal(calcularSalarioPorPosicionCiclo('MINA_2X1', personal, 2, 'libre', 0), 100);
    assert.equal(calcularSalarioPorPosicionCiclo('MINA_ROTATIVA_3G', personal, 2, 'libre', 0), 100);
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_14X14', personal, 2, 'libre', 0), 100);
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_15X15', personal, 2, 'libre', 0), 100);
  });

  it('solo la segunda libre de Molinos 14x14 paga $0 aunque exista salario_libre', () => {
    const personal = { salario_base: 140, salario_libre: 100 };
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_14X14', personal, 2, 'libre', 0), 100);
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_14X14', personal, 3, 'no_laborado', 0), 0);
  });
});

describe('helpers de calendario de ciclos (D1)', () => {
  it('semanasTranscurridas mide semanas calendario con signo', () => {
    assert.equal(semanasTranscurridas('2026-06-01', '2026-06-01'), 0);
    assert.equal(semanasTranscurridas('2026-06-01', '2026-06-15'), 2);
    assert.equal(semanasTranscurridas('2026-06-15', '2026-06-01'), -2);
  });

  it('fechaInicioCicloParaPosicion retrocede la ventana del ciclo', () => {
    assert.equal(fechaInicioCicloParaPosicion('2026-06-15', 0), '2026-06-15');
    assert.equal(fechaInicioCicloParaPosicion('2026-06-15', 2), '2026-06-01');
  });

  it('fechaInicioRotacionDesdeEstadoObservado deduce el ancla desde una semana conocida', () => {
    assert.equal(
      fechaInicioRotacionDesdeEstadoObservado('2026-05-18', 'MOLINO_14X14', 2),
      '2026-05-04',
    );
    assert.equal(
      fechaInicioRotacionDesdeEstadoObservado('2026-05-25', 'MOLINO_14X14', 0),
      '2026-05-25',
    );
    assert.equal(
      fechaInicioRotacionDesdeEstadoObservado('2026-05-25', 'MINA_2X1', 2),
      '2026-05-11',
    );
  });

  it('estadoObservadoOpcionesPorEsquema expone opciones humanas por esquema rotativo', () => {
    assert.deepEqual(
      estadoObservadoOpcionesPorEsquema('MOLINO_14X14').map((o) => o.label),
      ['Labor (1)', 'Labor (2)', 'Libre Pagada', 'Libre $0'],
    );
    assert.deepEqual(
      estadoObservadoOpcionesPorEsquema('MINA_2X1').map((o) => o.label),
      ['Labor Día', 'Labor Noche', 'Libre Pagada'],
    );
  });

  it('posicionGrupoDesdeTrabajadores usa la moda de las rotaciones', () => {
    // Dos trabajadores alineados al 2026-06-01 y uno desconfigurado
    const pos = posicionGrupoDesdeTrabajadores(
      ['2026-06-01', '2026-06-01', '2026-06-08'],
      '2026-06-08',
      3,
    );
    assert.equal(pos, 1);
    assert.equal(posicionGrupoDesdeTrabajadores([null, undefined], '2026-06-08', 3), null);
  });
});

describe('planificarVinculoCiclo (D1 — posición por calendario, no por orden de cierre)', () => {
  it('sin ciclo abierto: crea ventana alineada a la posición de calendario', () => {
    const plan = planificarVinculoCiclo({
      semanaInicio: '2026-06-08',
      totalSemanas: 3,
      posicionCalendario: 1,
      cicloAbierto: null,
    });
    assert.deepEqual(plan, { accion: 'crear', posicion: 1, fechaInicio: '2026-06-01' });
  });

  it('ciclo abierto alineado: vincula en la posición de calendario', () => {
    const plan = planificarVinculoCiclo({
      semanaInicio: '2026-06-08',
      totalSemanas: 3,
      posicionCalendario: 1,
      cicloAbierto: { fechaInicio: '2026-06-01', posicionesOcupadas: [0] },
    });
    assert.deepEqual(plan, { accion: 'usar_ciclo', posicion: 1 });
  });

  it('semana saltada: respeta el hueco (posición 2 con la 1 vacía)', () => {
    // Antes (por conteo) la semana saltada habría recibido posición 1 y
    // cobrado/etiquetado mal; con calendario conserva su posición real.
    const plan = planificarVinculoCiclo({
      semanaInicio: '2026-06-15',
      totalSemanas: 3,
      posicionCalendario: 2,
      cicloAbierto: { fechaInicio: '2026-06-01', posicionesOcupadas: [0] },
    });
    assert.deepEqual(plan, { accion: 'usar_ciclo', posicion: 2 });
  });

  it('ciclo completo: cierra y abre el siguiente alineado', () => {
    const plan = planificarVinculoCiclo({
      semanaInicio: '2026-06-22', // 3 semanas después → posición 0 del ciclo siguiente
      totalSemanas: 3,
      posicionCalendario: 0,
      cicloAbierto: { fechaInicio: '2026-06-01', posicionesOcupadas: [0, 1, 2] },
    });
    assert.deepEqual(plan, { accion: 'cerrar_y_crear', posicion: 0, fechaInicio: '2026-06-22' });
  });

  it('ciclo desalineado con el calendario: lo cierra y abre uno alineado', () => {
    // La ventana del ciclo dice offset 1, pero la rotación real dice 2
    const plan = planificarVinculoCiclo({
      semanaInicio: '2026-06-08',
      totalSemanas: 3,
      posicionCalendario: 2,
      cicloAbierto: { fechaInicio: '2026-06-01', posicionesOcupadas: [0] },
    });
    assert.deepEqual(plan, { accion: 'cerrar_y_crear', posicion: 2, fechaInicio: '2026-05-25' });
  });

  it('posición ya ocupada (re-proceso anómalo): abre ciclo nuevo en vez de duplicar', () => {
    const plan = planificarVinculoCiclo({
      semanaInicio: '2026-06-08',
      totalSemanas: 3,
      posicionCalendario: 1,
      cicloAbierto: { fechaInicio: '2026-06-01', posicionesOcupadas: [0, 1] },
    });
    assert.equal(plan.accion, 'cerrar_y_crear');
    assert.equal(plan.posicion, 1);
  });

  it('sin datos de rotación: usa la ventana del ciclo abierto como fallback', () => {
    const plan = planificarVinculoCiclo({
      semanaInicio: '2026-06-08',
      totalSemanas: 3,
      posicionCalendario: null,
      cicloAbierto: { fechaInicio: '2026-06-01', posicionesOcupadas: [0] },
    });
    assert.deepEqual(plan, { accion: 'usar_ciclo', posicion: 1 });
  });

  it('sin datos de rotación ni ciclo: arranca en posición 0', () => {
    const plan = planificarVinculoCiclo({
      semanaInicio: '2026-06-08',
      totalSemanas: 3,
      posicionCalendario: null,
      cicloAbierto: null,
    });
    assert.deepEqual(plan, { accion: 'crear', posicion: 0, fechaInicio: '2026-06-08' });
  });
});
