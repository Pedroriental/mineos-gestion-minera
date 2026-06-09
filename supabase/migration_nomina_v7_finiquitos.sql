-- ============================================================================
-- MIGRACIÓN: nomina_finiquitos
-- Propósito: Registrar pagos de liquidación/finiquito cuando un trabajador sale
-- Brecha que resuelve: A1 (Sin entidad de finiquito)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nomina_finiquitos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relación con trabajador
    personal_id UUID NOT NULL
        REFERENCES personal(id) ON DELETE RESTRICT,
    
    -- Fecha del finiquito
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Tipo de salida
    tipo_salida TEXT NOT NULL
        CHECK (tipo_salida IN (
            'RETIRO',           -- Salida voluntaria
            'DESPIDO',          -- Despido por la empresa
            'RENUNCIA',         -- Renuncia formal
            'FIN_CONTRATO',     -- Término de contrato
            'JUBILACION',       -- Jubilación
            'OTRO'              -- Otro motivo
        )),
    
    -- Contexto del ciclo (si aplica)
    ciclo_id UUID
        REFERENCES nomina_ciclos(id) ON DELETE SET NULL,
    
    -- Cálculo del finiquito
    dias_trabajados_ciclo INTEGER NOT NULL DEFAULT 0
        CHECK (dias_trabajados_ciclo >= 0 AND dias_trabajados_ciclo <= 60),
    
    salario_base_proporcional NUMERIC(14,2) NOT NULL DEFAULT 0,
    -- Ejemplo: Si trabajó 10 de 14 días → (salario_base / 14) * 10
    
    bonos_pendientes NUMERIC(14,2) NOT NULL DEFAULT 0,
    -- Bonos que no se habían pagado aún
    
    vales_pendientes NUMERIC(14,2) NOT NULL DEFAULT 0,
    -- Vales/adelantos que se descuentan del finiquito
    
    otros_conceptos NUMERIC(14,2) NOT NULL DEFAULT 0,
    -- Otros pagos o deducciones (positivo = pago, negativo = deducción)
    
    -- Totales
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    -- subtotal = salario_base_proporcional + bonos_pendientes - vales_pendientes + otros_conceptos
    
    total_finiquito NUMERIC(14,2) NOT NULL DEFAULT 0,
    -- Total final a pagar (puede diferir del subtotal si hay ajustes manuales)
    
    -- Vinculación con registro de nómina (si se generó uno)
    registro_id UUID
        REFERENCES nomina_registros(id) ON DELETE SET NULL,
    
    -- Metadata
    motivo TEXT,
    observaciones TEXT,
    aprobado_por UUID REFERENCES auth.users(id),
    procesado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_nomina_finiquitos_personal ON nomina_finiquitos(personal_id);
CREATE INDEX idx_nomina_finiquitos_fecha ON nomina_finiquitos(fecha);
CREATE INDEX idx_nomina_finiquitos_tipo ON nomina_finiquitos(tipo_salida);
CREATE INDEX idx_nomina_finiquitos_ciclo ON nomina_finiquitos(ciclo_id);

-- RLS
ALTER TABLE nomina_finiquitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_access_nomina_finiquitos
    ON nomina_finiquitos
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE nomina_finiquitos IS 'Pagos de liquidación/finiquito cuando un trabajador sale de la empresa';
COMMENT ON COLUMN nomina_finiquitos.tipo_salida IS 'Motivo de la salida: RETIRO, DESPIDO, RENUNCIA, FIN_CONTRATO, JUBILACION, OTRO';
COMMENT ON COLUMN nomina_finiquitos.dias_trabajados_ciclo IS 'Días que trabajó en el ciclo actual antes de salir';
COMMENT ON COLUMN nomina_finiquitos.salario_base_proporcional IS 'Salario proporcional a los días trabajados del ciclo';
COMMENT ON COLUMN nomina_finiquitos.vales_pendientes IS 'Vales/adelantos pendientes que se descuentan del finiquito';
COMMENT ON COLUMN nomina_finiquitos.registro_id IS 'Registro de nómina generado para este finiquito (es_finiquito = true)';
