-- ============================================================
-- MineOS: Fix histórico importación v2
-- Corrige corrupción de datos entre periodos solapados.
--
-- CAMBIOS CLAVE vs V5:
--   1. ELIMINA la constraint única (semana_inicio, area) que bloqueaba la
--      coexistencia de semanas de distintos periodos con las mismas fechas.
--   2. Reemplaza por constraint (semana_inicio, area, periodo_id) para que
--      cada periodo pueda tener sus propias semanas sin colisión.
--   3. Propaga periodo_id a cada nomina_registro insertado.
--   4. Hace backfill de registros históricos existentes.
--
-- INSTRUCCIONES:
--   Ejecutar en Supabase > SQL Editor (una sola vez).
-- ============================================================

-- ── PASO CRÍTICO: Eliminar la constraint antigua que causa el error ────────
-- "duplicate key value violates unique constraint nomina_semanas_semana_inicio_area_key"
-- Esta constraint impedía que dos periodos distintos tuvieran semanas con la
-- misma fecha y área. Hay que eliminarla y reemplazarla por una más específica.
ALTER TABLE nomina_semanas
  DROP CONSTRAINT IF EXISTS nomina_semanas_semana_inicio_area_key;

-- También eliminar el índice UNIQUE que pueda existir con ese mismo propósito
DROP INDEX IF EXISTS nomina_semanas_semana_inicio_area_key;
DROP INDEX IF EXISTS idx_nomina_semanas_semana_inicio_area;

-- Nueva constraint: semana única POR PERIODO (permite que distintos periodos
-- tengan la misma semana/área sin colisionar entre sí).
-- Nota: Si periodo_id es NULL (semanas de cierre_v3), se permite duplicado
-- con NULLS NOT DISTINCT solo en Postgres 15+. Para compatibilidad usamos
-- un índice parcial en lugar de la constraint directa.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nomina_semanas_periodo_area_inicio
  ON nomina_semanas(semana_inicio, area, periodo_id)
  WHERE periodo_id IS NOT NULL;

-- Las semanas SIN periodo (cierre_v3 activo) mantienen su unicidad original:
CREATE UNIQUE INDEX IF NOT EXISTS idx_nomina_semanas_sin_periodo_area_inicio
  ON nomina_semanas(semana_inicio, area)
  WHERE periodo_id IS NULL;

-- ── Índice auxiliar para la nueva lógica de búsqueda ─────────────────────
CREATE INDEX IF NOT EXISTS idx_nomina_semanas_periodo_inicio_area
  ON nomina_semanas(periodo_id, semana_inicio, area);

-- ── Asegurar que la columna periodo_id existe en nomina_registros ─────────
ALTER TABLE nomina_registros
  ADD COLUMN IF NOT EXISTS periodo_id UUID REFERENCES nomina_periodos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nomina_registros_periodo
  ON nomina_registros(periodo_id);



-- ── RPC corregido: import_nomina_historica ────────────────────────────────
CREATE OR REPLACE FUNCTION import_nomina_historica(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id   uuid;
  v_label        text    := coalesce(payload->>'label', 'Import histórico');
  v_range_start  date    := (payload->>'range_start')::date;
  v_range_end    date    := (payload->>'range_end')::date;
  v_total_usd    numeric := coalesce((payload->>'total_usd')::numeric, 0);
  v_user_id      uuid    := (payload->>'user_id')::uuid;
  v_periodo_origen text  := coalesce(payload->>'origen', 'import_historico');
  v_semana       jsonb;
  v_semana_id    uuid;
  v_reg          jsonb;
  v_personal_id  uuid;
  v_semana_ids   uuid[]  := '{}';
BEGIN
  -- ── 1. Periodo: upsert por rango + origen import ──────────────────────────
  --    Si ya existe un periodo idéntico (mismo label + rango) lo reutilizamos
  --    pero SOLO limpiamos sus vínculos de semanas anteriores (no borramos datos
  --    de otros periodos que puedan compartir fechas).
  SELECT id INTO v_periodo_id
  FROM nomina_periodos
  WHERE range_start = v_range_start
    AND range_end   = v_range_end
    AND label       = v_label
    AND origen      = 'import_historico'
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
    -- Actualizar metadatos del periodo existente
    UPDATE nomina_periodos
    SET total_usd = v_total_usd,
        metadata  = coalesce(payload->'metadata', metadata)
    WHERE id = v_periodo_id;

    -- Limpiar vínculos de semanas de ESTE periodo (y solo de este)
    -- Las semanas vinculadas al periodo se borran con CASCADE desde nomina_semanas
    DELETE FROM nomina_semanas
    WHERE periodo_id = v_periodo_id
      AND origen     = 'import_historico';

    DELETE FROM nomina_periodo_semanas WHERE periodo_id = v_periodo_id;
  END IF;

  -- ── 2. Procesar cada semana del payload ───────────────────────────────────
  FOR v_semana IN SELECT * FROM jsonb_array_elements(coalesce(payload->'semanas', '[]'::jsonb))
  LOOP
    -- NUEVA ESTRATEGIA: INSERT directo con periodo_id como parte del registro.
    -- No usamos ON CONFLICT (semana_inicio, area) porque eso destruiría semanas
    -- de otros periodos que compartan fecha/área.
    -- En su lugar: si ya existe una semana de ESTE periodo con esa fecha/área,
    -- la reutilizamos; si no, creamos una nueva.
    SELECT id INTO v_semana_id
    FROM nomina_semanas
    WHERE semana_inicio = (v_semana->>'semana_inicio')::date
      AND area          = v_semana->>'area'
      AND periodo_id    = v_periodo_id
    LIMIT 1;

    IF v_semana_id IS NULL THEN
      -- Insertar nueva semana (sin conflicto con otras de otros periodos)
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
      RETURNING id INTO v_semana_id;
    ELSE
      -- Actualizar la semana existente de ESTE periodo y limpiar sus registros
      UPDATE nomina_semanas
      SET semana_fin         = (v_semana->>'semana_fin')::date,
          total_trabajadores = coalesce((v_semana->>'total_trabajadores')::int, 0),
          total_pagado       = coalesce((v_semana->>'total_pagado')::numeric, 0),
          origen             = 'import_historico'
      WHERE id = v_semana_id;

      -- Solo borramos registros de ESTA semana (no toca otras semanas)
      DELETE FROM nomina_registros WHERE semana_id = v_semana_id;
    END IF;

    -- ── 3. Insertar registros de trabajadores ─────────────────────────────
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
        bonificaciones, total_vales, personal_snapshot, origen,
        periodo_id  -- ← Ahora sí propagamos el periodo_id al registro
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
        'import_historico',
        v_periodo_id  -- ← propagado
      );
    END LOOP;

    v_semana_ids := array_append(v_semana_ids, v_semana_id);
    INSERT INTO nomina_periodo_semanas (periodo_id, semana_id)
    VALUES (v_periodo_id, v_semana_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',         true,
    'periodo_id', v_periodo_id,
    'semana_ids', to_jsonb(v_semana_ids)
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION import_nomina_historica(jsonb) TO authenticated;

-- ── Opcional: Backfill periodo_id en registros existentes ─────────────────
-- Propaga periodo_id a los registros históricos que lo tienen NULL,
-- enlazándolos con el periodo al que pertenece su semana.
-- Ejecutar una sola vez después de la migración.
UPDATE nomina_registros nr
SET periodo_id = ns.periodo_id
FROM nomina_semanas ns
WHERE nr.semana_id  = ns.id
  AND nr.periodo_id IS NULL
  AND ns.periodo_id IS NOT NULL
  AND nr.origen     = 'import_historico';
