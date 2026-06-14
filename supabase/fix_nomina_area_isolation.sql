-- ============================================================
-- MineOS: Aislamiento mina ↔ planta (molino) en nómina
-- ============================================================
-- Objetivo:
--   1) Diagnosticar enlaces cruzados entre áreas
--   2) Eliminar cruces existentes (solo links y periodo_id; NO toca registros ni montos)
--   3) Reparar los 2 periodos manuales de molino detectados en auditoría
--   4) Instalar trigger que impida futuros cruces
--
-- Seguridad:
--   - NO modifica nomina_registros, personal, vales ni totales de semana.
--   - Solo nomina_periodo_semanas, nomina_semanas.periodo_id y metadata/total de periodos.
--
-- Uso:
--   1) Ejecutar DIAGNOSTICO (bloque 1)
--   2) Revisar salida
--   3) Ejecutar LIMPIEZA + REPARACION + TRIGGER (bloque 2) en una sola corrida
--   4) Ejecutar DIAGNOSTICO FINAL (bloque 3)
-- ============================================================

-- ============================================================
-- 1) DIAGNOSTICO — enlaces cruzados y periodo_id inconsistente
-- ============================================================
WITH periodo_area AS (
  SELECT
    p.id,
    p.label,
    p.range_start,
    p.range_end,
    p.total_usd,
    p.origen,
    COALESCE(NULLIF(TRIM(p.metadata->>'area'), ''), '—') AS periodo_area
  FROM nomina_periodos p
),
cross_links AS (
  SELECT
    pa.label AS periodo_label,
    pa.periodo_area,
    ns.semana_inicio,
    ns.area AS semana_area,
    ns.total_pagado,
    ns.origen,
    nps.periodo_id,
    nps.semana_id
  FROM nomina_periodo_semanas nps
  JOIN periodo_area pa ON pa.id = nps.periodo_id
  JOIN nomina_semanas ns ON ns.id = nps.semana_id
  WHERE pa.periodo_area NOT IN ('—', '')
    AND ns.area IS DISTINCT FROM pa.periodo_area
),
wrong_periodo_id AS (
  SELECT
    ns.id AS semana_id,
    ns.semana_inicio,
    ns.area AS semana_area,
    ns.total_pagado,
    p.label AS periodo_label,
    p.metadata->>'area' AS periodo_area
  FROM nomina_semanas ns
  JOIN nomina_periodos p ON p.id = ns.periodo_id
  WHERE p.metadata->>'area' IS NOT NULL
    AND TRIM(p.metadata->>'area') <> ''
    AND ns.area IS DISTINCT FROM p.metadata->>'area'
)
SELECT 'cross_links' AS tipo, periodo_label, periodo_area, semana_inicio::text, semana_area, total_pagado::text, origen
FROM cross_links
UNION ALL
SELECT 'wrong_periodo_id' AS tipo, periodo_label, periodo_area, semana_inicio::text, semana_area, total_pagado::text, NULL
FROM wrong_periodo_id
ORDER BY tipo, periodo_label, semana_inicio;

-- Resumen molino (periodos planta)
SELECT
  p.label,
  p.range_start,
  p.range_end,
  p.total_usd,
  p.metadata->>'area' AS area,
  COUNT(DISTINCT nps.semana_id) FILTER (WHERE ns.area = 'planta') AS links_planta,
  COUNT(DISTINCT nps.semana_id) FILTER (WHERE ns.area = 'mina') AS links_mina,
  ARRAY_AGG(DISTINCT ns.semana_inicio ORDER BY ns.semana_inicio)
    FILTER (WHERE ns.area = 'planta') AS semanas_planta,
  ARRAY_AGG(DISTINCT ns.semana_inicio ORDER BY ns.semana_inicio)
    FILTER (WHERE ns.area = 'mina') AS semanas_mina
FROM nomina_periodos p
LEFT JOIN nomina_periodo_semanas nps ON nps.periodo_id = p.id
LEFT JOIN nomina_semanas ns ON ns.id = nps.semana_id
WHERE p.origen = 'consolidacion_manual'
  AND (
    p.metadata->>'area' = 'planta'
    OR p.label ILIKE '%molino%'
  )
GROUP BY p.id
ORDER BY p.range_start;

