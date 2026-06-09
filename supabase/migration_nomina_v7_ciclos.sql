-- ============================================================================
-- MIGRACIÓN: nomina_ciclos + nomina_ciclo_semanas
-- Propósito: Agrupar semanas en ventanas de 21 días (rotación 14x7)
-- Brecha que resuelve: C1, C2, C3 (Ventana 21 días, consolidación, cierre atómico)
-- ============================================================================

-- Tabla: nomina_ciclos
-- Representa una ventana de trabajo completa (ej: 3 semanas = 21 días)
CREATE TABLE IF NOT EXISTS nomina_ciclos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identificación
    label VARCHAR(150) NOT NULL,
    -- Ejemplo: "Ciclo V1 - Enero 2024 (Semanas 1-3)"
    
    -- Rango temporal
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    
    -- Relación con perfil de compensación
    perfil_compensacion_id UUID NOT NULL
        REFERENCES perfiles_compensacion(id) ON DELETE RESTRICT,
    
    -- Área y vertical (para agrupación)
    area TEXT NOT NULL
        CHECK (area IN ('mina', 'planta', 'administracion', 'seguridad', 'transporte')),
    vertical VARCHAR(50),
    -- Ejemplo: 'Vertical 1', 'Vertical 2', 'Vertical 1PD'
    
    -- Totales consolidados del ciclo
    total_ciclo_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_trabajadores INTEGER NOT NULL DEFAULT 0,
    
    -- Estado del ciclo
    estado TEXT NOT NULL DEFAULT 'ABIERTO'
        CHECK (estado IN ('ABIERTO', 'CERRADO', 'REVERTIDO')),
    
    -- Metadata
    notas TEXT,
    cerrado_por UUID REFERENCES auth.users(id),
    cerrado_at TIMESTAMPTZ,
    creado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Validación: fecha_fin debe ser posterior a fecha_inicio
    CONSTRAINT nomina_ciclos_fecha_check CHECK (fecha_fin >= fecha_inicio)
);

-- Índices
CREATE INDEX idx_nomina_ciclos_estado ON nomina_ciclos(estado);
CREATE INDEX idx_nomina_ciclos_area ON nomina_ciclos(area);
CREATE INDEX idx_nomina_ciclos_vertical ON nomina_ciclos(vertical);
CREATE INDEX idx_nomina_ciclos_perfil ON nomina_ciclos(perfil_compensacion_id);
CREATE INDEX idx_nomina_ciclos_fecha_inicio ON nomina_ciclos(fecha_inicio);
CREATE INDEX idx_nomina_ciclos_compound ON nomina_ciclos(area, vertical, fecha_inicio);

-- Trigger para updated_at
CREATE TRIGGER set_nomina_ciclos_updated_at
    BEFORE UPDATE ON nomina_ciclos
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE nomina_ciclos ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_access_nomina_ciclos
    ON nomina_ciclos
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE nomina_ciclos IS 'Ventanas de trabajo completas (ej: 3 semanas para rotación 14x7)';
COMMENT ON COLUMN nomina_ciclos.label IS 'Etiqueta descriptiva del ciclo (ej: "Ciclo V1 - Enero 2024")';
COMMENT ON COLUMN nomina_ciclos.perfil_compensacion_id IS 'Perfil que define las reglas de pago de este ciclo';
COMMENT ON COLUMN nomina_ciclos.total_ciclo_usd IS 'Suma consolidada de todos los pagos del ciclo';
COMMENT ON COLUMN nomina_ciclos.estado IS 'ABIERTO (en proceso), CERRADO (finalizado), REVERTIDO (anulado)';

-- ============================================================================
-- Tabla: nomina_ciclo_semanas (junction)
-- Relaciona ciclos con semanas, incluyendo posición y rol
-- ============================================================================

CREATE TABLE IF NOT EXISTS nomina_ciclo_semanas (
    ciclo_id UUID NOT NULL
        REFERENCES nomina_ciclos(id) ON DELETE CASCADE,
    semana_id UUID NOT NULL
        REFERENCES nomina_semanas(id) ON DELETE CASCADE,
    
    -- Posición dentro del ciclo (0-indexed)
    posicion_en_ciclo SMALLINT NOT NULL
        CHECK (posicion_en_ciclo >= 0 AND posicion_en_ciclo <= 10),
    -- Ejemplo para rotación 14x7:
    -- 0 = Semana libre
    -- 1 = Primera semana trabajada
    -- 2 = Segunda semana trabajada
    
    -- Rol de esta semana en el ciclo
    rol_semana TEXT NOT NULL
        CHECK (rol_semana IN ('libre', 'trabajada', 'no_laborada', 'reposo', 'vacaciones')),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Clave primaria compuesta
    PRIMARY KEY (ciclo_id, semana_id)
);

-- Índices
CREATE INDEX idx_nomina_ciclo_semanas_ciclo ON nomina_ciclo_semanas(ciclo_id);
CREATE INDEX idx_nomina_ciclo_semanas_semana ON nomina_ciclo_semanas(semana_id);
CREATE INDEX idx_nomina_ciclo_semanas_posicion ON nomina_ciclo_semanas(ciclo_id, posicion_en_ciclo);

-- NOTA: No hay UNIQUE en semana_id porque una misma semana calendario
-- puede pertenecer a múltiples ciclos (ej: V1, V2, V3 en la misma semana).
-- La PK compuesta (ciclo_id, semana_id) protege contra duplicados internos.

-- RLS
ALTER TABLE nomina_ciclo_semanas ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_access_nomina_ciclo_semanas
    ON nomina_ciclo_semanas
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE nomina_ciclo_semanas IS 'Relación muchos-a-muchos entre ciclos y semanas con posición y rol';
COMMENT ON COLUMN nomina_ciclo_semanas.posicion_en_ciclo IS 'Posición 0-indexed dentro del ciclo (0=libre, 1=primera trabajada, etc.)';
COMMENT ON COLUMN nomina_ciclo_semanas.rol_semana IS 'Rol de la semana: libre, trabajada, no_laborada, reposo, vacaciones';
