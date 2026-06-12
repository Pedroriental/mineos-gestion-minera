-- Columnas visibles por cuadrilla (bono transporte, cargo, etc.)

ALTER TABLE rotacion_plantilla_cuadrillas
  ADD COLUMN IF NOT EXISTS columnas_vista JSONB;

COMMENT ON COLUMN rotacion_plantilla_cuadrillas.columnas_vista IS
  'Claves de columnas visibles en vista previa para esta cuadrilla; si es NULL usa rotacion_plantillas.columnas_vista';
