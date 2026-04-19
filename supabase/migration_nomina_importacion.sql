-- ============================================================
-- MineOS: Migración - Tabla nomina_semanas
-- Registra qué semanas de nómina ya fueron procesadas
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS nomina_semanas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    semana_inicio DATE NOT NULL UNIQUE,
    semana_fin DATE NOT NULL,
    total_trabajadores INTEGER NOT NULL DEFAULT 0,
    total_pagado NUMERIC(14,2) NOT NULL DEFAULT 0,
    notas TEXT,
    registrado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nomina_semanas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access" ON nomina_semanas
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_nomina_semanas_inicio ON nomina_semanas(semana_inicio);
