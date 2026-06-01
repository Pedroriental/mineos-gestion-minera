-- ============================================================
-- MIGRACIÓN: Catálogo de Conceptos Reutilizables de Gasto
-- ============================================================

-- Creación de la tabla
CREATE TABLE IF NOT EXISTS gasto_conceptos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    descripcion VARCHAR(300) NOT NULL UNIQUE,
    categoria_default_id UUID REFERENCES categorias_gasto(id) ON DELETE SET NULL,
    proveedor_sugerido VARCHAR(200),
    monto_sugerido NUMERIC(14,2),
    notas TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE gasto_conceptos ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso total para usuarios autenticados
CREATE POLICY "auth_full_access" ON gasto_conceptos FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Índices para velocidad de consulta y autocompletado
CREATE INDEX IF NOT EXISTS idx_gasto_conceptos_descripcion ON gasto_conceptos(descripcion);
CREATE INDEX IF NOT EXISTS idx_gasto_conceptos_activo ON gasto_conceptos(activo);

-- Trigger para mantener actualizado el campo updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON gasto_conceptos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Poblado inicial inteligente con conceptos operativos reales de La Fe
INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Compra de Gasoil / Diesel', id FROM categorias_gasto WHERE nombre = 'Combustible y lubricantes'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Litros de Gasolina', id FROM categorias_gasto WHERE nombre = 'Combustible y lubricantes'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Paca de Harina', id FROM categorias_gasto WHERE nombre = 'Alimentación'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Bombona de Gas', id FROM categorias_gasto WHERE nombre = 'Alimentación'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Alimentación e Hidratación', id FROM categorias_gasto WHERE nombre = 'Alimentación'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Mecate bomba de achique', id FROM categorias_gasto WHERE nombre = 'Herramientas y EPP'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Grasera pequeña', id FROM categorias_gasto WHERE nombre = 'Herramientas y EPP'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT '1 Cuñete Grasa pon pon', id FROM categorias_gasto WHERE nombre = 'Combustible y lubricantes'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Sacos de Cemento', id FROM categorias_gasto WHERE nombre = 'Mejoras de infraestructura'
ON CONFLICT (descripcion) DO NOTHING;

INSERT INTO gasto_conceptos (descripcion, categoria_default_id)
SELECT 'Litros de Pega PVC', id FROM categorias_gasto WHERE nombre = 'Mejoras de infraestructura'
ON CONFLICT (descripcion) DO NOTHING;
