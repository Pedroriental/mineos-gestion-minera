-- ============================================================
-- MineOS: Migración — Libro de Guardia Digital
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

CREATE TABLE libro_guardia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(20) NOT NULL CHECK (turno IN ('dia', 'noche')),
    hora_entrega TIME,
    jefe_saliente VARCHAR(150) NOT NULL,
    jefe_entrante VARCHAR(150) NOT NULL,
    personal_mina INT DEFAULT 0,
    personal_planta INT DEFAULT 0,
    personal_otros INT DEFAULT 0,
    estado_equipos TEXT,
    novedades_operativas TEXT NOT NULL,
    condiciones_seguridad TEXT,
    incidentes TEXT,
    pendientes TEXT,
    observaciones TEXT,
    clima VARCHAR(50),
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE libro_guardia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access" ON libro_guardia
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_libro_guardia_fecha ON libro_guardia(fecha);
