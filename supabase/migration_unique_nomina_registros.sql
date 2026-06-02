
-- =============================================================
-- MineOS - Migration: UNIQUE constraint en nomina_registros
--
-- Evita que un mismo trabajador aparezca duplicado en la misma
-- semana de nómina, lo que causaría pagos duplicados.
--
-- NOTA: Si ya existen duplicados, esta migración fallará.
-- Para detectarlos antes de ejecutar:
--
--   SELECT semana_id, personal_id, COUNT(*)
--   FROM nomina_registros
--   GROUP BY semana_id, personal_id
--   HAVING COUNT(*) > 1;
--
-- Si hay duplicados, eliminar los sobrantes primero:
--
--   DELETE FROM nomina_registros
--   WHERE id IN (
--     SELECT id FROM (
--       SELECT id, ROW_NUMBER() OVER (
--         PARTITION BY semana_id, personal_id ORDER BY created_at DESC
--       ) AS rn
--       FROM nomina_registros
--     ) t WHERE t.rn > 1
--   );
-- =============================================================

-- Índice único: un registro por trabajador por semana
CREATE UNIQUE INDEX IF NOT EXISTS idx_nomina_registros_semana_personal
  ON nomina_registros(semana_id, personal_id);

-- Índice compuesto para queries de JOIN + filtro (semana_id, personal_id)
DROP INDEX IF EXISTS idx_nomina_registros_semana;
CREATE INDEX IF NOT EXISTS idx_nomina_registros_semana ON nomina_registros(semana_id);
CREATE INDEX IF NOT EXISTS idx_nomina_registros_personal ON nomina_registros(personal_id);
