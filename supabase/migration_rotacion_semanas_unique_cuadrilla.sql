-- Corrige UNIQUE (plantilla_id, orden): con varias cuadrillas cada una tiene orden 0,1,2…
-- La unicidad debe ser por cuadrilla, no por plantilla.

ALTER TABLE rotacion_plantilla_semanas
  DROP CONSTRAINT IF EXISTS rotacion_plantilla_semanas_plantilla_id_orden_key;

CREATE UNIQUE INDEX IF NOT EXISTS rotacion_plantilla_semanas_cuadrilla_orden_key
  ON rotacion_plantilla_semanas (cuadrilla_id, orden)
  WHERE cuadrilla_id IS NOT NULL;

COMMENT ON INDEX rotacion_plantilla_semanas_cuadrilla_orden_key IS
  'Una cuadrilla no puede tener dos semanas con el mismo orden';
