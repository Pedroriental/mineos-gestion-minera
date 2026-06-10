-- Permite informes operativos incompletos (borrador) en acarreo.
-- carga_total puede ser 0 mientras llegan los datos del turno.

ALTER TABLE reportes_acarreo
  DROP CONSTRAINT IF EXISTS reportes_acarreo_carga_total_check;

ALTER TABLE reportes_acarreo
  ADD CONSTRAINT reportes_acarreo_carga_total_check CHECK (carga_total >= 0);

ALTER TABLE venta_arenas
  DROP CONSTRAINT IF EXISTS venta_arenas_cantidad_kg_check;

ALTER TABLE venta_arenas
  ADD CONSTRAINT venta_arenas_cantidad_kg_check CHECK (cantidad_kg >= 0);