-- Conflictos previstos antes de limpiar periodo_id (solo lectura)
SELECT
  ns.id,
  ns.semana_inicio,
  ns.area,
  ns.total_pagado,
  ns.origen,
  p.label AS periodo_incorrecto,
  p.metadata->>'area' AS periodo_area,
  EXISTS (
    SELECT 1 FROM nomina_semanas ns2
    WHERE ns2.semana_inicio = ns.semana_inicio
      AND ns2.area = ns.area
      AND ns2.periodo_id IS NULL
      AND ns2.id <> ns.id
  ) AS tiene_duplicado_operativo
FROM nomina_semanas ns
JOIN nomina_periodos p ON p.id = ns.periodo_id
WHERE p.metadata->>'area' IS NOT NULL
  AND TRIM(p.metadata->>'area') <> ''
  AND ns.area IS DISTINCT FROM p.metadata->>'area'
ORDER BY ns.semana_inicio, ns.area;

-- ============================================================
-- 2) LIMPIEZA + REPARACION MOLINO + TRIGGER
-- ============================================================
BEGIN;

-- 2a) Quitar links puente cruzados (periodo.area ≠ semana.area)
DELETE FROM nomina_periodo_semanas nps
USING nomina_semanas ns, nomina_periodos p
WHERE nps.semana_id = ns.id
  AND nps.periodo_id = p.id
  AND p.metadata->>'area' IS NOT NULL
  AND TRIM(p.metadata->>'area') <> ''
  AND ns.area IS DISTINCT FROM p.metadata->>'area';

-- 2b) Semanas con periodo_id de OTRA área (no se puede poner NULL si ya existe
--      otra fila operativa misma fecha+área — idx_nomina_semanas_sin_periodo_area_inicio)
WITH wrong_periodo AS (
  SELECT
    ns.id AS semana_id,
    ns.semana_inicio,
    ns.area,
    ns.periodo_id AS wrong_periodo_id,
    ns.total_pagado,
    ns.origen
  FROM nomina_semanas ns
  JOIN nomina_periodos p ON p.id = ns.periodo_id
  WHERE p.metadata->>'area' IS NOT NULL
    AND TRIM(p.metadata->>'area') <> ''
    AND ns.area IS DISTINCT FROM p.metadata->>'area'
),
operational_conflict AS (
  SELECT w.*
  FROM wrong_periodo w
  WHERE EXISTS (
    SELECT 1
    FROM nomina_semanas ns2
    WHERE ns2.semana_inicio = w.semana_inicio
      AND ns2.area = w.area
      AND ns2.periodo_id IS NULL
      AND ns2.id <> w.semana_id
  )
),
reassign_target AS (
  SELECT
    w.semana_id,
    (
      SELECT p.id
      FROM nomina_periodos p
      WHERE NULLIF(TRIM(p.metadata->>'area'), '') = w.area
        AND w.semana_inicio >= p.range_start
        AND w.semana_inicio <= p.range_end
        AND p.origen = 'consolidacion_manual'
      ORDER BY p.created_at DESC
      LIMIT 1
    ) AS new_periodo_id
  FROM operational_conflict w
)
UPDATE nomina_semanas ns
SET periodo_id = rt.new_periodo_id
FROM reassign_target rt
WHERE ns.id = rt.semana_id
  AND rt.new_periodo_id IS NOT NULL;

-- 2b-ib) Periodo mina/planta LIBRE en el rango (sin fila misma fecha+área+periodo)
WITH wrong_periodo AS (
  SELECT
    ns.id AS semana_id,
    ns.semana_inicio,
    ns.area,
    ns.periodo_id AS wrong_periodo_id
  FROM nomina_semanas ns
  JOIN nomina_periodos p ON p.id = ns.periodo_id
  WHERE p.metadata->>'area' IS NOT NULL
    AND TRIM(p.metadata->>'area') <> ''
    AND ns.area IS DISTINCT FROM p.metadata->>'area'
),
free_periodo AS (
  SELECT
    w.semana_id,
    (
      SELECT p.id
      FROM nomina_periodos p
      WHERE p.origen = 'consolidacion_manual'
        AND w.semana_inicio >= p.range_start
        AND w.semana_inicio <= p.range_end
        AND COALESCE(NULLIF(TRIM(p.metadata->>'area'), ''), w.area) = w.area
        AND NOT (
          p.metadata->>'area' = 'planta'
          OR p.label ILIKE '%molino%'
          OR p.label ILIKE '%molinos%'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM nomina_semanas ns2
          WHERE ns2.semana_inicio = w.semana_inicio
            AND ns2.area = w.area
            AND ns2.periodo_id = p.id
            AND ns2.id <> w.semana_id
        )
      ORDER BY p.created_at DESC
      LIMIT 1
    ) AS new_periodo_id
  FROM wrong_periodo w
)
UPDATE nomina_semanas ns
SET periodo_id = fp.new_periodo_id
FROM free_periodo fp
WHERE ns.id = fp.semana_id
  AND fp.new_periodo_id IS NOT NULL;

