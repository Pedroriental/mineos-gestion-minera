-- ============================================================
-- MineOS - Cuadrilla opcional en personal
-- Etiqueta libre (A, B, C, Mañana, Noche, etc.) usada para
-- agrupar trabajadores en listados descargables.
-- No afecta RLS, cálculo de nómina ni plantillas de rotación.
-- ============================================================

ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS cuadrilla VARCHAR(40);

COMMENT ON COLUMN personal.cuadrilla IS
  'Etiqueta libre (A, B, C, Mañana, Noche, etc.) usada para agrupar en listados descargables. No afecta RLS ni cálculo de nómina.';

-- Backfill best-effort: si hay plantilla activa y un trabajador aparece en una
-- cuadrilla, copiar el nombre de la cuadrilla. Solo escribe si cuadrilla es NULL.
DO $$
DECLARE
  r RECORD;
  ctx_nombre TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM personal WHERE cuadrilla IS NULL LIMIT 1) THEN
    RETURN;
  END IF;

  FOR r IN SELECT id, area, area_detalle FROM personal WHERE cuadrilla IS NULL LOOP
    -- Busca la primera cuadrilla activa en una instancia que aplique al area del
    -- trabajador. Estrategia simple: nombre de la primera cuadrilla encontrada.
    SELECT rpc.nombre
    INTO ctx_nombre
    FROM rotacion_instancia_cuadrillas ic
    JOIN rotacion_plantilla_cuadrillas rpc ON rpc.id = ic.cuadrilla_id
    JOIN rotacion_plantillas plantilla ON plantilla.id = rpc.plantilla_id
    WHERE ic.estado = 'ACTIVA'
      AND (
        (r.area = 'mina' AND plantilla.area = 'mina')
        OR (r.area = 'planta' AND plantilla.area = 'planta')
        OR (r.area = 'administracion' AND plantilla.area = 'administracion')
      )
    LIMIT 1;

    IF ctx_nombre IS NOT NULL THEN
      UPDATE personal SET cuadrilla = ctx_nombre WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Índice para acelerar filtros por cuadrilla + area
CREATE INDEX IF NOT EXISTS idx_personal_area_cuadrilla
  ON personal(area, cuadrilla)
  WHERE cuadrilla IS NOT NULL;
