
-- =============================================================
-- MineOS - Migration: Crear tabla reportes_quemado
--
-- Esta tabla existe en producción pero nunca fue agregada
-- a las migraciones, lo que impide reconstruir la BD desde cero.
--
-- Ejecutar: una sola vez en Supabase > SQL Editor
-- =============================================================

CREATE TABLE IF NOT EXISTS reportes_quemado (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL,
    turno VARCHAR(50) NOT NULL,
    numero_quemada VARCHAR(50),
    planchas JSONB NOT NULL DEFAULT '[]'::jsonb,
    manto_amalgama_g NUMERIC(12,4),
    manto_oro_g NUMERIC(12,4),
    retorta_oro_g NUMERIC(12,4),
    total_amalgama_g NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_oro_g NUMERIC(12,4) NOT NULL DEFAULT 0,
    responsable VARCHAR(150),
    observaciones TEXT,
    registrado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reportes_quemado_fecha ON reportes_quemado(fecha);
CREATE INDEX IF NOT EXISTS idx_reportes_quemado_turno ON reportes_quemado(turno);
CREATE INDEX IF NOT EXISTS idx_reportes_quemado_registrado_por ON reportes_quemado(registrado_por);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION trigger_updated_at_reportes_quemado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_reportes_quemado ON reportes_quemado;
CREATE TRIGGER set_updated_at_reportes_quemado
    BEFORE UPDATE ON reportes_quemado
    FOR EACH ROW
    EXECUTE FUNCTION trigger_updated_at_reportes_quemado();

-- Row Level Security
ALTER TABLE reportes_quemado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_access" ON reportes_quemado;
CREATE POLICY "auth_full_access" ON reportes_quemado
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
