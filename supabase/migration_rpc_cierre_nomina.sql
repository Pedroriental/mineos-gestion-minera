-- ============================================================
-- MineOS: Blindaje de Nómina (Fase 1) — RPC cerrar_nomina_semana
--
-- Mueve el cierre de nómina V3 (semana + registros + cierre +
-- vales + gasto + audit) a UNA transacción Postgres:
--
--   1. pg_advisory_xact_lock por (área + semana_inicio): elimina la
--      race condition del patrón Check-then-Write sin serializar
--      cierres de otras áreas/semanas.
--   2. Check-then-Write interno seguro (nadie más entra a esta clave).
--   3. Rechaza re-cierres de semanas que pertenecen a un ciclo CERRADO.
--   4. Verifica que los vales deducidos coincidan con los PENDIENTES
--      reales en BD (evita liquidar vales no reflejados en el total).
--   5. Identidad real vía auth.uid() — nunca del payload del cliente.
--   6. Cualquier error revierte TODO (adiós estado parcial).
--
-- Requiere (ya aplicado en fix_historico_import_v2.sql):
--   UNIQUE INDEX idx_nomina_semanas_sin_periodo_area_inicio
--     ON nomina_semanas(semana_inicio, area) WHERE periodo_id IS NULL;
--
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Red de seguridad (idempotente): unicidad de la semana OPERATIVA por área.
-- Si dos cierres concurrentes burlaran el lock, la BD garantiza que la
-- carrera termina en error controlado, nunca en semana duplicada.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nomina_semanas_sin_periodo_area_inicio
  ON nomina_semanas(semana_inicio, area)
  WHERE periodo_id IS NULL;

