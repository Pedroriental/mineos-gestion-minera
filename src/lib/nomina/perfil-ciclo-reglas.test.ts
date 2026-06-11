import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularSalarioPorPosicionCiclo,
  etiquetaEstadoRotacion,
  posicionEnCicloDesdeSemana,
  rolSemanaPorPosicion,
  totalSemanasEsquema,
} from '@/lib/nomina/perfil-ciclo-reglas';

const PERSONAL = { salario_base: 140, salario_libre: 0 };

describe('coherencia etiqueta ↔ rol ↔ pago (single source of truth para UI)', () => {
  it('MOLINO_14X14: etiqueta y pago consistentes por posición', () => {
    assert.equal(etiquetaEstadoRotacion('MOLINO_14X14', 0), 'Libre Pagada');
    assert.equal(rolSemanaPorPosicion('MOLINO_14X14', 0), 'libre');
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_14X14', PERSONAL, 0, 'libre', 0), 140);

    assert.equal(etiquetaEstadoRotacion('MOLINO_14X14', 1), 'Libre No Pagada');
    assert.equal(rolSemanaPorPosicion('MOLINO_14X14', 1), 'no_laborada');
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_14X14', PERSONAL, 1, 'no_laborado', 0), 0);

    assert.equal(etiquetaEstadoRotacion('MOLINO_14X14', 2), 'Labor (1)');
    assert.equal(rolSemanaPorPosicion('MOLINO_14X14', 2), 'trabajada');
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_14X14', PERSONAL, 2, 'trabajada', 7), 140);
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

    assert.equal(etiquetaEstadoRotacion('MOLINO_15X15', 3), 'Libre No Pagada');
    assert.equal(rolSemanaPorPosicion('MOLINO_15X15', 3), 'no_laborada');
    assert.equal(calcularSalarioPorPosicionCiclo('MOLINO_15X15', PERSONAL, 3, 'no_laborado', 0), 0);
  });

  it('MINA_2X1 y MINA_ROTATIVA_3G: posición 0 es libre pagada (misma regla que el motor de pago)', () => {
    for (const esquema of ['MINA_2X1', 'MINA_ROTATIVA_3G'] as const) {
      assert.equal(etiquetaEstadoRotacion(esquema, 0), 'Libre (pred.)');
      assert.equal(rolSemanaPorPosicion(esquema, 0), 'libre');
      assert.equal(calcularSalarioPorPosicionCiclo(esquema, PERSONAL, 0, 'libre', 0), 140);

      assert.equal(etiquetaEstadoRotacion(esquema, 1), 'Labor (pred.)');
      assert.equal(rolSemanaPorPosicion(esquema, 1), 'trabajada');
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
