-- ============================================================
-- MineOS: Backfill seguro de enlaces de periodos Molinos
-- ============================================================
-- Objetivo:
--   Enlazar periodos/ciclos de Nómina Molinos (area = planta) con sus
--   semanas cerradas reales en la lógica nueva:
--     - nomina_periodo_semanas(periodo_id, semana_id)
--     - nomina_semanas.periodo_id
--     - nomina_periodos.metadata.semana_ids
--
-- Seguridad:
--   - NO recalcula pagos.
--   - NO modifica nomina_registros.
--   - NO modifica trabajadores, vales, bonos ni montos.
--   - Solo enlaza cuando la cantidad de semanas candidatas coincide
--     exactamente con la cantidad esperada por el rango del periodo.
--   - No "roba" semanas ya asociadas a otro periodo.
--
-- Uso recomendado:
--   1) Ejecutar el bloque DIAGNOSTICO.
--   2) Revisar que candidatos_ok tenga las filas esperadas.
--   3) Ejecutar el bloque BACKFILL dentro de la transacción.
--   4) Revisar el diagnostico final.
-- ============================================================

-- ============================================================
-- DIAGNOSTICO PREVIO
-- ============================================================
WITH periodos_molinos AS (
  SELECT
    p.id,
    p.label,
    p.range_start,
    p.range_end,
    p.total_usd,
    p.origen,
    p.metadata,
    COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p.metadata->'semana_ids') = 'array' THEN p.metadata->'semana_ids' ELSE '[]'::jsonb END), 0) AS metadata_semana_ids_count,
    COUNT(DISTINCT nps.semana_id) AS linked_count,
    COUNT(DISTINCT gs.week_start)::int AS expected_weeks
  FROM nomina_periodos p
  LEFT JOIN nomina_periodo_semanas nps ON nps.periodo_id = p.id
  CROSS JOIN LATERAL generate_series(p.range_start, p.range_end, interval '7 days') AS gs(week_start)
  WHERE p.origen = 'consolidacion_manual'
    AND (
      p.metadata->>'area' = 'planta'
      OR p.label ILIKE '%molino%'
      OR p.label ILIKE '%molinos%'
    )
  GROUP BY p.id
),
candidatas AS (
  SELECT
    p.id AS periodo_id,
    COUNT(DISTINCT ns.id)::int AS candidate_weeks,
    ARRAY_AGG(ns.id ORDER BY ns.semana_inicio) FILTER (WHERE ns.id IS NOT NULL) AS semana_ids,
    ARRAY_AGG(ns.semana_inicio ORDER BY ns.semana_inicio) FILTER (WHERE ns.id IS NOT NULL) AS semana_inicios
  FROM periodos_molinos p
  LEFT JOIN nomina_semanas ns
    ON ns.area = 'planta'
   AND ns.semana_inicio >= p.range_start
   AND ns.semana_inicio <= p.range_end
   AND (ns.periodo_id IS NULL OR ns.periodo_id = p.id)
   AND NOT EXISTS (
     SELECT 1
     FROM nomina_periodo_semanas nps_other
     WHERE nps_other.semana_id = ns.id
       AND nps_other.periodo_id <> p.id
   )
  GROUP BY p.id
)
SELECT
  p.label,
  p.range_start,
  p.range_end,
  p.total_usd,
  p.expected_weeks,
  p.linked_count,
  p.metadata_semana_ids_count,
  COALESCE(c.candidate_weeks, 0) AS candidate_weeks,
  c.semana_inicios,
  CASE
    WHEN p.linked_count = p.expected_weeks AND p.metadata_semana_ids_count = p.expected_weeks THEN 'OK'
    WHEN COALESCE(c.candidate_weeks, 0) = p.expected_weeks THEN 'BACKFILL_CANDIDATE'
    ELSE 'REVISAR_MANUAL'
  END AS diagnostico
FROM periodos_molinos p
LEFT JOIN candidatas c ON c.periodo_id = p.id
ORDER BY p.range_start DESC, p.label;

-- ============================================================
-- BACKFILL CONTROLADO
-- ============================================================
BEGIN;

