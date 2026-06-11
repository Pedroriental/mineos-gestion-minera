-- Columnas configurables de la vista previa / planilla (nombre, cédula, etc.)

ALTER TABLE rotacion_plantillas
  ADD COLUMN IF NOT EXISTS columnas_vista JSONB NOT NULL DEFAULT '["nombre","cedula","fecha_ingreso","subtotal_semanal","total_periodo"]'::jsonb;

COMMENT ON COLUMN rotacion_plantillas.columnas_vista IS
  'Claves de columnas de datos visibles en vista previa y carga (checkboxes del sandbox)';
