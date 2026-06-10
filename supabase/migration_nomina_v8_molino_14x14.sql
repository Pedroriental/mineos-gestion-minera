-- ============================================================================
-- MineOS V8: Esquema MOLINO_14X14 en perfiles y personal
-- ============================================================================

ALTER TABLE perfiles_compensacion
  DROP CONSTRAINT IF EXISTS perfiles_compensacion_esquema_rotacion_default_check;

ALTER TABLE perfiles_compensacion
  ADD CONSTRAINT perfiles_compensacion_esquema_rotacion_default_check
  CHECK (esquema_rotacion_default IN (
    'FIJO_SEMANAL',
    'MINA_2X1',
    'MOLINO_FIJO',
    'MOLINO_ROTATIVO',
    'MINA_ROTATIVA_3G',
    'MOLINO_15X15',
    'MOLINO_14X14'
  ));

ALTER TABLE personal
  DROP CONSTRAINT IF EXISTS personal_esquema_rotacion_check;

ALTER TABLE personal
  ADD CONSTRAINT personal_esquema_rotacion_check
  CHECK (esquema_rotacion IN (
    'FIJO_SEMANAL',
    'MINA_2X1',
    'MOLINO_FIJO',
    'MOLINO_ROTATIVO',
    'MINA_ROTATIVA_3G',
    'MOLINO_15X15',
    'MOLINO_14X14'
  ));