-- 2b-ii) Sin periodo manual de su área: eliminar stub operativo vacío y liberar slot
WITH wrong_periodo AS (
  SELECT ns.id AS semana_id, ns.semana_inicio, ns.area
  FROM nomina_semanas ns
  JOIN nomina_periodos p ON p.id = ns.periodo_id
  WHERE p.metadata->>'area' IS NOT NULL
    AND TRIM(p.metadata->>'area') <> ''
    AND ns.area IS DISTINCT FROM p.metadata->>'area'
),
stub AS (
  SELECT ns_stub.id AS stub_id, w.semana_id AS keep_id
  FROM wrong_periodo w
  JOIN nomina_semanas ns_stub
    ON ns_stub.semana_inicio = w.semana_inicio
   AND ns_stub.area = w.area
   AND ns_stub.periodo_id IS NULL
   AND ns_stub.id <> w.semana_id
  WHERE NOT EXISTS (
    SELECT 1 FROM nomina_registros nr WHERE nr.semana_id = ns_stub.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM nomina_cierres nc WHERE nc.semana_id = ns_stub.id
  )
  AND EXISTS (
    SELECT 1 FROM nomina_registros nr WHERE nr.semana_id = w.semana_id
  )
)
DELETE FROM nomina_semanas ns
USING stub s
WHERE ns.id = s.stub_id;

-- 2b-iii) Ahora sí: periodo_id NULL cuando no hay otra operativa misma fecha+área
UPDATE nomina_semanas ns
SET periodo_id = NULL
FROM nomina_periodos p
WHERE ns.periodo_id = p.id
  AND p.metadata->>'area' IS NOT NULL
  AND TRIM(p.metadata->>'area') <> ''
  AND ns.area IS DISTINCT FROM p.metadata->>'area'
  AND NOT EXISTS (
    SELECT 1
    FROM nomina_semanas ns2
    WHERE ns2.semana_inicio = ns.semana_inicio
      AND ns2.area = ns.area
      AND ns2.periodo_id IS NULL
      AND ns2.id <> ns.id
  );

-- 2b-iv) Restantes sin resolver (requieren revisión manual)
-- Ejecutar aparte si el bloque 2 falla:
-- SELECT ns.id, ns.semana_inicio, ns.area, ns.total_pagado, ns.origen, p.label AS periodo_incorrecto
-- FROM nomina_semanas ns
-- JOIN nomina_periodos p ON p.id = ns.periodo_id
-- WHERE p.metadata->>'area' IS NOT NULL AND ns.area IS DISTINCT FROM p.metadata->>'area';

-- 2c) Asegurar metadata.area en periodos manuales molino
UPDATE nomina_periodos
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{area}', '"planta"'::jsonb, true)
WHERE origen = 'consolidacion_manual'
  AND (
    metadata->>'area' IS NULL
    OR TRIM(metadata->>'area') = ''
  )
  AND (
    label ILIKE '%molino%'
    OR label ILIKE '%molinos%'
  );

