-- Novedades de turno por semana (no alteran estado_laboral del maestro de personal)
ALTER TABLE nomina_registros
  ADD COLUMN IF NOT EXISTS novedad_turno text NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS novedad_turno_obs text NOT NULL DEFAULT '';

COMMENT ON COLUMN nomina_registros.novedad_turno IS 'Novedad del turno/semana: ACTIVO, REPOSO, VACACIONES, AUSENCIA, OTRO';
COMMENT ON COLUMN nomina_registros.novedad_turno_obs IS 'Detalle opcional de la novedad de turno';
