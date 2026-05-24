-- ============================================================
-- MineOS: Migración V3.1 — Audit Log + Payment History View
-- Ejecutar en Supabase > SQL Editor > New Query
-- ============================================================

-- 1. Tabla de Auditoría de Nómina
CREATE TABLE IF NOT EXISTS nomina_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accion      TEXT NOT NULL,
  entidad     TEXT NOT NULL,
  entidad_id  TEXT,
  detalle     TEXT,
  usuario_id  TEXT,
  usuario_nombre TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nomina_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_access_audit" ON nomina_audit_log;
CREATE POLICY "auth_full_access_audit" ON nomina_audit_log
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON nomina_audit_log(accion);
CREATE INDEX IF NOT EXISTS idx_audit_log_entidad ON nomina_audit_log(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON nomina_audit_log(created_at DESC);

-- 2. Vista materializada: historial de pagos por trabajador
--    (join nomina_registros + nomina_semanas para sacar historial rápido)
CREATE OR REPLACE FUNCTION get_historial_pagos_trabajador(p_personal_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (
  semana_id      UUID,
  semana_inicio  DATE,
  semana_fin     DATE,
  area           TEXT,
  monto_pagado   NUMERIC,
  es_semana_libre BOOLEAN,
  bono_transporte_pagado NUMERIC,
  created_at     TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id AS semana_id,
    s.semana_inicio,
    s.semana_fin,
    s.area,
    r.monto_pagado,
    r.es_semana_libre,
    r.bono_transporte_pagado,
    r.created_at
  FROM nomina_registros r
  JOIN nomina_semanas s ON r.semana_id = s.id
  WHERE r.personal_id = p_personal_id
  ORDER BY s.semana_inicio DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_historial_pagos_trabajador(UUID, INT) TO anon, authenticated;

-- 3. Vista para sparkline: totales semanales recientes por área
CREATE OR REPLACE FUNCTION get_tendencia_semanal(p_area TEXT, p_limit INT DEFAULT 8)
RETURNS TABLE (
  semana_inicio  DATE,
  total_pagado   NUMERIC,
  total_trabajadores INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    semana_inicio,
    total_pagado,
    total_trabajadores
  FROM nomina_semanas
  WHERE area = p_area
  ORDER BY semana_inicio DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_tendencia_semanal(TEXT, INT) TO anon, authenticated;
