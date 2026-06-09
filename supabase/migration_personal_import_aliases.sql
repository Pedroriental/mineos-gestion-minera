-- Alias de nombres/cédulas de Excel histórico → personal (Base de Trabajadores)
CREATE TABLE IF NOT EXISTS personal_import_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_nombre_normalizado TEXT NOT NULL,
  alias_cedula_excel TEXT NOT NULL DEFAULT '',
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  source VARCHAR(30) NOT NULL DEFAULT 'nomina_historico',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (alias_nombre_normalizado, alias_cedula_excel)
);

CREATE INDEX IF NOT EXISTS idx_personal_import_aliases_nombre
  ON personal_import_aliases (alias_nombre_normalizado);

CREATE INDEX IF NOT EXISTS idx_personal_import_aliases_personal
  ON personal_import_aliases (personal_id);
