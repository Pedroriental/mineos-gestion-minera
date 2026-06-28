-- ============================================================
-- MineOS: ampliar cap de dias_trabajados en nomina_registros
-- ============================================================
-- Hasta ahora dias_trabajados estaba limitado a 0-7 (una semana).
-- Con el feature de "dias extra" (semana + extra = hasta 14), el cap
-- del constraint debe coincidir con MAX_DIAS_TRABAJADOS (14) en TS.
-- Tambien se actualiza el comentario de la columna.
-- ============================================================

ALTER TABLE nomina_registros
  DROP CONSTRAINT IF EXISTS nomina_registros_dias_trabajados_check;

ALTER TABLE nomina_registros
  ADD CONSTRAINT nomina_registros_dias_trabajados_check
  CHECK (dias_trabajados IS NULL OR (dias_trabajados >= 0 AND dias_trabajados <= 14));

COMMENT ON COLUMN nomina_registros.dias_trabajados IS
  'Días laborados en la semana (0-14), base del cálculo proporcional. Incluye semana normal (7) + extras.';
