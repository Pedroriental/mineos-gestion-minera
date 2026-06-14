-- ============================================================
-- MineOS: Migración V5 — Archivo histórico de nómina + periodos
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Periodos de pago (consolidación multi-semana estilo Excel)
CREATE TABLE IF NOT EXISTS nomina_periodos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label        TEXT NOT NULL,
  range_start  DATE NOT NULL,
  range_end    DATE NOT NULL,
  total_usd    NUMERIC(14,2) NOT NULL DEFAULT 0,
  origen       TEXT NOT NULL DEFAULT 'import_historico'
    CHECK (origen IN ('import_historico', 'consolidacion_manual', 'cierre_operativo', 'cierre_mes')),
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nomina_periodo_semanas (
  periodo_id UUID NOT NULL REFERENCES nomina_periodos(id) ON DELETE CASCADE,
  semana_id  UUID NOT NULL REFERENCES nomina_semanas(id) ON DELETE CASCADE,
  PRIMARY KEY (periodo_id, semana_id)
);

-- 2. Refuerzo nomina_semanas
ALTER TABLE nomina_semanas
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'cierre_v3'
    CHECK (origen IN ('cierre_v3', 'import_historico', 'ajuste_manual')),
  ADD COLUMN IF NOT EXISTS periodo_id UUID REFERENCES nomina_periodos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nomina_semanas_periodo ON nomina_semanas(periodo_id);
CREATE INDEX IF NOT EXISTS idx_nomina_semanas_origen ON nomina_semanas(origen);

-- 3. Refuerzo nomina_registros (snapshot + desglose)
ALTER TABLE nomina_registros
  ADD COLUMN IF NOT EXISTS bonificaciones NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_vales NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'cierre_v3'
    CHECK (origen IN ('cierre_v3', 'import_historico', 'ajuste_manual'));

-- FK explícita (si no existía)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nomina_registros_semana_id_fkey'
  ) THEN
    ALTER TABLE nomina_registros
      ADD CONSTRAINT nomina_registros_semana_id_fkey
      FOREIGN KEY (semana_id) REFERENCES nomina_semanas(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_nomina_registros_origen ON nomina_registros(origen);

-- 4. Vales ligados a semana al cobrar
ALTER TABLE nomina_vales
  ADD COLUMN IF NOT EXISTS semana_id UUID REFERENCES nomina_semanas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nomina_vales_semana ON nomina_vales(semana_id);

-- 5. RLS periodos
ALTER TABLE nomina_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina_periodo_semanas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_access" ON nomina_periodos;
CREATE POLICY "auth_full_access" ON nomina_periodos
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_full_access" ON nomina_periodo_semanas;
CREATE POLICY "auth_full_access" ON nomina_periodo_semanas
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 6. RPC: import histórico transaccional (payload JSON)
CREATE OR REPLACE FUNCTION import_nomina_historica(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id uuid;
  v_label text := coalesce(payload->>'label', 'Import histórico');
  v_range_start date := (payload->>'range_start')::date;
  v_range_end date := (payload->>'range_end')::date;
  v_total_usd numeric := coalesce((payload->>'total_usd')::numeric, 0);
  v_user_id uuid := (payload->>'user_id')::uuid;
  v_periodo_origen text := coalesce(payload->>'origen', 'import_historico');
  v_semana jsonb;
  v_semana_id uuid;
  v_reg jsonb;
  v_personal_id uuid;
  v_semana_ids uuid[] := '{}';
BEGIN
  -- Periodo (upsert por rango + origen import)
  SELECT id INTO v_periodo_id
  FROM nomina_periodos
  WHERE range_start = v_range_start
    AND range_end = v_range_end
    AND origen = 'import_historico'
  LIMIT 1;

  IF v_periodo_id IS NULL THEN
    INSERT INTO nomina_periodos (label, range_start, range_end, total_usd, origen, metadata, created_by)
    VALUES (
      v_label,
      v_range_start,
      v_range_end,
      v_total_usd,
      v_periodo_origen,
      coalesce(payload->'metadata', '{}'::jsonb),
      v_user_id
    )
    RETURNING id INTO v_periodo_id;
  ELSE
    UPDATE nomina_periodos
    SET label = v_label,
        total_usd = v_total_usd,
        metadata = coalesce(payload->'metadata', metadata)
    WHERE id = v_periodo_id;
    DELETE FROM nomina_periodo_semanas WHERE periodo_id = v_periodo_id;
  END IF;

  FOR v_semana IN SELECT * FROM jsonb_array_elements(coalesce(payload->'semanas', '[]'::jsonb))
  LOOP
    INSERT INTO nomina_semanas (
      semana_inicio, semana_fin, area, total_trabajadores, total_pagado,
      registrado_por, origen, periodo_id
    )
    VALUES (
      (v_semana->>'semana_inicio')::date,
      (v_semana->>'semana_fin')::date,
      v_semana->>'area',
      coalesce((v_semana->>'total_trabajadores')::int, 0),
      coalesce((v_semana->>'total_pagado')::numeric, 0),
      v_user_id,
      'import_historico',
      v_periodo_id
    )
    ON CONFLICT (semana_inicio, area) DO UPDATE SET
      semana_fin = EXCLUDED.semana_fin,
      total_trabajadores = EXCLUDED.total_trabajadores,
      total_pagado = EXCLUDED.total_pagado,
      origen = 'import_historico',
      periodo_id = v_periodo_id
    RETURNING id INTO v_semana_id;

    DELETE FROM nomina_registros WHERE semana_id = v_semana_id;

    FOR v_reg IN SELECT * FROM jsonb_array_elements(coalesce(v_semana->'registros', '[]'::jsonb))
    LOOP
      v_personal_id := (v_reg->>'personal_id')::uuid;
      IF v_personal_id IS NULL THEN
        CONTINUE;
      END IF;
      INSERT INTO nomina_registros (
        semana_id, personal_id, monto_pagado, es_semana_libre,
        bono_transporte_pagado, estado_asistencia, dias_trabajados,
        salario_base_calculado, novedad_turno, novedad_turno_obs,
        bonificaciones, total_vales, personal_snapshot, origen
      )
      VALUES (
        v_semana_id,
        v_personal_id,
        coalesce((v_reg->>'monto_pagado')::numeric, 0),
        coalesce((v_reg->>'es_semana_libre')::boolean, false),
        coalesce((v_reg->>'bono_transporte_pagado')::numeric, 0),
        coalesce(v_reg->>'estado_asistencia', 'trabajada'),
        coalesce((v_reg->>'dias_trabajados')::smallint, 7),
        (v_reg->>'salario_base_calculado')::numeric,
        coalesce(v_reg->>'novedad_turno', 'ACTIVO'),
        coalesce(v_reg->>'novedad_turno_obs', ''),
        coalesce((v_reg->>'bonificaciones')::numeric, 0),
        coalesce((v_reg->>'total_vales')::numeric, 0),
        v_reg->'personal_snapshot',
        'import_historico'
      );
    END LOOP;

    v_semana_ids := array_append(v_semana_ids, v_semana_id);
    INSERT INTO nomina_periodo_semanas (periodo_id, semana_id)
    VALUES (v_periodo_id, v_semana_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'periodo_id', v_periodo_id,
    'semana_ids', to_jsonb(v_semana_ids)
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION import_nomina_historica(jsonb) TO authenticated;
