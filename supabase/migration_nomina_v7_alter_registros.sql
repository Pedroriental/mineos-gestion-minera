-- ============================================================================
-- MIGRACIÓN: ALTER TABLE nomina_registros
-- Propósito: Vincular registros individuales a ciclos de 21 días
-- Brecha que resuelve: C1, C2 (Ventana 21 días, consolidación)
-- ============================================================================

-- 1. Añadir columna ciclo_id (FK a nomina_ciclos)
ALTER TABLE nomina_registros
    ADD COLUMN IF NOT EXISTS ciclo_id UUID
        REFERENCES nomina_ciclos(id) ON DELETE SET NULL;

-- 2. Añadir columna posicion_en_ciclo
ALTER TABLE nomina_registros
    ADD COLUMN IF NOT EXISTS posicion_en_ciclo SMALLINT
        CHECK (posicion_en_ciclo IS NULL OR (posicion_en_ciclo >= 0 AND posicion_en_ciclo <= 10));
-- NULL = registro legacy sin ciclo
-- 0 = Semana libre
-- 1 = Primera semana trabajada
-- 2 = Segunda semana trabajada

-- 3. Añadir columna es_finiquito
ALTER TABLE nomina_registros
    ADD COLUMN IF NOT EXISTS es_finiquito BOOLEAN NOT NULL DEFAULT false;

-- 4. Añadir columna perfil_compensacion_snapshot (JSONB)
-- Captura el perfil al momento del cierre para auditoría
ALTER TABLE nomina_registros
    ADD COLUMN IF NOT EXISTS perfil_compensacion_snapshot JSONB;

-- Índices
CREATE INDEX IF NOT EXISTS idx_nomina_registros_ciclo
    ON nomina_registros(ciclo_id);

CREATE INDEX IF NOT EXISTS idx_nomina_registros_posicion
    ON nomina_registros(ciclo_id, posicion_en_ciclo);

CREATE INDEX IF NOT EXISTS idx_nomina_registros_finiquito
    ON nomina_registros(es_finiquito) WHERE es_finiquito = true;

-- Comentarios
COMMENT ON COLUMN nomina_registros.ciclo_id IS 'Ciclo de 21 días al que pertenece este registro (NULL para registros legacy)';
COMMENT ON COLUMN nomina_registros.posicion_en_ciclo IS 'Posición dentro del ciclo: 0=libre, 1=primera trabajada, 2=segunda trabajada';
COMMENT ON COLUMN nomina_registros.es_finiquito IS 'Marca si este registro es un pago de liquidación/finiquito';
COMMENT ON COLUMN nomina_registros.perfil_compensacion_snapshot IS 'Snapshot inmutable del perfil de compensación al momento del cierre';

-- ============================================================================
-- Trigger: Validar consistencia ciclo_id ↔ nomina_ciclo_semanas
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_registro_ciclo_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el registro tiene ciclo_id, validar que la semana esté en el ciclo
    IF NEW.ciclo_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM nomina_ciclo_semanas ncs
            WHERE ncs.ciclo_id = NEW.ciclo_id
            AND ncs.semana_id = NEW.semana_id
        ) THEN
            RAISE EXCEPTION 'La semana % no pertenece al ciclo %', NEW.semana_id, NEW.ciclo_id;
        END IF;
        
        -- Validar que posicion_en_ciclo coincida
        IF NEW.posicion_en_ciclo IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM nomina_ciclo_semanas ncs
                WHERE ncs.ciclo_id = NEW.ciclo_id
                AND ncs.semana_id = NEW.semana_id
                AND ncs.posicion_en_ciclo = NEW.posicion_en_ciclo
            ) THEN
                RAISE EXCEPTION 'La posición % no coincide con la semana % en el ciclo %', 
                    NEW.posicion_en_ciclo, NEW.semana_id, NEW.ciclo_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_registro_ciclo
    BEFORE INSERT OR UPDATE ON nomina_registros
    FOR EACH ROW
    EXECUTE FUNCTION validate_registro_ciclo_consistency();
