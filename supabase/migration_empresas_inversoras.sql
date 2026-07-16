-- =====================================================
-- EMPRESAS INVERSORAS — Soporte multi-empresa para gastos
-- =====================================================
-- Permite registrar pagos de múltiples empresas inversoras (ej: La Fé, Los Riasco)
-- y calcular la compensacion entre ellas segun su % de participacion.

-- 1. Tabla de empresas inversoras
CREATE TABLE IF NOT EXISTS empresas_inversoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES complexes(id),
  nombre TEXT NOT NULL,
  nombre_corto VARCHAR(20) NOT NULL,
  porcentaje_participacion NUMERIC(5,2) NOT NULL DEFAULT 0.00
    CHECK (porcentaje_participacion >= 0 AND porcentaje_participacion <= 100),
  color VARCHAR(7) DEFAULT '#DAA520',
  activo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(complex_id, nombre_corto)
);

-- 2. Relación gasto-empresa (un gasto puede ser pagado por una o varias empresas)
CREATE TABLE IF NOT EXISTS gastos_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas_inversoras(id) ON DELETE CASCADE,
  monto_pagado NUMERIC(12,2) NOT NULL CHECK (monto_pagado >= 0),
  porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  es_pago_directo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gasto_id, empresa_id)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_gastos_empresas_gasto ON gastos_empresas(gasto_id);
CREATE INDEX IF NOT EXISTS idx_gastos_empresas_empresa ON gastos_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresas_inversoras_complex ON empresas_inversoras(complex_id) WHERE activo = true;

-- 4. RLS (todos los permisos para usuarios autenticados, según requerimiento del usuario)
ALTER TABLE empresas_inversoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_empresas_inversoras" ON empresas_inversoras;
CREATE POLICY "authenticated_read_empresas_inversoras" ON empresas_inversoras
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_empresas_inversoras" ON empresas_inversoras;
CREATE POLICY "authenticated_write_empresas_inversoras" ON empresas_inversoras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_gastos_empresas" ON gastos_empresas;
CREATE POLICY "authenticated_read_gastos_empresas" ON gastos_empresas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_gastos_empresas" ON gastos_empresas;
CREATE POLICY "authenticated_write_gastos_empresas" ON gastos_empresas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Seed inicial: 2 empresas para todos los complexes existentes
DO $$
DECLARE
  v_complex RECORD;
BEGIN
  FOR v_complex IN SELECT id FROM complexes LOOP
    INSERT INTO empresas_inversoras (complex_id, nombre, nombre_corto, porcentaje_participacion, color) VALUES
      (v_complex.id, 'La Fé', 'la_fe', 40.00, '#DAA520'),
      (v_complex.id, 'Los Riasco', 'los_riascos', 60.00, '#60A5FA')
    ON CONFLICT (complex_id, nombre_corto) DO NOTHING;
  END LOOP;
END $$;

-- 6. Migración: asignar todos los gastos existentes a "La Fé" (100%)
-- El usuario confirmó que hasta ahora solo se han registrado pagos de La Fé
INSERT INTO gastos_empresas (gasto_id, empresa_id, monto_pagado, porcentaje, es_pago_directo)
SELECT 
  g.id,
  (SELECT id FROM empresas_inversoras WHERE nombre_corto = 'la_fe' LIMIT 1),
  g.monto,
  100.00,
  true
FROM gastos g
WHERE NOT EXISTS (
  SELECT 1 FROM gastos_empresas ge WHERE ge.gasto_id = g.id
);
