-- ============================================================
-- MineOS: Base maestra de trabajadores para Nómina
-- ============================================================

ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS estado_laboral VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS observacion_estado TEXT,
  ADD COLUMN IF NOT EXISTS estado_inicio_fecha DATE,
  ADD COLUMN IF NOT EXISTS estado_fin_fecha DATE,
  ADD COLUMN IF NOT EXISTS estado_duracion_dias INTEGER,
  ADD COLUMN IF NOT EXISTS despido_fecha DATE,
  ADD COLUMN IF NOT EXISTS despido_causa TEXT,
  ADD COLUMN IF NOT EXISTS reenganche_fecha DATE,
  ADD COLUMN IF NOT EXISTS reenganche_cargo TEXT,
  ADD COLUMN IF NOT EXISTS reenganche_observacion TEXT,
  ADD COLUMN IF NOT EXISTS ajuste_antiguedad_dias INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doc_cedula_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_carnet_url TEXT;

ALTER TABLE personal
  DROP CONSTRAINT IF EXISTS personal_estado_laboral_check;

ALTER TABLE personal
  ADD CONSTRAINT personal_estado_laboral_check
  CHECK (estado_laboral IN ('ACTIVO', 'DESPEDIDO', 'REPOSO', 'VACACIONES', 'REENGANCHADO'));

CREATE INDEX IF NOT EXISTS idx_personal_estado_laboral ON personal(estado_laboral);
CREATE INDEX IF NOT EXISTS idx_personal_nombre_completo ON personal(nombre_completo);