CREATE OR REPLACE FUNCTION cerrar_nomina_semana(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user        uuid := auth.uid();
  v_area        text := p_payload->>'area';
  v_inicio      date := (p_payload->>'inicio')::date;
  v_fin         date := (p_payload->>'fin')::date;
  v_total       numeric := round(coalesce((p_payload->>'total_pagado')::numeric, 0), 2);
  v_trab        integer := coalesce(jsonb_array_length(p_payload->'registros'), 0);
  v_cierre      jsonb := p_payload->'cierre';
  v_semana_id   uuid;
  v_gasto_id    uuid;
  v_cat_id      uuid;
  v_sum_reg     numeric;
  v_personal_ids uuid[];
  v_vale        record;
BEGIN
  -- ── 0. Guardas de identidad y payload ──────────────────────
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'CIERRE_NOMINA:NO_AUTENTICADO';
  END IF;

  IF v_area IS NULL OR v_inicio IS NULL OR v_fin IS NULL OR v_trab = 0 OR v_cierre IS NULL THEN
    RAISE EXCEPTION 'CIERRE_NOMINA:PAYLOAD_INVALIDO';
  END IF;

  -- ── 1. Lock lógico por (área + semana) ─────────────────────
  -- Serializa SOLO los cierres concurrentes de la misma clave de
  -- negocio; otras áreas/semanas (y futuros tenants) no se bloquean.
  PERFORM pg_advisory_xact_lock(
    hashtext('nomina_cierre_semana'),
    hashtext(v_area || '|' || v_inicio::text)
  );

  -- ── 2. Check-then-Write seguro de la semana operativa ──────
  SELECT id INTO v_semana_id
  FROM nomina_semanas
  WHERE semana_inicio = v_inicio
    AND area = v_area
    AND periodo_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Guard: no re-cerrar semanas consolidadas en un ciclo CERRADO
  IF v_semana_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM nomina_ciclo_semanas ncs
    JOIN nomina_ciclos nc ON nc.id = ncs.ciclo_id
    WHERE ncs.semana_id = v_semana_id
      AND nc.estado = 'CERRADO'
  ) THEN
    RAISE EXCEPTION 'CIERRE_NOMINA:SEMANA_EN_CICLO_CERRADO';
  END IF;

  IF v_semana_id IS NULL THEN
    INSERT INTO nomina_semanas (
      semana_inicio, semana_fin, area, total_trabajadores,
      total_pagado, registrado_por, origen, periodo_id
    )
    VALUES (v_inicio, v_fin, v_area, v_trab, v_total, v_user, 'cierre_v3', NULL)
    RETURNING id INTO v_semana_id;
  ELSE
    UPDATE nomina_semanas
    SET semana_fin         = v_fin,
        total_trabajadores = v_trab,
        total_pagado       = v_total,
        registrado_por     = v_user,
        origen             = 'cierre_v3'
    WHERE id = v_semana_id;
  END IF;

  -- ── 3. Consistencia de vales: deducción declarada vs PENDIENTES en BD ──
  FOR v_vale IN
    SELECT (r->>'personal_id')::uuid AS personal_id,
           round(coalesce((r->>'total_vales')::numeric, 0), 2) AS declarado,
           round(coalesce((
             SELECT sum(v.monto)
             FROM nomina_vales v
             WHERE v.personal_id = (r->>'personal_id')::uuid
               AND v.estado = 'PENDIENTE'
           ), 0), 2) AS pendiente
    FROM jsonb_array_elements(p_payload->'registros') r
  LOOP
    IF abs(v_vale.declarado - v_vale.pendiente) > 0.01 THEN
      RAISE EXCEPTION 'CIERRE_NOMINA:VALES_DESINCRONIZADOS trabajador=% declarado=% pendiente=%',
        v_vale.personal_id, v_vale.declarado, v_vale.pendiente;
    END IF;
  END LOOP;

  -- ── 4. Reemplazar registros de la semana ───────────────────
  DELETE FROM nomina_registros WHERE semana_id = v_semana_id;

  INSERT INTO nomina_registros (
    semana_id, personal_id, monto_pagado, es_semana_libre,
    bono_transporte_pagado, estado_asistencia, dias_trabajados,
    salario_base_calculado, novedad_turno, novedad_turno_obs,
    bonificaciones, total_vales, personal_snapshot, origen
  )
  SELECT
    v_semana_id,
    (r->>'personal_id')::uuid,
    round(coalesce((r->>'monto_pagado')::numeric, 0), 2),
    coalesce((r->>'es_semana_libre')::boolean, false),
    round(coalesce((r->>'bono_transporte_pagado')::numeric, 0), 2),
    coalesce(r->>'estado_asistencia', 'trabajada'),
    coalesce((r->>'dias_trabajados')::int, 0),
    (r->>'salario_base_calculado')::numeric,
    coalesce(r->>'novedad_turno', 'ACTIVO'),
    coalesce(r->>'novedad_turno_obs', ''),
    round(coalesce((r->>'bonificaciones')::numeric, 0), 2),
    round(coalesce((r->>'total_vales')::numeric, 0), 2),
    r->'personal_snapshot',
    'cierre_v3'
  FROM jsonb_array_elements(p_payload->'registros') r;

  -- Pre-chequeo de integridad con mensaje claro (el constraint trigger
  -- trg_nomina_gasto_integrity validará lo mismo al COMMIT).
  SELECT round(coalesce(sum(monto_pagado), 0), 2) INTO v_sum_reg
  FROM nomina_registros
  WHERE semana_id = v_semana_id;

  IF v_sum_reg <> v_total THEN
    RAISE EXCEPTION 'CIERRE_NOMINA:TOTAL_INCONSISTENTE suma_registros=% total=%', v_sum_reg, v_total;
  END IF;

  -- ── 5. Upsert del cierre (distribución de socios) ──────────
  INSERT INTO nomina_cierres (
    semana_id, total_nomina_usd, pct_pedro, pct_darinel, pct_la_fe,
    monto_pedro, monto_darinel, monto_la_fe, distribucion
  )
  VALUES (
    v_semana_id,
    v_total,
    round(coalesce((v_cierre->>'pct_pedro')::numeric, 0), 2),
    round(coalesce((v_cierre->>'pct_darinel')::numeric, 0), 2),
    round(coalesce((v_cierre->>'pct_la_fe')::numeric, 0), 2),
    round(coalesce((v_cierre->>'monto_pedro')::numeric, 0), 2),
    round(coalesce((v_cierre->>'monto_darinel')::numeric, 0), 2),
    round(coalesce((v_cierre->>'monto_la_fe')::numeric, 0), 2),
    v_cierre->'distribucion'
  )
  ON CONFLICT (semana_id) DO UPDATE SET
    total_nomina_usd = EXCLUDED.total_nomina_usd,
    pct_pedro        = EXCLUDED.pct_pedro,
    pct_darinel      = EXCLUDED.pct_darinel,
    pct_la_fe        = EXCLUDED.pct_la_fe,
    monto_pedro      = EXCLUDED.monto_pedro,
    monto_darinel    = EXCLUDED.monto_darinel,
    monto_la_fe      = EXCLUDED.monto_la_fe,
    distribucion     = EXCLUDED.distribucion;

  -- ── 6. Liquidar vales pendientes de los trabajadores cerrados ──
  SELECT array_agg((r->>'personal_id')::uuid) INTO v_personal_ids
  FROM jsonb_array_elements(p_payload->'registros') r;

  UPDATE nomina_vales
  SET estado = 'COBRADO', semana_id = v_semana_id
  WHERE personal_id = ANY(v_personal_ids)
    AND estado = 'PENDIENTE';

  -- ── 7. Gasto vinculado (update-or-insert, evita gastos huérfanos) ──
  IF v_total > 0 THEN
    SELECT id INTO v_cat_id
    FROM categorias_gasto
    WHERE nombre ILIKE '%nomina%'
    LIMIT 1;

    IF v_cat_id IS NOT NULL THEN
      SELECT gasto_id INTO v_gasto_id FROM nomina_semanas WHERE id = v_semana_id;

      IF v_gasto_id IS NOT NULL AND EXISTS (SELECT 1 FROM gastos WHERE id = v_gasto_id) THEN
        UPDATE gastos
        SET fecha       = CURRENT_DATE,
            categoria_id = v_cat_id,
            descripcion = coalesce(p_payload->'gasto'->>'descripcion', descripcion),
            monto       = v_total,
            notas       = coalesce(p_payload->'gasto'->>'notas', notas),
            updated_at  = now()
        WHERE id = v_gasto_id;
      ELSE
        INSERT INTO gastos (fecha, categoria_id, descripcion, monto, proveedor, notas, registrado_por)
        VALUES (
          CURRENT_DATE,
          v_cat_id,
          coalesce(p_payload->'gasto'->>'descripcion', 'Nómina ' || upper(v_area)),
          v_total,
          'Nómina interna',
          p_payload->'gasto'->>'notas',
          v_user
        )
        RETURNING id INTO v_gasto_id;

        UPDATE nomina_semanas SET gasto_id = v_gasto_id WHERE id = v_semana_id;
      END IF;
    END IF;
  END IF;

  -- ── 8. Audit log (dentro de la transacción, con identidad real) ──
  INSERT INTO nomina_audit_log (accion, entidad, entidad_id, detalle, usuario_id)
  VALUES (
    'CIERRE_NOMINA_V3',
    'nomina_semanas',
    v_semana_id::text,
    format(
      'Cierre Nómina V3 de %s del %s al %s. Total: $%s para %s trabajadores.',
      upper(v_area), v_inicio, v_fin, to_char(v_total, 'FM999999990.00'), v_trab
    ),
    v_user::text
  );

  RETURN jsonb_build_object(
    'semana_id', v_semana_id,
    'total_pagado', v_total,
    'gasto_id', v_gasto_id
  );
END;
$$;

-- Solo usuarios autenticados pueden ejecutar el cierre.
REVOKE ALL ON FUNCTION cerrar_nomina_semana(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION cerrar_nomina_semana(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION cerrar_nomina_semana(jsonb) TO authenticated;

COMMENT ON FUNCTION cerrar_nomina_semana(jsonb) IS
  'Cierre transaccional de nómina V3: advisory lock por (área+semana), check-then-write seguro, guard de ciclo cerrado, verificación de vales, registros, cierre, gasto y audit en una sola transacción.';
