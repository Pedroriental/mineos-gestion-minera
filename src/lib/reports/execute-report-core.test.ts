import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExecuteReportRpcPayload,
  resolveNominaRpcUsesSemanaFin,
  runExecuteReport,
  splitReportModules,
} from '@/lib/reports/execute-report-core';
import {
  buildNominaPeriodFilterFromRange,
  inferNominaPeriodKind,
} from '@/lib/nomina/nomina-read-model';
import type { ReportPayload } from '@/lib/reports/report-types';

const minimalProduccionPayload: ReportPayload = {
  dateFrom: '2026-05-01',
  dateTo: '2026-05-07',
  modules: ['produccion'],
  groupBy: 'dia',
};

const balanceOnlyPayload: ReportPayload = {
  dateFrom: '2026-05-01',
  dateTo: '2026-05-31',
  modules: ['balance'],
  groupBy: 'mes',
};

const mixedPayload: ReportPayload = {
  dateFrom: '2026-05-01',
  dateTo: '2026-05-31',
  modules: ['produccion', 'nomina', 'balance'],
  groupBy: 'mes',
  filters: {
    produccion: { molino: { in: ['M1'] } },
  },
};

const noopReconciliation = async () => ({ rows: [] });

describe('execute-report-core module split', () => {
  it('separa balance y reconciliacion del resto de modulos', () => {
    const split = splitReportModules(['produccion', 'balance', 'nomina', 'reconciliacion']);
    assert.deepEqual(split.rpcModules, ['produccion', 'nomina']);
    assert.equal(split.includesBalance, true);
    assert.equal(split.includesReconciliacion, true);
  });

  it('buildExecuteReportRpcPayload excluye modulos en vivo', () => {
    const rpcPayload = buildExecuteReportRpcPayload(mixedPayload);
    assert.ok(rpcPayload);
    assert.deepEqual(rpcPayload!.modules, ['produccion', 'nomina']);
    assert.equal(rpcPayload!.dateFrom, mixedPayload.dateFrom);
    assert.deepEqual(rpcPayload!.filters, mixedPayload.filters);
  });

  it('retorna null si solo hay modulos en vivo (sin RPC)', () => {
    assert.equal(buildExecuteReportRpcPayload(balanceOnlyPayload), null);
    assert.equal(
      buildExecuteReportRpcPayload({
        ...balanceOnlyPayload,
        modules: ['reconciliacion'],
      }),
      null,
    );
  });
});

describe('execute-report-core nomina RPC date axis', () => {
  it('mes y ano usan semana_fin', () => {
    assert.equal(resolveNominaRpcUsesSemanaFin('2026-05-01', '2026-05-31', 'mes'), true);
    assert.equal(resolveNominaRpcUsesSemanaFin('2026-05-01', '2026-12-31', 'ano'), true);
  });

  it('rango corto (<=7 dias) usa semana_inicio salvo groupBy dia', () => {
    assert.equal(resolveNominaRpcUsesSemanaFin('2026-05-01', '2026-05-07', 'semana'), false);
    assert.equal(resolveNominaRpcUsesSemanaFin('2026-05-01', '2026-05-07', 'area'), false);
  });

  it('groupBy dia fuerza semana_fin en el RPC', () => {
    assert.equal(resolveNominaRpcUsesSemanaFin('2026-05-01', '2026-05-07', 'dia'), true);
  });

  it('rango largo alinea read-model (semana_fin) con RPC', () => {
    const from = '2026-05-01';
    const to = '2026-05-31';
    const kind = inferNominaPeriodKind(from, to);
    const filter = buildNominaPeriodFilterFromRange(from, to);
    assert.equal(kind, 'month');
    assert.equal(filter.mode, 'semana_fin');
    assert.equal(resolveNominaRpcUsesSemanaFin(from, to, 'mes'), true);
  });

  it('semana laboral corta alinea read-model (semana_inicio) con RPC', () => {
    const from = '2026-05-04';
    const to = '2026-05-10';
    const kind = inferNominaPeriodKind(from, to);
    const filter = buildNominaPeriodFilterFromRange(from, to);
    assert.equal(kind, 'week');
    assert.equal(filter.mode, 'semana_inicio');
    assert.equal(resolveNominaRpcUsesSemanaFin(from, to, 'semana'), false);
  });
});

