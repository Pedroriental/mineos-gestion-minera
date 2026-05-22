-- Líneas de plancha configurables (dashboard + agrupación de molinos)
-- Ejecutar en Supabase SQL Editor si la tabla no existe aún.

CREATE TABLE IF NOT EXISTS lineas_plancha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  molinos TEXT[] NOT NULL DEFAULT '{}',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lineas_plancha_numero_unique UNIQUE (numero)
);

CREATE INDEX IF NOT EXISTS idx_lineas_plancha_activo_orden ON lineas_plancha (activo, orden);

ALTER TABLE lineas_plancha ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_access_lineas_plancha" ON lineas_plancha;
CREATE POLICY "auth_full_access_lineas_plancha" ON lineas_plancha
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS set_updated_at_lineas_plancha ON lineas_plancha;
CREATE TRIGGER set_updated_at_lineas_plancha
  BEFORE UPDATE ON lineas_plancha
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Semilla inicial (solo si la tabla está vacía)
INSERT INTO lineas_plancha (numero, nombre, molinos, orden)
SELECT 1, 'Balance plancha 1', ARRAY[
  'Molino 1', 'Molino 2', 'Molino 3', 'Molino 1-2', 'Molino 1-3', 'Molino 2-3', 'Molino 1-2-3'
], 1
WHERE NOT EXISTS (SELECT 1 FROM lineas_plancha);

INSERT INTO lineas_plancha (numero, nombre, molinos, orden)
SELECT 2, 'Balance plancha 2', ARRAY['Molino Continuo'], 2
WHERE (SELECT COUNT(*) FROM lineas_plancha) < 2;

INSERT INTO lineas_plancha (numero, nombre, molinos, orden)
SELECT 3, 'Balance plancha 3', ARRAY['Molino Coco'], 3
WHERE (SELECT COUNT(*) FROM lineas_plancha) < 3;
