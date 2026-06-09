-- ============================================================================
-- MIGRACIÓN: perfiles_compensacion
-- Propósito: Catálogo de reglas de pago por grupo de trabajador
-- Brecha que resuelve: M4 (Sin perfiles de compensación)
-- ============================================================================

-- Tabla: perfiles_compensacion
-- Define las reglas de compensación que heredan los trabajadores
CREATE TABLE IF NOT EXISTS perfiles_compensacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identificación
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    
    -- Reglas de rotación
    esquema_rotacion_default TEXT NOT NULL DEFAULT 'FIJO_SEMANAL'
        CHECK (esquema_rotacion_default IN (
            'FIJO_SEMANAL',
            'MINA_2X1',
            'MOLINO_FIJO',
            'MOLINO_ROTATIVO',
            'MINA_ROTATIVA_3G',
            'MOLINO_15X15'
        )),
    
    -- Política de pago en días libres
    politica_dia_libre TEXT NOT NULL DEFAULT 'SALARIO_LIBRE'
        CHECK (politica_dia_libre IN (
            'SALARIO_LIBRE',      -- Paga salario_libre (si existe) o salario_base
            'TARIFA_PLANA',       -- Paga tarifa fija independiente de días trabajados
            'SIN_PAGO',           -- No paga días libres
            'GARANTIZADO'         -- Paga salario_base completo sin importar asistencia
        )),
    
    -- Política de reposo
    politica_reposo TEXT NOT NULL DEFAULT 'PARCIAL'
        CHECK (politica_reposo IN (
            'PAGO_COMPLETO',      -- Cobra 100% sin asistencia física
            'PARCIAL',            -- Cobra proporcional a días trabajados
            'SIN_PAGO'            -- No cobra durante reposo
        )),
    
    -- Duración del ciclo en días (para agrupación)
    duracion_ciclo_dias INTEGER NOT NULL DEFAULT 7
        CHECK (duracion_ciclo_dias >= 7 AND duracion_ciclo_dias <= 60),
    
    -- Semanas trabajadas por ciclo (para rotaciones)
    semanas_trabajadas_por_ciclo INTEGER NOT NULL DEFAULT 1
        CHECK (semanas_trabajadas_por_ciclo >= 1 AND semanas_trabajadas_por_ciclo <= 8),
    
    -- Semanas libres por ciclo
    semanas_libres_por_ciclo INTEGER NOT NULL DEFAULT 0
        CHECK (semanas_libres_por_ciclo >= 0 AND semanas_libres_por_ciclo <= 4),
    
    -- Bonos automáticos (JSONB array)
    -- Ejemplo: [{"tipo": "TRANSPORTE", "condicion": "POSICION_1", "monto": 30}]
    bonos_automaticos JSONB NOT NULL DEFAULT '[]'::JSONB,
    
    -- Multiplicadores (para recargos nocturnos, peligrosidad, etc.)
    multiplicadores JSONB NOT NULL DEFAULT '{}'::JSONB,
    -- Ejemplo: {"nocturno": 1.25, "peligrosidad": 1.15}
    
    -- Metadata
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_perfiles_compensacion_activo ON perfiles_compensacion(activo);
CREATE INDEX idx_perfiles_compensacion_esquema ON perfiles_compensacion(esquema_rotacion_default);

-- Trigger para updated_at
CREATE TRIGGER set_perfiles_compensacion_updated_at
    BEFORE UPDATE ON perfiles_compensacion
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE perfiles_compensacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_access_perfiles_compensacion
    ON perfiles_compensacion
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE perfiles_compensacion IS 'Catálogo de reglas de compensación por grupo de trabajador';
COMMENT ON COLUMN perfiles_compensacion.politica_dia_libre IS 'Cómo se pagan los días libres: SALARIO_LIBRE (usa salario_libre del personal), TARIFA_PLANA (monto fijo), SIN_PAGO, GARANTIZADO (salario_base completo)';
COMMENT ON COLUMN perfiles_compensacion.politica_reposo IS 'Cómo se paga durante reposo: PAGO_COMPLETO (100% sin asistencia), PARCIAL (proporcional), SIN_PAGO';
COMMENT ON COLUMN perfiles_compensacion.duracion_ciclo_dias IS 'Duración total del ciclo en días (ej: 21 para rotación 14x7)';
COMMENT ON COLUMN perfiles_compensacion.semanas_trabajadas_por_ciclo IS 'Cuántas semanas se trabajan en cada ciclo (ej: 2 para rotación 14x7)';
COMMENT ON COLUMN perfiles_compensacion.semanas_libres_por_ciclo IS 'Cuántas semanas libres hay en cada ciclo (ej: 1 para rotación 14x7)';
COMMENT ON COLUMN perfiles_compensacion.bonos_automaticos IS 'Array JSON de bonos que se aplican automáticamente según condiciones';
COMMENT ON COLUMN perfiles_compensacion.multiplicadores IS 'Objeto JSON con multiplicadores para recargos (nocturno, peligrosidad, etc.)';
