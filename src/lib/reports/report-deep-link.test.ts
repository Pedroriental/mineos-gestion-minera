import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConstructorUrl,
  decodeReportPayloadFromSearchParams,
  encodeReportPayloadToSearchParams,
} from '@/lib/reports/report-deep-link';

describe('report-deep-link', () => {
  it('codifica y decodifica payload basico', () => {
    const payload = {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      modules: ['balance', 'produccion'] as const,
      groupBy: 'mes',
    };
    const params = encodeReportPayloadToSearchParams(payload);
    const decoded = decodeReportPayloadFromSearchParams(params);

    assert.equal(decoded.dateFrom, '2026-05-01');
    assert.equal(decoded.dateTo, '2026-05-31');
    assert.deepEqual(decoded.modules, ['balance', 'produccion']);
    assert.equal(decoded.groupBy, 'mes');
  });

  it('codifica filtros operativos molino/mina', () => {
    const params = encodeReportPayloadToSearchParams({
      filters: {
        reconciliacion: {
          molinos: { in: ['M1', 'M2'] },
          minas: { in: ['Norte'] },
        },
      },
    });
    const decoded = decodeReportPayloadFromSearchParams(params);
    assert.deepEqual(decoded.filters?.reconciliacion?.molinos, { in: ['M1', 'M2'] });
    assert.deepEqual(decoded.filters?.reconciliacion?.minas, { in: ['Norte'] });
  });

  it('buildConstructorUrl genera ruta con query', () => {
    const url = buildConstructorUrl({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-07',
      modules: ['reconciliacion'],
    });
    assert.match(url, /^\/reportes\/constructor\?/);
    assert.match(url, /from=2026-05-01/);
    assert.match(url, /modules=reconciliacion/);
  });

  it('ignora modulos invalidos al decodificar', () => {
    const params = new URLSearchParams('modules=balance,invalid,produccion');
    const decoded = decodeReportPayloadFromSearchParams(params);
    assert.deepEqual(decoded.modules, ['balance', 'produccion']);
  });
});
