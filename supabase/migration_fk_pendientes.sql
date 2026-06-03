-- ============================================================
-- MineOS: Migración FK — Restantes (idempotente)
-- ============================================================

DO $$
BEGIN
  -- 1. reportes_voladuras
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'reportes_voladuras_registrado_por_fkey') THEN
    ALTER TABLE reportes_voladuras
      ADD CONSTRAINT reportes_voladuras_registrado_por_fkey
      FOREIGN KEY (registrado_por) REFERENCES auth.users(id);
    CREATE INDEX IF NOT EXISTS idx_reportes_vol_registrado_por ON reportes_voladuras(registrado_por);
  END IF;

  -- 2. nominas_cargadas
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'nominas_cargadas_registrado_por_fkey') THEN
    ALTER TABLE nominas_cargadas
      ADD CONSTRAINT nominas_cargadas_registrado_por_fkey
      FOREIGN KEY (registrado_por) REFERENCES auth.users(id);
    CREATE INDEX IF NOT EXISTS idx_nominas_cargadas_registrado_por ON nominas_cargadas(registrado_por);
  END IF;

  -- 3. nomina_audit_log: cambiar TEXT → UUID + FK
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'nomina_audit_log' AND column_name = 'usuario_id') = 'text' THEN
    ALTER TABLE nomina_audit_log
      ALTER COLUMN usuario_id TYPE UUID USING usuario_id::uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'nomina_audit_log_usuario_id_fkey') THEN
    ALTER TABLE nomina_audit_log
      ADD CONSTRAINT nomina_audit_log_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES auth.users(id);
    CREATE INDEX IF NOT EXISTS idx_nomina_audit_log_usuario_id ON nomina_audit_log(usuario_id);
  END IF;
END $$;
