-- ============================================================================
-- MIGRACIÓN: nomina_bonos (catálogo + asignaciones tipificadas)
-- Propósito: Catalogar y trazabilizar bonos por tipo
-- Brecha que resuelve: M1 (Bonos sin tipificar)
-- ============================================================================

-- Tabla: nomina_bonos_catalogo
-- Catálogo de tipos de bonos disponibles
CREATE TABLE IF NOT EXISTS nomina_bonos_catalogo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identificación
    codigo VARCHAR(50) NOT NULL UNIQUE,
    -- Ejemplo: 'TRANSPORTE', 'ALIMENTACION', 'PELIGROSIDAD', 'NOCTURNIDAD'
    
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    
    -- Configuración por defecto
    monto_default NUMERIC(12,2) NOT NULL DEFAULT 0,
    
    -- Condiciones de aplicación
    tipo_aplicacion TEXT NOT NULL DEFAULT 'MANUAL'
        CHECK (tipo_aplicacion IN (
            'MANUAL',           -- Se asigna manualmente por registro
            'AUTOMATICO',       -- Se aplica según perfil_compensacion.bonos_automaticos
            'CONDICIONAL'       -- Se aplica si se cumple una condición (ej: posición en ciclo)
        )),
    
    -- Condición JSONB (para tipo_aplicacion = 'CONDICIONAL')
    -- Ejemplo: {"campo": "posicion_en_ciclo", "operador": "=", "valor": 1}
    condicion JSONB,
    
    -- Metadata
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_nomina_bonos_catalogo_codigo ON nomina_bonos_catalogo(codigo);
CREATE INDEX idx_nomina_bonos_catalogo_activo ON nomina_bonos_catalogo(activo);

-- Trigger para updated_at
CREATE TRIGGER set_nomina_bonos_catalogo_updated_at
    BEFORE UPDATE ON nomina_bonos_catalogo
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE nomina_bonos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_access_nomina_bonos_catalogo
    ON nomina_bonos_catalogo
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE nomina_bonos_catalogo IS 'Catálogo de tipos de bonos disponibles en el sistema';
COMMENT ON COLUMN nomina_bonos_catalogo.codigo IS 'Código único del bono (ej: TRANSPORTE, ALIMENTACION)';
COMMENT ON COLUMN nomina_bonos_catalogo.tipo_aplicacion IS 'Cómo se aplica: MANUAL (por registro), AUTOMATICO (por perfil), CONDICIONAL (según regla)';
COMMENT ON COLUMN nomina_bonos_catalogo.condicion IS 'Regla JSONB para aplicación condicional';

-- ============================================================================
-- Tabla: nomina_bonos_asignados
-- Bonos asignados a registros específicos
-- ============================================================================

CREATE TABLE IF NOT EXISTS nomina_bonos_asignados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relaciones
    registro_id UUID NOT NULL
        REFERENCES nomina_registros(id) ON DELETE CASCADE,
    bono_catalogo_id UUID NOT NULL
        REFERENCES nomina_bonos_catalogo(id) ON DELETE RESTRICT,
    
    -- Monto
    monto NUMERIC(12,2) NOT NULL
        CHECK (monto >= 0),
    
    -- Metadata
    motivo TEXT,
    aplicado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_nomina_bonos_asignados_registro ON nomina_bonos_asignados(registro_id);
CREATE INDEX idx_nomina_bonos_asignados_bono ON nomina_bonos_asignados(bono_catalogo_id);
CREATE INDEX idx_nomina_bonos_asignados_compound ON nomina_bonos_asignados(registro_id, bono_catalogo_id);

-- Unique: un bono del mismo tipo solo puede asignarse una vez por registro
CREATE UNIQUE INDEX idx_nomina_bonos_asignados_unique
    ON nomina_bonos_asignados(registro_id, bono_catalogo_id);

-- RLS
ALTER TABLE nomina_bonos_asignados ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_access_nomina_bonos_asignados
    ON nomina_bonos_asignados
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE nomina_bonos_asignados IS 'Bonos tipificados asignados a registros de nómina';
COMMENT ON COLUMN nomina_bonos_asignados.monto IS 'Monto del bono (puede diferir del monto_default del catálogo)';
COMMENT ON COLUMN nomina_bonos_asignados.motivo IS 'Razón o justificación del bono';
