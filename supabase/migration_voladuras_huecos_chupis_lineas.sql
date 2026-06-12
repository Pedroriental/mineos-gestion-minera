-- Voladuras: líneas detalladas por tipo de hueco y longitud de chupi
ALTER TABLE reportes_voladuras
  ADD COLUMN IF NOT EXISTS huecos_lineas jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chupis_lineas jsonb DEFAULT NULL;

COMMENT ON COLUMN reportes_voladuras.huecos_lineas IS
  'Detalle por tipo de hueco: [{ "tipo": "hueco"|"hueco_salida", "cantidad": int, "pies": int }]';

COMMENT ON COLUMN reportes_voladuras.chupis_lineas IS
  'Detalle por longitud de chupi: [{ "cantidad": int, "pies": int }]';