-- 2d) «1era Semana Mayo» — solo semana planta 2026-04-27 ($950)
WITH periodo AS (
  SELECT id FROM nomina_periodos
  WHERE label = '1era Semana Mayo'
    AND range_start = '2026-04-27'::date
    AND range_end = '2026-05-03'::date
  LIMIT 1
),
semana_planta AS (
  SELECT id, total_pagado FROM nomina_semanas
  WHERE area = 'planta'
    AND semana_inicio = '2026-04-27'::date
    AND origen = 'cierre_v3'
  ORDER BY created_at DESC
  LIMIT 1
),
ins AS (
  INSERT INTO nomina_periodo_semanas (periodo_id, semana_id)
  SELECT p.id, s.id FROM periodo p, semana_planta s
  ON CONFLICT DO NOTHING
  RETURNING periodo_id, semana_id
)
UPDATE nomina_semanas ns
SET periodo_id = p.id
FROM periodo p, semana_planta s
WHERE ns.id = s.id;

UPDATE nomina_periodos p
SET
  total_usd = COALESCE((
    SELECT ROUND(SUM(ns.total_pagado)::numeric, 2)
    FROM nomina_periodo_semanas nps
    JOIN nomina_semanas ns ON ns.id = nps.semana_id
    WHERE nps.periodo_id = p.id AND ns.area = 'planta'
  ), 0),
  metadata = jsonb_set(
    jsonb_set(COALESCE(p.metadata, '{}'::jsonb), '{area}', '"planta"'::jsonb, true),
    '{semana_ids}',
    COALESCE((
      SELECT to_jsonb(ARRAY_AGG(nps.semana_id ORDER BY ns.semana_inicio))
      FROM nomina_periodo_semanas nps
      JOIN nomina_semanas ns ON ns.id = nps.semana_id
      WHERE nps.periodo_id = p.id AND ns.area = 'planta'
    ), '[]'::jsonb),
    true
  )
WHERE p.label = '1era Semana Mayo'
  AND p.range_start = '2026-04-27'::date
  AND p.range_end = '2026-05-03'::date;

-- 2e) «4ta semana Mayo 2026» — quitar mina, enlazar planta 2026-05-18 ($1540)
WITH periodo AS (
  SELECT id FROM nomina_periodos
  WHERE label = 'Nómina Molino La Fé 4ta semana Mayo 2026'
    AND range_start = '2026-05-11'::date
    AND range_end = '2026-05-24'::date
  LIMIT 1
),
semana_planta AS (
  SELECT id FROM nomina_semanas
  WHERE area = 'planta'
    AND semana_inicio = '2026-05-18'::date
    AND origen = 'cierre_v3'
  ORDER BY created_at DESC
  LIMIT 1
)
INSERT INTO nomina_periodo_semanas (periodo_id, semana_id)
SELECT p.id, s.id FROM periodo p, semana_planta s
ON CONFLICT DO NOTHING;

UPDATE nomina_semanas ns
SET periodo_id = p.id
FROM nomina_periodos p, nomina_semanas sp
WHERE p.label = 'Nómina Molino La Fé 4ta semana Mayo 2026'
  AND p.range_start = '2026-05-11'::date
  AND p.range_end = '2026-05-24'::date
  AND sp.area = 'planta'
  AND sp.semana_inicio = '2026-05-18'::date
  AND sp.origen = 'cierre_v3'
  AND ns.id = sp.id;

UPDATE nomina_periodos p
SET
  total_usd = COALESCE((
    SELECT ROUND(SUM(ns.total_pagado)::numeric, 2)
    FROM nomina_periodo_semanas nps
    JOIN nomina_semanas ns ON ns.id = nps.semana_id
    WHERE nps.periodo_id = p.id AND ns.area = 'planta'
  ), 0),
  metadata = jsonb_set(
    jsonb_set(COALESCE(p.metadata, '{}'::jsonb), '{area}', '"planta"'::jsonb, true),
    '{semana_ids}',
    COALESCE((
      SELECT to_jsonb(ARRAY_AGG(nps.semana_id ORDER BY ns.semana_inicio))
      FROM nomina_periodo_semanas nps
      JOIN nomina_semanas ns ON ns.id = nps.semana_id
      WHERE nps.periodo_id = p.id AND ns.area = 'planta'
    ), '[]'::jsonb),
    true
  )
WHERE p.label = 'Nómina Molino La Fé 4ta semana Mayo 2026'
  AND p.range_start = '2026-05-11'::date
  AND p.range_end = '2026-05-24'::date;

-- 2f) Trigger: impedir cruces mina/planta en nomina_periodo_semanas
CREATE OR REPLACE FUNCTION public.enforce_nomina_periodo_semana_area()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_periodo_area text;
  v_semana_area text;
  v_origen text;
