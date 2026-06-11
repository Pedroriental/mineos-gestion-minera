-- Cuadrillas / secciones dentro de plantillas de rotación
-- (Vertical 1, Cocina, Administración, Técnicos, etc.)

CREATE TABLE IF NOT EXISTS rotacion_plantilla_cuadrillas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plantilla_id UUID NOT NULL REFERENCES rotacion_plantillas(id) ON DELETE CASCADE,
  nombre VARCHAR(80) NOT NULL,
  asignacion_key TEXT,
  orden SMALLINT NOT NULL DEFAULT 0 CHECK (orden >= 0 AND orden <= 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plantilla_id, orden)
);

ALTER TABLE rotacion_plantilla_semanas
  ADD COLUMN IF NOT EXISTS cuadrilla_id UUID REFERENCES rotacion_plantilla_cuadrillas(id) ON DELETE CASCADE;

ALTER TABLE rotacion_plantilla_asignaciones
  ADD COLUMN IF NOT EXISTS cuadrilla_id UUID REFERENCES rotacion_plantilla_cuadrillas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_rotacion_cuadrillas_plantilla
  ON rotacion_plantilla_cuadrillas(plantilla_id);

CREATE INDEX IF NOT EXISTS idx_rotacion_semanas_cuadrilla
  ON rotacion_plantilla_semanas(cuadrilla_id);

-- Backfill: plantillas existentes sin cuadrilla → sección "General"
DO $$
DECLARE
  rec RECORD;
  cid UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT p.id AS plantilla_id
    FROM rotacion_plantillas p
    WHERE NOT EXISTS (
      SELECT 1 FROM rotacion_plantilla_cuadrillas c WHERE c.plantilla_id = p.id
    )
  LOOP
    cid := uuid_generate_v4();
    INSERT INTO rotacion_plantilla_cuadrillas (id, plantilla_id, nombre, asignacion_key, orden)
    VALUES (cid, rec.plantilla_id, 'General', NULL, 0);

    UPDATE rotacion_plantilla_semanas
    SET cuadrilla_id = cid
    WHERE plantilla_id = rec.plantilla_id AND cuadrilla_id IS NULL;

    UPDATE rotacion_plantilla_asignaciones a
    SET cuadrilla_id = cid
    FROM rotacion_plantilla_semanas s
    WHERE a.semana_id = s.id
      AND a.plantilla_id = rec.plantilla_id
      AND a.cuadrilla_id IS NULL
      AND s.cuadrilla_id = cid;
  END LOOP;
END $$;

ALTER TABLE rotacion_plantilla_cuadrillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_full_access_rotacion_plantilla_cuadrillas ON rotacion_plantilla_cuadrillas;
CREATE POLICY auth_full_access_rotacion_plantilla_cuadrillas
  ON rotacion_plantilla_cuadrillas FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE rotacion_plantilla_cuadrillas IS 'Secciones/cuadrillas dentro de una plantilla (verticales, cocina, admin, técnicos)';
COMMENT ON COLUMN rotacion_plantilla_cuadrillas.asignacion_key IS 'Valor biblioteca asignacion_nomina para sugerir personal';
