-- Acarreo de material hacia molinos (reemplaza uso operativo de recepcion_material)

CREATE TABLE IF NOT EXISTS reportes_acarreo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  turno VARCHAR(20) NOT NULL CHECK (turno IN ('dia', 'noche', 'completo')),
  mina VARCHAR(150) NOT NULL,
  molino VARCHAR(150) NOT NULL,
  lineas JSONB NOT NULL DEFAULT '[]'::jsonb,
  carga_total INTEGER NOT NULL CHECK (carga_total > 0),
  sacos_libres INTEGER NOT NULL CHECK (sacos_libres >= 0),
  observaciones TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reportes_acarreo_fecha ON reportes_acarreo(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_acarreo_registrado_por ON reportes_acarreo(registrado_por);

ALTER TABLE reportes_acarreo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_full_access ON reportes_acarreo;
CREATE POLICY auth_full_access ON reportes_acarreo
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS set_updated_at ON reportes_acarreo;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON reportes_acarreo
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
