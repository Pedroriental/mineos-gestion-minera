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

  it('autoRun agrega run=1 y decodifica autoRun', () => {
    const url = buildConstructorUrl(
      { dateFrom: '2026-05-01', dateTo: '2026-05-07', modules: ['produccion'] },
      { autoRun: true },
    );
    assert.match(url, /run=1/);
    const decoded = decodeReportPayloadFromSearchParams(new URLSearchParams(url.split('?')[1]!));
    assert.equal(decoded.autoRun, true);
  });

  it('codifica filtros en base64 filters param', () => {
    const params = encodeReportPayloadToSearchParams({
      filters: {
        produccion: { molino: { in: ['M1'] } },
      },
    });
    assert.ok(params.get('filters'));
    const decoded = decodeReportPayloadFromSearchParams(params);
    assert.deepEqual(decoded.filters?.produccion?.molino, { in: ['M1'] });
  });

  it('ignora modulos invalidos al decodificar', () => {
    const params = new URLSearchParams('modules=balance,invalid,produccion');
    const decoded = decodeReportPayloadFromSearchParams(params);
    assert.deepEqual(decoded.modules, ['balance', 'produccion']);
  });
});
