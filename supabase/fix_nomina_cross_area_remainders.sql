-- ============================================================
-- MineOS: Remanentes cruce mina → periodo planta (2 filas)
-- ============================================================
-- Reglas de unicidad en nomina_semanas:
--   • periodo_id NULL  → una sola fila por (semana_inicio, area)
--   • periodo_id NOT NULL → una sola fila por (semana_inicio, area, periodo_id)
--
-- NO se puede copiar periodo_id de una hermana si esa combinación ya existe.
-- Estrategia:
--   1) Quitar links puente cruzados
--   2) Borrar stubs operativos VACÍOS (misma fecha+área, periodo_id NULL)
--   3) Desvincular periodo planta → periodo_id NULL
--   4) Si aún hay conflicto: asignar periodo MINA libre (sin fila esa fecha)
--   5) Backfill metadata.area en periodos mina legacy
--
-- Ejecutar completo. Si falló antes: ROLLBACK; y volver a pegar.
-- ============================================================

BEGIN;

-- 0) Links puente cruzados
DELETE FROM nomina_periodo_semanas nps
USING nomina_semanas ns, nomina_periodos p
WHERE nps.semana_id = ns.id
  AND nps.periodo_id = p.id
  AND p.metadata->>'area' IS NOT NULL
  AND TRIM(p.metadata->>'area') <> ''
  AND ns.area IS DISTINCT FROM p.metadata->>'area';

-- 1) Stubs operativos vacíos (liberan slot periodo_id NULL)
WITH wrong AS (
  SELECT ns.id AS semana_id, ns.semana_inicio, ns.area
  FROM nomina_semanas ns
  JOIN nomina_periodos p ON p.id = ns.periodo_id
  WHERE p.metadata->>'area' IS NOT NULL
    AND TRIM(p.metadata->>'area') <> ''
    AND ns.area IS DISTINCT FROM p.metadata->>'area'
)
DELETE FROM nomina_semanas ns
USING wrong w, nomina_semanas ns_stub
WHERE ns.id = ns_stub.id
  AND ns_stub.semana_inicio = w.semana_inicio
  AND ns_stub.area = w.area
  AND ns_stub.periodo_id IS NULL
  AND ns_stub.id <> w.semana_id
  AND NOT EXISTS (SELECT 1 FROM nomina_registros nr WHERE nr.semana_id = ns_stub.id)
  AND NOT EXISTS (SELECT 1 FROM nomina_cierres nc WHERE nc.semana_id = ns_stub.id);

-- 1b) Si el duplicado operativo tiene datos pero la fila mal vinculada NO tiene registros,
--     eliminar la fila fantasma (solo enlace incorrecto a periodo planta)
WITH wrong AS (
  SELECT ns.id AS semana_id, ns.semana_inicio, ns.area
  FROM nomina_semanas ns
  JOIN nomina_periodos p ON p.id = ns.periodo_id
  WHERE p.metadata->>'area' IS NOT NULL
    AND TRIM(p.metadata->>'area') <> ''
    AND ns.area IS DISTINCT FROM p.metadata->>'area'
)
DELETE FROM nomina_semanas ns
USING wrong w
WHERE ns.id = w.semana_id
  AND NOT EXISTS (SELECT 1 FROM nomina_registros nr WHERE nr.semana_id = ns.id)
  AND NOT EXISTS (SELECT 1 FROM nomina_cierres nc WHERE nc.semana_id = ns.id)
  AND EXISTS (
    SELECT 1
    FROM nomina_semanas ns_other
    WHERE ns_other.semana_inicio = w.semana_inicio
      AND ns_other.area = w.area
      AND ns_other.id <> w.semana_id
      AND (
        EXISTS (SELECT 1 FROM nomina_registros nr WHERE nr.semana_id = ns_other.id)
        OR ns_other.periodo_id IS NULL
      )
  );

-- 2) Desvincular periodo planta → operativo (periodo_id NULL)
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

-- 3) Si sigue mal vinculada y no cabe NULL: periodo mina LIBRE (sin fila esa fecha)
WITH wrong AS (
  SELECT ns.id AS semana_id, ns.semana_inicio, ns.area
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
        AND NOT (p.metadata->>'area' = 'planta' OR p.label ILIKE '%molino%' OR p.label ILIKE '%molinos%')
        AND COALESCE(NULLIF(TRIM(p.metadata->>'area'), ''), w.area) = w.area
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
  FROM wrong w
)
UPDATE nomina_semanas ns
SET periodo_id = fp.new_periodo_id
FROM free_periodo fp
WHERE ns.id = fp.semana_id
  AND fp.new_periodo_id IS NOT NULL;

-- 4) metadata.area en periodos mina legacy
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

COMMIT;

-- Debe devolver 0 filas
SELECT ns.id, ns.semana_inicio, ns.area, ns.total_pagado, ns.periodo_id, p.label AS periodo_label, p.metadata->>'area' AS periodo_area
FROM nomina_semanas ns
JOIN nomina_periodos p ON p.id = ns.periodo_id
WHERE p.metadata->>'area' IS NOT NULL
  AND TRIM(p.metadata->>'area') <> ''
  AND ns.area IS DISTINCT FROM p.metadata->>'area';

-- Estado esperado de las 2 filas (periodo_id NULL o periodo mina, nunca planta):
SELECT id, semana_inicio, area, total_pagado, origen, periodo_id
FROM nomina_semanas
WHERE id IN (
  '13db9c6c-cce0-462e-929b-eb929560e98e',
  '7adb1351-f58c-4747-965f-2de2b603bc31'
);
