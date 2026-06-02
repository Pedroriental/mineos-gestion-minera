import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateImportTotals } from '@/lib/nomina/archive';

describe('validateImportTotals', () => {
  it('accepts exact match', () => {
    const res = validateImportTotals(15000, 15000);
    assert.equal(res.ok, true);
    assert.equal(res.delta, 0);
  });

  it('accepts match within tolerance', () => {
    const res = validateImportTotals(1000, 1000.03);
    assert.equal(res.ok, true);
    assert.equal(res.delta, 0.03);
  });

  it('rejects mismatch beyond tolerance', () => {
    const res = validateImportTotals(1000, 950);
    assert.equal(res.ok, false);
    assert.equal(res.delta, -50);
    assert.ok(res.message?.includes('950'));
    assert.ok(res.message?.includes('1000'));
  });

  it('accepts negative delta within tolerance', () => {
    const res = validateImportTotals(1000, 999.98);
    assert.equal(res.ok, true);
    assert.equal(res.delta, -0.02);
  });

  it('rejects when computed > expected beyond tolerance', () => {
    const res = validateImportTotals(5000, 5100, 1);
    assert.equal(res.ok, false);
    assert.equal(res.delta, 100);
  });

  it('handles zero values', () => {
    const res = validateImportTotals(0, 0);
    assert.equal(res.ok, true);
    assert.equal(res.delta, 0);
  });
});
