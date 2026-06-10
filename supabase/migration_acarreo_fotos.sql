-- Fotos adjuntas al informe de acarreo (URLs en Supabase Storage bucket "reportes")

ALTER TABLE reportes_acarreo
  ADD COLUMN IF NOT EXISTS fotos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reportes_acarreo.fotos IS 'URLs públicas de fotos del informe (Supabase Storage reportes/acarreo/...)';
