-- ============================================================
-- MineOS: Migración V3 — Nómina 2.0
-- Rotaciones Predictivas + Ledger de Vales/Adelantos
-- Ejecutar completo en Supabase > SQL Editor > New Query
-- ============================================================

-- 1. Añadir esquema de rotación y fecha de inicio al personal
ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS esquema_rotacion TEXT NOT NULL DEFAULT 'FIJO_SEMANAL'
    CHECK (esquema_rotacion IN ('FIJO_SEMANAL', 'MINA_2X1', 'MOLINO_FIJO', 'MOLINO_ROTATIVO')),
  ADD COLUMN IF NOT EXISTS rotacion_inicio_fecha DATE DEFAULT NULL;

-- 2. Tabla de Vales / Adelantos individuales
CREATE TABLE IF NOT EXISTS nomina_vales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personal_id      UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  monto            NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo           TEXT NOT NULL DEFAULT '',
  estado           TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'COBRADO')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS para nomina_vales
ALTER TABLE nomina_vales ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "auth_full_access" ON nomina_vales
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_nomina_vales_personal ON nomina_vales(personal_id);
CREATE INDEX IF NOT EXISTS idx_nomina_vales_estado ON nomina_vales(estado);
CREATE INDEX IF NOT EXISTS idx_nomina_vales_fecha ON nomina_vales(fecha);
CREATE INDEX IF NOT EXISTS idx_personal_esquema_rotacion ON personal(esquema_rotacion);

-- 5. RPC: Obtener vales pendientes de un trabajador
CREATE OR REPLACE FUNCTION get_vales_pendientes(p_personal_id UUID)
RETURNS TABLE (
  id          UUID,
  monto       NUMERIC,
  fecha       DATE,
  motivo      TEXT,
  estado      TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.monto, v.fecha, v.motivo, v.estado, v.created_at
  FROM nomina_vales v
  WHERE v.personal_id = p_personal_id
    AND v.estado = 'PENDIENTE'
  ORDER BY v.fecha DESC;
$$;

GRANT EXECUTE ON FUNCTION get_vales_pendientes(UUID) TO anon, authenticated;

-- 6. RPC: Marcar vales como cobrados al cerrar nómina
CREATE OR REPLACE FUNCTION marcar_vales_cobrados(p_personal_ids UUID[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE nomina_vales
  SET estado = 'COBRADO'
  WHERE personal_id = ANY(p_personal_ids)
    AND estado = 'PENDIENTE';
$$;

GRANT EXECUTE ON FUNCTION marcar_vales_cobrados(UUID[]) TO anon, authenticated;
