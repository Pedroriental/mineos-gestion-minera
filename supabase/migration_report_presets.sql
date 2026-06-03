-- =============================================================
-- MineOS - Migration: Report Presets
-- Guarda configuraciones de filtros favoritas del usuario
-- =============================================================

CREATE TABLE IF NOT EXISTS report_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  payload JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_report_presets_user ON report_presets(user_id);

-- Solo el dueño puede ver/editar sus presets
ALTER TABLE report_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_presets_owner ON report_presets
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger auto updated_at
CREATE OR REPLACE FUNCTION fn_report_presets_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_presets_updated ON report_presets;
CREATE TRIGGER trg_report_presets_updated
  BEFORE UPDATE ON report_presets
  FOR EACH ROW EXECUTE FUNCTION fn_report_presets_updated();

-- Si se marca un preset como default, desmarca los demas del mismo usuario
CREATE OR REPLACE FUNCTION fn_report_presets_default()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE report_presets
    SET is_default = false
    WHERE user_id = NEW.user_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_presets_default ON report_presets;
CREATE TRIGGER trg_report_presets_default
  BEFORE INSERT OR UPDATE ON report_presets
  FOR EACH ROW
  WHEN (NEW.is_default IS TRUE)
  EXECUTE FUNCTION fn_report_presets_default();
