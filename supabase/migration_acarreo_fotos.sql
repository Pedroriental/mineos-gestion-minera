-- Fotos adjuntas al informe de acarreo (URLs servidas desde /public/uploads/acarreo)

ALTER TABLE reportes_acarreo
  ADD COLUMN IF NOT EXISTS fotos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reportes_acarreo.fotos IS 'URLs de fotos del informe (/uploads/acarreo/...)';
