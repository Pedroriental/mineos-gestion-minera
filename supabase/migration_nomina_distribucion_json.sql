-- Reparto flexible de cierre (JSON) además de columnas legacy de 3 socios
ALTER TABLE nomina_cierres
  ADD COLUMN IF NOT EXISTS distribucion JSONB;

COMMENT ON COLUMN nomina_cierres.distribucion IS
  'Plantilla de reparto: [{ id, nombre, porcentaje, pagoDirecto }, ...]';
