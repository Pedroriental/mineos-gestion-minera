-- ============================================================
-- MineOS: Migración V2 — Sistema de Pre-Nómina Enterprise
-- Ejecutar completo en Supabase > SQL Editor > New Query
-- ============================================================

-- 1. Añadir nuevas columnas a tabla 'personal' existente
ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS estatus TEXT NOT NULL DEFAULT 'ACTIVO'
    CHECK (estatus IN ('ACTIVO', 'LIQUIDADO', 'INACTIVO')),
  ADD COLUMN IF NOT EXISTS area_detalle TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS salario_libre NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bono_transporte NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 2. Tabla de Registros de Nómina individual (inmutables)
CREATE TABLE IF NOT EXISTS nomina_registros (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semana_id        UUID NOT NULL,  -- FK a nomina_semanas
  personal_id      UUID NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  monto_pagado     NUMERIC(12,2) NOT NULL DEFAULT 0,
  es_semana_libre  BOOLEAN NOT NULL DEFAULT FALSE,
  bono_transporte_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla de Cierre Semanal con aportes de socios
CREATE TABLE IF NOT EXISTS nomina_cierres (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semana_id         UUID NOT NULL REFERENCES nomina_semanas(id) ON DELETE CASCADE,
  total_nomina_usd  NUMERIC(14,2) NOT NULL DEFAULT 0,
  pct_pedro         NUMERIC(5,2) NOT NULL DEFAULT 0,
  pct_darinel       NUMERIC(5,2) NOT NULL DEFAULT 0,
  pct_la_fe         NUMERIC(5,2) NOT NULL DEFAULT 0,
  monto_pedro       NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_darinel     NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_la_fe       NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(semana_id)
);

-- 4. Actualizar constraint de area en personal para soportar nuevas áreas
ALTER TABLE personal
  DROP CONSTRAINT IF EXISTS personal_area_check;

ALTER TABLE personal
  ADD CONSTRAINT personal_area_check
  CHECK (area IN ('mina', 'planta', 'administracion', 'seguridad', 'transporte'));

-- 5. RLS para nuevas tablas
ALTER TABLE nomina_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina_cierres ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "auth_full_access" ON nomina_registros
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "auth_full_access" ON nomina_cierres
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_nomina_registros_semana ON nomina_registros(semana_id);
CREATE INDEX IF NOT EXISTS idx_nomina_registros_personal ON nomina_registros(personal_id);
CREATE INDEX IF NOT EXISTS idx_nomina_cierres_semana ON nomina_cierres(semana_id);
CREATE INDEX IF NOT EXISTS idx_personal_estatus ON personal(estatus);
CREATE INDEX IF NOT EXISTS idx_personal_area_detalle ON personal(area_detalle);

-- 7. Función RPC: get_nomina_historico_semanal
CREATE OR REPLACE FUNCTION get_nomina_historico_semanal(p_area text DEFAULT NULL)
RETURNS TABLE (
  semana_id           uuid,
  semana_inicio       date,
  semana_fin          date,
  area                text,
  total_trabajadores  integer,
  total_pagado        numeric,
  tiene_cierre        boolean,
  monto_pedro         numeric,
  monto_darinel       numeric,
  monto_la_fe         numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ns.id               AS semana_id,
    ns.semana_inicio,
    ns.semana_fin,
    ns.area,
    ns.total_trabajadores,
    ns.total_pagado,
    nc.id IS NOT NULL   AS tiene_cierre,
    COALESCE(nc.monto_pedro, 0)    AS monto_pedro,
    COALESCE(nc.monto_darinel, 0)  AS monto_darinel,
    COALESCE(nc.monto_la_fe, 0)    AS monto_la_fe
  FROM nomina_semanas ns
  LEFT JOIN nomina_cierres nc ON nc.semana_id = ns.id
  WHERE (p_area IS NULL OR ns.area = p_area)
  ORDER BY ns.semana_inicio DESC;
$$;

GRANT EXECUTE ON FUNCTION get_nomina_historico_semanal(text) TO anon, authenticated;
