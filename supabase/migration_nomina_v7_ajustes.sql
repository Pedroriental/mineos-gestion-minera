-- ============================================================================
-- MIGRACIÓN: nomina_ajustes
-- Propósito: Registrar ajustes manuales, deudas, abonos y correcciones
-- Brecha que resuelve: M2 (Sin catálogo de ajustes/deudas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nomina_ajustes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Tipo de ajuste
    tipo TEXT NOT NULL
        CHECK (tipo IN (
            'DEUDA',            -- El trabajador debe dinero (se descuenta)
            'ABONO',            -- Se le abona dinero extra
            'CORRECCION',       -- Corrección de un error previo
            'RETROACTIVO',      -- Ajuste retroactivo por cambio de tarifa
            'MULTA',            -- Multa o sanción (se descuenta)
            'BONO_EXTRA',       -- Bono no catalogado
            'OTRO'              -- Otro concepto
        )),
    
    -- Alcance del ajuste
    alcance TEXT NOT NULL DEFAULT 'REGISTRO'
        CHECK (alcance IN (
            'REGISTRO',         -- Aplica a un registro específico
            'CICLO',            -- Aplica a todo un ciclo
            'TRABAJADOR',       -- Aplica al trabajador (próximo pago)
            'SEMANA'            -- Aplica a una semana específica
        )),
    
    -- Relaciones (una de estas debe estar poblada según alcance)
    registro_id UUID
        REFERENCES nomina_registros(id) ON DELETE CASCADE,
    ciclo_id UUID
        REFERENCES nomina_ciclos(id) ON DELETE CASCADE,
    personal_id UUID
        REFERENCES personal(id) ON DELETE CASCADE,
    semana_id UUID
        REFERENCES nomina_semanas(id) ON DELETE CASCADE,
    
    -- Monto (positivo = abono, negativo = deuda/deducción)
    monto NUMERIC(14,2) NOT NULL,
    
    -- Fórmula o descripción del cálculo
    formula_texto TEXT,
    -- Ejemplo: "+14.000+14.000=56-" o "Ajuste por error en semana anterior"
    
    -- Estado
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN (
            'PENDIENTE',        -- Aún no se ha aplicado
            'APLICADO',         -- Ya se aplicó en un pago
            'CANCELADO'         -- Se canceló sin aplicar
        )),
    
    -- Si fue aplicado, en qué registro/semana
    aplicado_en_registro_id UUID
        REFERENCES nomina_registros(id) ON DELETE SET NULL,
    aplicado_at TIMESTAMPTZ,
    
    -- Metadata
    motivo TEXT NOT NULL,
    observaciones TEXT,
    creado_por UUID REFERENCES auth.users(id),
    aprobado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Validación: al menos una relación debe estar poblada
    CONSTRAINT nomina_ajustes_relacion_check CHECK (
        registro_id IS NOT NULL OR
        ciclo_id IS NOT NULL OR
        personal_id IS NOT NULL OR
        semana_id IS NOT NULL
    )
);

-- Índices
CREATE INDEX idx_nomina_ajustes_tipo ON nomina_ajustes(tipo);
CREATE INDEX idx_nomina_ajustes_estado ON nomina_ajustes(estado);
CREATE INDEX idx_nomina_ajustes_registro ON nomina_ajustes(registro_id);
CREATE INDEX idx_nomina_ajustes_ciclo ON nomina_ajustes(ciclo_id);
CREATE INDEX idx_nomina_ajustes_personal ON nomina_ajustes(personal_id);
CREATE INDEX idx_nomina_ajustes_semana ON nomina_ajustes(semana_id);
CREATE INDEX idx_nomina_ajustes_pendientes ON nomina_ajustes(personal_id, estado)
    WHERE estado = 'PENDIENTE';

-- Trigger para updated_at
CREATE TRIGGER set_nomina_ajustes_updated_at
    BEFORE UPDATE ON nomina_ajustes
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE nomina_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_access_nomina_ajustes
    ON nomina_ajustes
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE nomina_ajustes IS 'Ajustes manuales, deudas, abonos y correcciones sobre nómina';
COMMENT ON COLUMN nomina_ajustes.tipo IS 'Tipo de ajuste: DEUDA, ABONO, CORRECCION, RETROACTIVO, MULTA, BONO_EXTRA, OTRO';
COMMENT ON COLUMN nomina_ajustes.alcance IS 'A qué nivel aplica: REGISTRO, CICLO, TRABAJADOR, SEMANA';
COMMENT ON COLUMN nomina_ajustes.monto IS 'Monto del ajuste (positivo = abono/pago extra, negativo = deuda/deducción)';
COMMENT ON COLUMN nomina_ajustes.formula_texto IS 'Fórmula o descripción del cálculo manual (ej: "+14.000+14.000=56-")';
COMMENT ON COLUMN nomina_ajustes.estado IS 'PENDIENTE (sin aplicar), APLICADO (ya descontado/abonado), CANCELADO';
