-- ============================================================
-- MineOS: FIX DEFINITIVO — aislamiento mina ↔ planta (nómina)
-- ============================================================
-- Ejecutar UNA VEZ en Supabase SQL Editor (todo el archivo).
-- Si una corrida anterior falló a medias: ROLLBACK; y volver a pegar.
--
-- Caso confirmado en BD:
--   7adb1351… mina $485 → periodo PLANTA (incorrecto, duplicado)
--   179f2baf… mina $485 → periodo_id NULL (correcto, conservar)
--   Ambas con 9 registros — fusionar solo personal_id faltante y borrar duplicado.
--
-- NO usa UPDATE periodo_id = NULL cuando ya hay fila operativa (evita el bucle).
-- ============================================================

BEGIN;

-- ── 1) Links puente cruzados ─────────────────────────────────
DELETE FROM nomina_periodo_semanas nps
USING nomina_semanas ns, nomina_periodos p
WHERE nps.semana_id = ns.id
  AND nps.periodo_id = p.id
  AND p.metadata->>'area' IS NOT NULL
  AND TRIM(p.metadata->>'area') <> ''
  AND ns.area IS DISTINCT FROM p.metadata->>'area';

-- ── 2) mina 2026-04-27 $1075 ligada a periodo planta «1era Semana Mayo» ─
--    Conservar semana 13db9c6c…; crear periodo mina propio (no NULL: ya hay operativa $680)
DO $$
DECLARE
  v_wrong_semana uuid := '13db9c6c-cce0-462e-929b-eb929560e90e';
  v_planta_periodo uuid := '32ef1dbf-54a7-40ba-b716-9675b71cc278';
  v_mina_periodo uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM nomina_semanas ns
    JOIN nomina_periodos p ON p.id = ns.periodo_id
    WHERE ns.id = v_wrong_semana
      AND p.metadata->>'area' = 'planta'
  ) THEN
    SELECT id INTO v_mina_periodo
    FROM nomina_periodos
    WHERE range_start = '2026-04-27'::date
      AND range_end = '2026-05-03'::date
      AND origen = 'consolidacion_manual'
      AND metadata->>'area' = 'mina'
      AND metadata->>'source' = 'migrated_cross_fix'
    LIMIT 1;

    IF v_mina_periodo IS NULL THEN
      INSERT INTO nomina_periodos (label, range_start, range_end, total_usd, origen, metadata)
      VALUES (
        '1era Semana Mayo (Mina)',
        '2026-04-27',
        '2026-05-03',
        1075,
        'consolidacion_manual',
        jsonb_build_object(
          'area', 'mina',
          'source', 'migrated_cross_fix',
          'migrated_from_periodo_id', v_planta_periodo::text,
          'semana_ids', jsonb_build_array(v_wrong_semana::text)
        )
      )
      RETURNING id INTO v_mina_periodo;
    END IF;

    DELETE FROM nomina_periodo_semanas WHERE semana_id = v_wrong_semana;

    UPDATE nomina_semanas SET periodo_id = v_mina_periodo WHERE id = v_wrong_semana;

    INSERT INTO nomina_periodo_semanas (periodo_id, semana_id)
    VALUES (v_mina_periodo, v_wrong_semana)
    ON CONFLICT DO NOTHING;

    DELETE FROM nomina_periodo_semanas nps
    USING nomina_semanas ns
    WHERE nps.periodo_id = v_planta_periodo
      AND nps.semana_id = ns.id
      AND ns.area = 'mina';

    UPDATE nomina_periodos p
    SET
      total_usd = COALESCE((
        SELECT ROUND(SUM(ns.total_pagado)::numeric, 2)
        FROM nomina_periodo_semanas nps
        JOIN nomina_semanas ns ON ns.id = nps.semana_id
        WHERE nps.periodo_id = v_planta_periodo AND ns.area = 'planta'
      ), 0),
      metadata = jsonb_set(
        jsonb_set(COALESCE(p.metadata, '{}'::jsonb), '{area}', '"planta"'::jsonb, true),
        '{semana_ids}',
        COALESCE((
          SELECT to_jsonb(ARRAY_AGG(nps.semana_id ORDER BY ns.semana_inicio))
          FROM nomina_periodo_semanas nps
          JOIN nomina_semanas ns ON ns.id = nps.semana_id
          WHERE nps.periodo_id = v_planta_periodo AND ns.area = 'planta'
        ), '[]'::jsonb),
        true
      )
    WHERE p.id = v_planta_periodo;
  END IF;
END $$;

-- ── 3) Duplicado mina 2026-05-11 $485 ligado a periodo planta ─
--    Conservar: 179f2baf-792f-4449-bc7f-ae5720858978 (operativa)
--    Eliminar:  7adb1351-f58c-4747-965f-2de2b603bc31 (cruce planta)

DELETE FROM nomina_periodo_semanas
WHERE semana_id = '7adb1351-f58c-4747-965f-2de2b603bc31';

