import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLiveSupabaseClient,
  hasSupabaseLiveEnv,
  loadEnvLocal,
} from '@/lib/test/load-env-local';

loadEnvLocal();
const live = hasSupabaseLiveEnv();

describe('execute_dynamic_report live', { skip: !live }, () => {
  it('responde ok para produccion con payload minimo', async () => {
    const supabase = createLiveSupabaseClient();
    const payload = {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-07',
      modules: ['produccion'],
      groupBy: 'dia',
    };

    const { data, error } = await supabase.rpc('execute_dynamic_report', { payload });
    assert.equal(error, null);
    assert.equal(data?.ok, true);
    assert.ok(data?.data?.produccion);
  });

  it('nomina usa semana_fin en rango mensual', async () => {
    const supabase = createLiveSupabaseClient();
    const payload = {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      modules: ['nomina'],
      groupBy: 'mes',
    };

    const { data, error } = await supabase.rpc('execute_dynamic_report', { payload });
    assert.equal(error, null);
    assert.ok(data?.data?.nomina);
  });
});

describe('get_balance_operativo live', { skip: !live }, () => {
  it('devuelve agregados para un rango corto', async () => {
    const supabase = createLiveSupabaseClient();
    const { data, error } = await supabase.rpc('get_balance_operativo', {
      p_desde: '2026-05-01',
      p_hasta: '2026-05-07',
    });

    assert.equal(error, null);
    assert.ok(data);
    assert.ok('ingreso_oro_usd' in (data as Record<string, unknown>));
  });
});