WITH periodos_molinos AS (
  SELECT
    p.id,
    p.label,
    p.range_start,
    p.range_end,
    p.metadata,
    COUNT(DISTINCT gs.week_start)::int AS expected_weeks
  FROM nomina_periodos p
  CROSS JOIN LATERAL generate_series(p.range_start, p.range_end, interval '7 days') AS gs(week_start)
  WHERE p.origen = 'consolidacion_manual'
    AND (
      p.metadata->>'area' = 'planta'
      OR p.label ILIKE '%molino%'
      OR p.label ILIKE '%molinos%'
    )
  GROUP BY p.id
),
candidatas AS (
  SELECT
    p.id AS periodo_id,
    p.metadata,
    p.expected_weeks,
    ARRAY_AGG(ns.id ORDER BY ns.semana_inicio) FILTER (WHERE ns.id IS NOT NULL) AS semana_ids,
    COUNT(DISTINCT ns.id)::int AS candidate_weeks
  FROM periodos_molinos p
  LEFT JOIN nomina_semanas ns
    ON ns.area = 'planta'
   AND ns.semana_inicio >= p.range_start
   AND ns.semana_inicio <= p.range_end
   AND (ns.periodo_id IS NULL OR ns.periodo_id = p.id)
   AND NOT EXISTS (
     SELECT 1
     FROM nomina_periodo_semanas nps_other
     WHERE nps_other.semana_id = ns.id
       AND nps_other.periodo_id <> p.id
   )
  GROUP BY p.id, p.metadata, p.expected_weeks
),
existing_links AS (
  SELECT
    p.id AS periodo_id,
    p.metadata,
    p.expected_weeks,
    ARRAY_AGG(nps.semana_id ORDER BY ns.semana_inicio) AS semana_ids,
    COUNT(DISTINCT nps.semana_id)::int AS linked_weeks
  FROM periodos_molinos p
  JOIN nomina_periodo_semanas nps ON nps.periodo_id = p.id
  JOIN nomina_semanas ns ON ns.id = nps.semana_id
  WHERE ns.area = 'planta'
    AND ns.semana_inicio >= p.range_start
    AND ns.semana_inicio <= p.range_end
  GROUP BY p.id, p.metadata, p.expected_weeks
),
existing_ok AS (
  SELECT
    periodo_id,
    COALESCE(metadata, '{}'::jsonb) AS metadata,
    COALESCE(semana_ids, ARRAY[]::uuid[]) AS semana_ids
  FROM existing_links
  WHERE linked_weeks = expected_weeks
    AND expected_weeks > 0
),
candidate_ok AS (
  SELECT
    periodo_id,
    COALESCE(metadata, '{}'::jsonb) AS metadata,
    COALESCE(semana_ids, ARRAY[]::uuid[]) AS semana_ids
  FROM candidatas
  WHERE candidate_weeks = expected_weeks
    AND expected_weeks > 0
),
backfill_ok AS (
  SELECT * FROM existing_ok
  UNION ALL
  SELECT c.*
  FROM candidate_ok c
  WHERE NOT EXISTS (
    SELECT 1 FROM existing_ok e WHERE e.periodo_id = c.periodo_id
  )
),
insert_links AS (
  INSERT INTO nomina_periodo_semanas (periodo_id, semana_id)
  SELECT b.periodo_id, unnest(b.semana_ids)
  FROM backfill_ok b
  ON CONFLICT DO NOTHING
  RETURNING periodo_id, semana_id
),
update_semanas AS (
  UPDATE nomina_semanas ns
  SET periodo_id = b.periodo_id
  FROM backfill_ok b
  WHERE ns.id = ANY(b.semana_ids)
    AND (ns.periodo_id IS NULL OR ns.periodo_id = b.periodo_id)
  RETURNING ns.id, b.periodo_id
),
update_periodos AS (
  UPDATE nomina_periodos p
  SET metadata =
    jsonb_set(
      jsonb_set(
        COALESCE(p.metadata, '{}'::jsonb),
        '{area}',
        to_jsonb('planta'::text),
        true
      ),
      '{semana_ids}',
      to_jsonb(b.semana_ids),
      true
    )
  FROM backfill_ok b
  WHERE p.id = b.periodo_id
  RETURNING p.id
)
SELECT
  (SELECT COUNT(*) FROM backfill_ok) AS periodos_candidatos,
  (SELECT COUNT(*) FROM insert_links) AS links_insertados,
  (SELECT COUNT(*) FROM update_semanas) AS semanas_actualizadas,
  (SELECT COUNT(*) FROM update_periodos) AS periodos_actualizados;

COMMIT;

-- ============================================================
-- DIAGNOSTICO FINAL
-- ============================================================
WITH periodos_molinos AS (
  SELECT
    p.id,
    p.label,
    p.range_start,
    p.range_end,
    p.total_usd,
    COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p.metadata->'semana_ids') = 'array' THEN p.metadata->'semana_ids' ELSE '[]'::jsonb END), 0) AS metadata_semana_ids_count,
    COUNT(DISTINCT nps.semana_id) AS linked_count,
    COUNT(DISTINCT gs.week_start)::int AS expected_weeks
  FROM nomina_periodos p
  LEFT JOIN nomina_periodo_semanas nps ON nps.periodo_id = p.id
  CROSS JOIN LATERAL generate_series(p.range_start, p.range_end, interval '7 days') AS gs(week_start)
  WHERE p.origen = 'consolidacion_manual'
    AND (
      p.metadata->>'area' = 'planta'
      OR p.label ILIKE '%molino%'
      OR p.label ILIKE '%molinos%'
    )
  GROUP BY p.id
)
SELECT
  label,
  range_start,
  range_end,
  total_usd,
  expected_weeks,
  linked_count,
  metadata_semana_ids_count,
  CASE
    WHEN linked_count = expected_weeks AND metadata_semana_ids_count = expected_weeks THEN 'OK'
    ELSE 'REVISAR_MANUAL'
  END AS estado_nueva_logica
FROM periodos_molinos
ORDER BY range_start DESC, label;