UPDATE nomina_registros nr
SET semana_id = '179f2baf-792f-4449-bc7f-ae5720858978'
WHERE nr.semana_id = '7adb1351-f58c-4747-965f-2de2b603bc31'
  AND NOT EXISTS (
    SELECT 1
    FROM nomina_registros existing
    WHERE existing.semana_id = '179f2baf-792f-4449-bc7f-ae5720858978'
      AND existing.personal_id = nr.personal_id
  );

DELETE FROM nomina_registros
WHERE semana_id = '7adb1351-f58c-4747-965f-2de2b603bc31';

DELETE FROM nomina_cierres
WHERE semana_id = '7adb1351-f58c-4747-965f-2de2b603bc31';

DELETE FROM nomina_semanas
WHERE id = '7adb1351-f58c-4747-965f-2de2b603bc31';

UPDATE nomina_semanas ns
SET
  total_pagado = COALESCE(sub.sum_pagado, 0),
  total_trabajadores = COALESCE(sub.cnt, 0)
FROM (
  SELECT
    COUNT(*)::int AS cnt,
    ROUND(COALESCE(SUM(monto_pagado), 0)::numeric, 2) AS sum_pagado
  FROM nomina_registros
  WHERE semana_id = '179f2baf-792f-4449-bc7f-ae5720858978'
) sub
WHERE ns.id = '179f2baf-792f-4449-bc7f-ae5720858978';

-- ── 3) Cualquier otro cruce periodo_id (sin poner NULL si hay duplicado operativo)
WITH wrong AS (
  SELECT ns.id AS semana_id, ns.semana_inicio, ns.area
  FROM nomina_semanas ns
  JOIN nomina_periodos p ON p.id = ns.periodo_id
  WHERE p.metadata->>'area' IS NOT NULL
    AND TRIM(p.metadata->>'area') <> ''
    AND ns.area IS DISTINCT FROM p.metadata->>'area'
),
empty_wrong AS (
  SELECT w.semana_id
  FROM wrong w
  WHERE NOT EXISTS (SELECT 1 FROM nomina_registros nr WHERE nr.semana_id = w.semana_id)
    AND NOT EXISTS (SELECT 1 FROM nomina_cierres nc WHERE nc.semana_id = w.semana_id)
)
DELETE FROM nomina_semanas ns
USING empty_wrong e
WHERE ns.id = e.semana_id;

WITH wrong AS (
  SELECT ns.id AS semana_id, ns.semana_inicio, ns.area
  FROM nomina_semanas ns
  JOIN nomina_periodos p ON p.id = ns.periodo_id
  WHERE p.metadata->>'area' IS NOT NULL
    AND TRIM(p.metadata->>'area') <> ''
    AND ns.area IS DISTINCT FROM p.metadata->>'area'
)
UPDATE nomina_semanas ns
SET periodo_id = NULL
FROM wrong w
WHERE ns.id = w.semana_id
  AND NOT EXISTS (
    SELECT 1
    FROM nomina_semanas ns2
    WHERE ns2.semana_inicio = w.semana_inicio
      AND ns2.area = w.area
      AND ns2.periodo_id IS NULL
      AND ns2.id <> w.semana_id
  );

-- ── 4) Periodos molino: solo semanas PLANTA ─────────────────
UPDATE nomina_periodos p
SET
  total_usd = COALESCE(agg.sum_pagado, 0),
  metadata = jsonb_set(
    jsonb_set(COALESCE(p.metadata, '{}'::jsonb), '{area}', '"planta"'::jsonb, true),
    '{semana_ids}',
    COALESCE(to_jsonb(agg.semana_ids), '[]'::jsonb),
    true
  )
FROM (
  SELECT
    nps.periodo_id,
    ROUND(SUM(ns.total_pagado)::numeric, 2) AS sum_pagado,
    ARRAY_AGG(nps.semana_id ORDER BY ns.semana_inicio) AS semana_ids
  FROM nomina_periodo_semanas nps
  JOIN nomina_semanas ns ON ns.id = nps.semana_id
  JOIN nomina_periodos p0 ON p0.id = nps.periodo_id
  WHERE ns.area = 'planta'
    AND (
      p0.metadata->>'area' = 'planta'
      OR p0.label ILIKE '%molino%'
    )
  GROUP BY nps.periodo_id
) agg
WHERE p.id = agg.periodo_id;

DELETE FROM nomina_periodo_semanas nps
USING nomina_semanas ns, nomina_periodos p
WHERE nps.semana_id = ns.id
  AND nps.periodo_id = p.id
  AND ns.area = 'mina'
  AND (
    p.metadata->>'area' = 'planta'
    OR p.label ILIKE '%molino%'
  );

-- ── 4b) Periodos sin semanas enlazadas → total_usd = 0 ───────
UPDATE nomina_periodos p
SET total_usd = 0,
    metadata = jsonb_set(
      COALESCE(p.metadata, '{}'::jsonb),
      '{semana_ids}',
      '[]'::jsonb,
      true
    )