describe('execute-report-core runExecuteReport', () => {
  it('payload minimo produccion llama RPC una vez sin balance', async () => {
    const rpcCalls: ReportPayload[] = [];

    const result = await runExecuteReport(
      {
        callRpc: async (payload) => {
          rpcCalls.push(payload);
          return {
            ok: true,
            dateRange: { from: payload.dateFrom, to: payload.dateTo },
            data: {
              produccion: {
                rows: [{ periodo_label: '2026-05-01', oro_recuperado_g: 10 }],
                totals: { total_oro: 10 },
              },
            },
          };
        },
        fetchBalanceModule: async () => {
          throw new Error('balance no deberia llamarse');
        },
        fetchReconciliationModule: noopReconciliation,
      },
      minimalProduccionPayload,
    );

    assert.equal(rpcCalls.length, 1);
    assert.deepEqual(rpcCalls[0]!.modules, ['produccion']);
    assert.ok(result.data.produccion?.rows?.length);
    assert.equal(result.data.balance, undefined);
    assert.equal(result.ok, true);
  });

  it('solo balance usa motor en vivo sin RPC', async () => {
    let rpcCalled = false;

    const result = await runExecuteReport(
      {
        callRpc: async () => {
          rpcCalled = true;
          return { ok: true, dateRange: { from: '', to: '' }, data: {} };
        },
        fetchBalanceModule: async (dateRange, groupBy) => ({
          rows: [{ periodo_label: '2026-05', rentabilidad_usd: 100 }],
          totals: { rentabilidad_usd: 100 },
        }),
        fetchReconciliationModule: noopReconciliation,
      },
      balanceOnlyPayload,
    );

    assert.equal(rpcCalled, false);
    assert.equal(result.data.balance?.totals?.rentabilidad_usd, 100);
    assert.deepEqual(result.modules, ['balance']);
    assert.equal(result.groupBy, 'mes');
  });

  it('multi-modulo fusiona RPC y balance en vivo', async () => {
    const rpcCalls: ReportPayload[] = [];

    const result = await runExecuteReport(
      {
        callRpc: async (payload) => {
          rpcCalls.push(payload);
          return {
            ok: true,
            dateRange: { from: payload.dateFrom, to: payload.dateTo },
            data: {
              produccion: { totals: { total_oro: 50 } },
              nomina: { totals: { total_pagado_usd: 2000 } },
            },
          };
        },
        fetchBalanceModule: async () => ({
          totals: { rentabilidad_usd: 500, gasto_nomina_usd: 2000 },
        }),
        fetchReconciliationModule: noopReconciliation,
      },
      mixedPayload,
    );

    assert.equal(rpcCalls.length, 1);
    assert.deepEqual(rpcCalls[0]!.modules, ['produccion', 'nomina']);
    assert.equal(result.data.produccion?.totals?.total_oro, 50);
    assert.equal(result.data.nomina?.totals?.total_pagado_usd, 2000);
    assert.equal(result.data.balance?.totals?.rentabilidad_usd, 500);
  });

  it('propaga error del RPC', async () => {
    await assert.rejects(
      () =>
        runExecuteReport(
          {
            callRpc: async () => {
              throw new Error('RPC error: permission denied');
            },
            fetchBalanceModule: async () => ({ rows: [] }),
            fetchReconciliationModule: noopReconciliation,
          },
          minimalProduccionPayload,
        ),
      /permission denied/,
    );
  });

  it('pasa filtros de balance al fetch en vivo', async () => {
    let receivedFilters: unknown;

    await runExecuteReport(
      {
        callRpc: async () => ({ ok: true, dateRange: { from: '', to: '' }, data: {} }),
        fetchBalanceModule: async (_range, _groupBy, balanceFilters) => {
          receivedFilters = balanceFilters;
          return { rows: [] };
        },
        fetchReconciliationModule: noopReconciliation,
      },
      {
        ...balanceOnlyPayload,
        filters: { balance: { rentabilidad_usd: { gte: 0 } } },
      },
    );

    assert.deepEqual(receivedFilters, { rentabilidad_usd: { gte: 0 } });
  });

  it('solo reconciliacion usa motor en vivo sin RPC', async () => {
    let rpcCalled = false;

    const result = await runExecuteReport(
      {
        callRpc: async () => {
          rpcCalled = true;
          return { ok: true, dateRange: { from: '', to: '' }, data: {} };
        },
        fetchBalanceModule: async () => ({ rows: [] }),
        fetchReconciliationModule: async () => ({
          rows: [{ regla: 'Sacos mina/planta', estado: 'ok' }],
          totals: { oro_real_g: 90 },
        }),
      },
      {
        dateFrom: '2026-05-01',
        dateTo: '2026-05-07',
        modules: ['reconciliacion'],
        groupBy: 'periodo',
      },
    );

    assert.equal(rpcCalled, false);
    assert.equal(result.data.reconciliacion?.rows?.length, 1);
  });
});
