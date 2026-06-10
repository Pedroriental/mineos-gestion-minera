-- Bucket público para fotos de informes (acarreo y futuros módulos).
-- Aplicar con: supabase db query --linked --yes -f supabase/migration_reportes_storage.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reportes',
  'reportes',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "reportes_public_read" ON storage.objects;
CREATE POLICY "reportes_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reportes');

DROP POLICY IF EXISTS "reportes_auth_insert" ON storage.objects;
CREATE POLICY "reportes_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'reportes');

DROP POLICY IF EXISTS "reportes_auth_update" ON storage.objects;
CREATE POLICY "reportes_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'reportes')
  WITH CHECK (bucket_id = 'reportes');

DROP POLICY IF EXISTS "reportes_auth_delete" ON storage.objects;
CREATE POLICY "reportes_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'reportes');