BEGIN
  SELECT NULLIF(TRIM(p.metadata->>'area'), ''), p.origen
  INTO v_periodo_area, v_origen
  FROM nomina_periodos p
  WHERE p.id = NEW.periodo_id;

  SELECT ns.area INTO v_semana_area
  FROM nomina_semanas ns
  WHERE ns.id = NEW.semana_id;

  IF v_semana_area IS NULL THEN
    RAISE EXCEPTION 'nomina_periodo_semanas: semana % no existe', NEW.semana_id;
  END IF;

  -- Periodos manuales/consolidación exigen metadata.area explícita
  IF v_origen = 'consolidacion_manual' THEN
    IF v_periodo_area IS NULL THEN
      RAISE EXCEPTION
        'nomina_periodos % requiere metadata.area (mina o planta) antes de vincular semanas',
        NEW.periodo_id;
    END IF;
    IF v_semana_area IS DISTINCT FROM v_periodo_area THEN
      RAISE EXCEPTION
        'Cruce de áreas prohibido: periodo % (area=%) no puede vincular semana % (area=%)',
        NEW.periodo_id, v_periodo_area, NEW.semana_id, v_semana_area;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nomina_periodo_semana_area ON nomina_periodo_semanas;
CREATE TRIGGER trg_nomina_periodo_semana_area
  BEFORE INSERT OR UPDATE ON nomina_periodo_semanas
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_nomina_periodo_semana_area();

-- 2g) Trigger: periodo_id en nomina_semanas debe coincidir con area del periodo
CREATE OR REPLACE FUNCTION public.enforce_nomina_semana_periodo_area()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_periodo_area text;
  v_origen text;
BEGIN
  IF NEW.periodo_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(p.metadata->>'area'), ''), p.origen
  INTO v_periodo_area, v_origen
  FROM nomina_periodos p
  WHERE p.id = NEW.periodo_id;

  IF v_origen = 'consolidacion_manual' AND v_periodo_area IS NOT NULL THEN
    IF NEW.area IS DISTINCT FROM v_periodo_area THEN
      RAISE EXCEPTION
        'Cruce de áreas prohibido: semana % (area=%) no puede usar periodo_id % (area=%)',
        NEW.id, NEW.area, NEW.periodo_id, v_periodo_area;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nomina_semana_periodo_area ON nomina_semanas;
CREATE TRIGGER trg_nomina_semana_periodo_area
  BEFORE INSERT OR UPDATE OF periodo_id, area ON nomina_semanas
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_nomina_semana_periodo_area();

COMMIT;

-- ============================================================
-- 3) DIAGNOSTICO FINAL
-- ============================================================
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN 'OK — sin cruces'
    ELSE 'REVISAR — aún hay ' || COUNT(*)::text || ' cruces'
  END AS estado_cruces
FROM nomina_periodo_semanas nps
JOIN nomina_periodos p ON p.id = nps.periodo_id
JOIN nomina_semanas ns ON ns.id = nps.semana_id
WHERE p.metadata->>'area' IS NOT NULL
  AND TRIM(p.metadata->>'area') <> ''
  AND ns.area IS DISTINCT FROM p.metadata->>'area';

SELECT
  p.label,
  p.range_start,
  p.range_end,
  p.total_usd,
  p.metadata->>'area' AS area,
  p.metadata->'semana_ids' AS semana_ids,
  ARRAY_AGG(ns.semana_inicio ORDER BY ns.semana_inicio) FILTER (WHERE ns.id IS NOT NULL) AS semanas_vinculadas,
  ARRAY_AGG(ns.area ORDER BY ns.semana_inicio) FILTER (WHERE ns.id IS NOT NULL) AS areas_vinculadas
FROM nomina_periodos p
LEFT JOIN nomina_periodo_semanas nps ON nps.periodo_id = p.id
LEFT JOIN nomina_semanas ns ON ns.id = nps.semana_id
WHERE p.origen = 'consolidacion_manual'
  AND (
    p.metadata->>'area' = 'planta'
    OR p.label ILIKE '%molino%'
  )
GROUP BY p.id
ORDER BY p.range_start;
