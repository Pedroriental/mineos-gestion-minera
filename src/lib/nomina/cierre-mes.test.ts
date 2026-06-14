import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  rangoDesdeCiclos,
  sugerirEtiquetaMes,
  totalUsdDesdeCiclos,
} from '@/lib/nomina/cierre-mes';

describe('cierre-mes', () => {
  it('calcula rango y total desde ciclos libres', () => {
    const ciclos = [
      { rangeStart: '2026-04-06', rangeEnd: '2026-04-12', totalUsd: 230, label: 'Bono' },
      { rangeStart: '2026-04-27', rangeEnd: '2026-05-10', totalUsd: 1710, label: '2da mayo' },
    ];
    assert.deepEqual(rangoDesdeCiclos(ciclos), {
      rangeStart: '2026-04-06',
      rangeEnd: '2026-05-10',
    });
    assert.equal(totalUsdDesdeCiclos(ciclos), 1940);
    assert.match(sugerirEtiquetaMes(ciclos), /Abril 2026/);
  });
});
