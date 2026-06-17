import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateReportPayload } from '@/lib/reports/report-builder-validation';

describe('report-builder-validation', () => {
  it('requiere al menos un módulo', () => {
    const result = validateReportPayload({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      modules: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.messages.join(' '), /módulo/i);
  });

  it('rechaza fechas invertidas', () => {
    const result = validateReportPayload({
      dateFrom: '2026-06-01',
      dateTo: '2026-05-01',
      modules: ['produccion'],
    });
    assert.equal(result.ok, false);
  });

  it('rechaza balance y reconciliación juntos', () => {
    const result = validateReportPayload({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      modules: ['balance', 'reconciliacion'],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.messages.join(' '), /Balance y Reconciliación/i);
  });

  it('acepta payload operativo válido', () => {
    const result = validateReportPayload({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      modules: ['produccion', 'extraccion'],
    });
    assert.equal(result.ok, true);
  });
});
