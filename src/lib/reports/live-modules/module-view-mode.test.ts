import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreviewMode, isLiveModule } from '@/lib/reports/live-modules/module-view-mode';

describe('module-view-mode', () => {
  it('reconciliacion sola usa vista rica', () => {
    assert.equal(resolvePreviewMode(['reconciliacion']), 'reconciliation-rich');
  });

  it('balance solo usa vista rica', () => {
    assert.equal(resolvePreviewMode(['balance']), 'balance-rich');
  });

  it('multi-modulo usa tabular', () => {
    assert.equal(resolvePreviewMode(['produccion', 'balance']), 'tabular');
  });

  it('isLiveModule identifica modulos en vivo', () => {
    assert.equal(isLiveModule('balance'), true);
    assert.equal(isLiveModule('produccion'), false);
  });
});
