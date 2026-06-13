-- ============================================================
-- MineOS: fix RPC cerrar_nomina_semana audit usuario_id UUID
--
-- Contexto:
--   nomina_audit_log.usuario_id fue migrado de TEXT a UUID, pero la RPC
--   seguia insertando auth.uid() como text. Postgres rechaza:
--   "column usuario_id is of type uuid but expression is of type text".
--
-- Ejecutar en Supabase SQL Editor para actualizar la funcion en produccion.
-- ============================================================

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
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'CIERRE_NOMINA:NO_AUTENTICADO';
  END IF;

  IF v_area IS NULL OR v_inicio IS NULL OR v_fin IS NULL OR v_trab = 0 OR v_cierre IS NULL THEN
    RAISE EXCEPTION 'CIERRE_NOMINA:PAYLOAD_INVALIDO';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('nomina_cierre_semana'),
    hashtext(v_area || '|' || v_inicio::text)
  );

  SELECT id INTO v_semana_id
  FROM nomina_semanas
  WHERE semana_inicio = v_inicio
    AND area = v_area
    AND periodo_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

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

  SELECT round(coalesce(sum(monto_pagado), 0), 2) INTO v_sum_reg
  FROM nomina_registros
  WHERE semana_id = v_semana_id;

  IF v_sum_reg <> v_total THEN
    RAISE EXCEPTION 'CIERRE_NOMINA:TOTAL_INCONSISTENTE suma_registros=% total=%', v_sum_reg, v_total;
  END IF;

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

  SELECT array_agg((r->>'personal_id')::uuid) INTO v_personal_ids
  FROM jsonb_array_elements(p_payload->'registros') r;

  UPDATE nomina_vales
  SET estado = 'COBRADO', semana_id = v_semana_id
  WHERE personal_id = ANY(v_personal_ids)
    AND estado = 'PENDIENTE';

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
          coalesce(p_payload->'gasto'->>'descripcion', 'Nomina ' || upper(v_area)),
          v_total,
          'Nomina interna',
          p_payload->'gasto'->>'notas',
          v_user
        )
        RETURNING id INTO v_gasto_id;

        UPDATE nomina_semanas SET gasto_id = v_gasto_id WHERE id = v_semana_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO nomina_audit_log (accion, entidad, entidad_id, detalle, usuario_id)
  VALUES (
    'CIERRE_NOMINA_V3',
    'nomina_semanas',
    v_semana_id::text,
    format(
      'Cierre Nomina V3 de %s del %s al %s. Total: $%s para %s trabajadores.',
      upper(v_area), v_inicio, v_fin, to_char(v_total, 'FM999999990.00'), v_trab
    ),
    v_user
  );

  RETURN jsonb_build_object(
    'semana_id', v_semana_id,
    'total_pagado', v_total,
    'gasto_id', v_gasto_id
  );
END;
$$;

REVOKE ALL ON FUNCTION cerrar_nomina_semana(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION cerrar_nomina_semana(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION cerrar_nomina_semana(jsonb) TO authenticated;
