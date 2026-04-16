-- ============================================================
-- MineOS: Creación - Reportes de Producción (Texto Libre)
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- 1. Crear tabla principal
CREATE TABLE IF NOT EXISTS reportes_produccion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(20) NOT NULL DEFAULT 'dia'
        CHECK (turno IN ('dia', 'noche', 'completo')),

    -- Cajas de texto libre
    molino VARCHAR(150) NOT NULL,
    material VARCHAR(150) NOT NULL,
    material_codigo VARCHAR(50),

    -- Amalgamación
    amalgama_1_g NUMERIC(10,4),
    amalgama_2_g NUMERIC(10,4),

    -- Recuperación
    oro_recuperado_g NUMERIC(10,4) NOT NULL CHECK (oro_recuperado_g >= 0),

    -- Merma (calculada automáticmamente)
    merma_1_pct NUMERIC(6,2),
    merma_2_pct NUMERIC(6,2),

    -- Producción
    sacos INTEGER NOT NULL DEFAULT 0,
    toneladas_procesadas NUMERIC(8,4),

    -- Tenores
    tenor_tonelada_gpt NUMERIC(8,4),
    tenor_saco_gps NUMERIC(8,4),

    -- Metadata
    responsable VARCHAR(150),
    observaciones TEXT,
    registrado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices de optimización
CREATE INDEX IF NOT EXISTS idx_reportes_prod_fecha ON reportes_produccion(fecha);

-- 3. Seguridad y Políticas de Acceso (RLS)
ALTER TABLE reportes_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access" ON reportes_produccion
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 4. Trigger auto-actualización de fecha
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reportes_produccion
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- LISTO!
