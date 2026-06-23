-- =============================================================
-- MineOS - Migration: Liquidación de Despidos
-- Almacena datos específicos de la liquidación directamente en personal
-- para que la sección de despidos muestre los valores correctos sin
-- requerir edición manual por cada trabajador.
-- =============================================================

ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS liquidacion_dias_trabajados SMALLINT,
  ADD COLUMN IF NOT EXISTS liquidacion_bonificaciones NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquidacion_cobra_semana_libre BOOLEAN;

COMMENT ON COLUMN personal.liquidacion_dias_trabajados IS 'Días trabajados para liquidación de despido (null = auto-calcular desde despido_fecha)';
COMMENT ON COLUMN personal.liquidacion_bonificaciones IS 'Bonificaciones extra para liquidación de despido';
COMMENT ON COLUMN personal.liquidacion_cobra_semana_libre IS 'Si el trabajador cobró semana libre en su liquidación de despido';

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_personal_liquidacion_dias ON personal(liquidacion_dias_trabajados) WHERE liquidacion_dias_trabajados IS NOT NULL;
