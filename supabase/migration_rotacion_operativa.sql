-- Operación de plantillas de rotación: instancia multi-cuadrilla

ALTER TABLE rotacion_plantilla_cuadrillas
  ADD COLUMN IF NOT EXISTS desfase_inicial SMALLINT NOT NULL DEFAULT 0
    CHECK (desfase_inicial >= 0 AND desfase_inicial <= 12);

ALTER TABLE rotacion_plantilla_cuadrillas
  ADD COLUMN IF NOT EXISTS modo_repeticion TEXT NOT NULL DEFAULT 'continua'
    CHECK (modo_repeticion IN ('continua', 'pausa'));

COMMENT ON COLUMN rotacion_plantilla_cuadrillas.desfase_inicial IS
  'Columna inicial al arrancar instancia (ej. Vertical 2 desfasada 1 semana)';
COMMENT ON COLUMN rotacion_plantilla_cuadrillas.modo_repeticion IS
  'continua = reinicia ciclo; pausa = queda COMPLETADA al terminar vuelta';

-- Estado de cuadrilla dentro de una instancia en ejecución
CREATE TABLE IF NOT EXISTS rotacion_instancia_cuadrillas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instancia_id UUID NOT NULL REFERENCES rotacion_plantilla_instancias(id) ON DELETE CASCADE,
  cuadrilla_id UUID NOT NULL REFERENCES rotacion_plantilla_cuadrillas(id) ON DELETE RESTRICT,
  posicion_activa SMALLINT NOT NULL DEFAULT 0 CHECK (posicion_activa >= 0),
  estado TEXT NOT NULL DEFAULT 'ACTIVA'
    CHECK (estado IN ('ACTIVA', 'COMPLETADA', 'PAUSADA')),
  ciclos_completados INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instancia_id, cuadrilla_id)
);

ALTER TABLE rotacion_instancia_semanas
  ADD COLUMN IF NOT EXISTS cuadrilla_id UUID REFERENCES rotacion_plantilla_cuadrillas(id) ON DELETE RESTRICT;

ALTER TABLE rotacion_instancia_semanas
  ADD COLUMN IF NOT EXISTS instancia_cuadrilla_id UUID REFERENCES rotacion_instancia_cuadrillas(id) ON DELETE CASCADE;

-- Reemplazar unique global por unique por cuadrilla
ALTER TABLE rotacion_instancia_semanas
  DROP CONSTRAINT IF EXISTS rotacion_instancia_semanas_instancia_id_orden_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rotacion_instancia_semanas_instancia_cuadrilla_orden_key'
  ) THEN
    ALTER TABLE rotacion_instancia_semanas
      ADD CONSTRAINT rotacion_instancia_semanas_instancia_cuadrilla_orden_key
      UNIQUE (instancia_id, cuadrilla_id, orden);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rotacion_instancia_cuadrillas_instancia
  ON rotacion_instancia_cuadrillas(instancia_id);

CREATE INDEX IF NOT EXISTS idx_rotacion_instancia_semanas_cuadrilla
  ON rotacion_instancia_semanas(cuadrilla_id);

CREATE INDEX IF NOT EXISTS idx_rotacion_instancia_semanas_nomina
  ON rotacion_instancia_semanas(nomina_semana_id);

-- Una instancia ACTIVA por plantilla
CREATE UNIQUE INDEX IF NOT EXISTS idx_rotacion_instancia_activa_por_plantilla
  ON rotacion_plantilla_instancias(plantilla_id)
  WHERE estado = 'ACTIVA';

ALTER TABLE rotacion_instancia_cuadrillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_full_access_rotacion_instancia_cuadrillas ON rotacion_instancia_cuadrillas;
CREATE POLICY auth_full_access_rotacion_instancia_cuadrillas
  ON rotacion_instancia_cuadrillas FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE rotacion_instancia_cuadrillas IS
  'Posición de ciclo independiente por cuadrilla dentro de una instancia activa';
