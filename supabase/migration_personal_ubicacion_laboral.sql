-- Sitio / ubicación operativa del trabajador (Mina Belén, otra mina, Molino La Fé, etc.)
ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS ubicacion_laboral VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_personal_ubicacion_laboral ON personal(ubicacion_laboral);