WHERE p.origen = 'consolidacion_manual'
  AND p.total_usd <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM nomina_periodo_semanas nps
    JOIN nomina_semanas ns ON ns.id = nps.semana_id
    WHERE nps.periodo_id = p.id
      AND (
        p.metadata->>'area' IS NULL
        OR TRIM(p.metadata->>'area') = ''
        OR ns.area = p.metadata->>'area'
      )
  );

-- ── 5) metadata.area en periodos legacy ─────────────────────
UPDATE nomina_periodos p
SET metadata = jsonb_set(COALESCE(p.metadata, '{}'::jsonb), '{area}', '"mina"'::jsonb, true)
WHERE p.origen = 'consolidacion_manual'
  AND (p.metadata->>'area' IS NULL OR TRIM(p.metadata->>'area') = '')
  AND NOT (p.label ILIKE '%molino%' OR p.label ILIKE '%molinos%')
  AND EXISTS (
    SELECT 1 FROM nomina_periodo_semanas nps
    JOIN nomina_semanas ns ON ns.id = nps.semana_id
    WHERE nps.periodo_id = p.id AND ns.area = 'mina'
  )
  AND NOT EXISTS (
    SELECT 1 FROM nomina_periodo_semanas nps
    JOIN nomina_semanas ns ON ns.id = nps.semana_id
    WHERE nps.periodo_id = p.id AND ns.area = 'planta'
  );

UPDATE nomina_periodos p
SET metadata = jsonb_set(COALESCE(p.metadata, '{}'::jsonb), '{area}', '"planta"'::jsonb, true)
WHERE p.origen = 'consolidacion_manual'
  AND (p.metadata->>'area' IS NULL OR TRIM(p.metadata->>'area') = '')
  AND (p.label ILIKE '%molino%' OR p.label ILIKE '%molinos%');

-- ── 6) Triggers anti-cruce (idempotente) ─────────────────────
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
  FROM nomina_periodos p WHERE p.id = NEW.periodo_id;

  SELECT ns.area INTO v_semana_area
  FROM nomina_semanas ns WHERE ns.id = NEW.semana_id;

  IF v_origen = 'consolidacion_manual' THEN
    IF v_periodo_area IS NULL THEN
      RAISE EXCEPTION 'nomina_periodos % requiere metadata.area (mina o planta)', NEW.periodo_id;
    END IF;
    IF v_semana_area IS DISTINCT FROM v_periodo_area THEN
      RAISE EXCEPTION 'Cruce prohibido: periodo % (area=%) ↔ semana % (area=%)',
        NEW.periodo_id, v_periodo_area, NEW.semana_id, v_semana_area;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nomina_periodo_semana_area ON nomina_periodo_semanas;
CREATE TRIGGER trg_nomina_periodo_semana_area
  BEFORE INSERT OR UPDATE ON nomina_periodo_semanas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_nomina_periodo_semana_area();

CREATE OR REPLACE FUNCTION public.enforce_nomina_semana_periodo_area()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_periodo_area text;
  v_origen text;
BEGIN
  IF NEW.periodo_id IS NULL THEN RETURN NEW; END IF;

  SELECT NULLIF(TRIM(p.metadata->>'area'), ''), p.origen
  INTO v_periodo_area, v_origen
  FROM nomina_periodos p WHERE p.id = NEW.periodo_id;

  IF v_origen = 'consolidacion_manual' AND v_periodo_area IS NOT NULL
     AND NEW.area IS DISTINCT FROM v_periodo_area THEN
    RAISE EXCEPTION 'Cruce prohibido: semana % (area=%) ↔ periodo_id % (area=%)',
      NEW.id, NEW.area, NEW.periodo_id, v_periodo_area;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nomina_semana_periodo_area ON nomina_semanas;
CREATE TRIGGER trg_nomina_semana_periodo_area
  BEFORE INSERT OR UPDATE OF periodo_id, area ON nomina_semanas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_nomina_semana_periodo_area();

COMMIT;

-- ── VERIFICACION (debe ser 0 filas) ─────────────────────────
SELECT 'cruces' AS check, COUNT(*)::text AS valor
FROM nomina_semanas ns
JOIN nomina_periodos p ON p.id = ns.periodo_id
WHERE p.metadata->>'area' IS NOT NULL
  AND TRIM(p.metadata->>'area') <> ''
  AND ns.area IS DISTINCT FROM p.metadata->>'area'

UNION ALL

SELECT 'duplicado_7adb1351', COUNT(*)::text
FROM nomina_semanas WHERE id = '7adb1351-f58c-4747-965f-2de2b603bc31'

UNION ALL

SELECT 'canonical_179f2baf', id::text
FROM nomina_semanas WHERE id = '179f2baf-792f-4449-bc7f-ae5720858978';
