-- ============================================================================
-- MIGRACIÓN: ALTER TABLE personal
-- Propósito: Vincular trabajadores a perfiles de compensación y verticales
-- Brecha que resuelve: M3 (Vertical desconectada), M4 (Sin perfiles)
-- ============================================================================

-- 1. Añadir columna perfil_compensacion_id
ALTER TABLE personal
    ADD COLUMN IF NOT EXISTS perfil_compensacion_id UUID
        REFERENCES perfiles_compensacion(id) ON DELETE SET NULL;

-- 2. Añadir columna vertical_asignada
ALTER TABLE personal
    ADD COLUMN IF NOT EXISTS vertical_asignada VARCHAR(50);

-- 3. Añadir columna grupo_turno (para clasificación operativa)
ALTER TABLE personal
    ADD COLUMN IF NOT EXISTS grupo_turno VARCHAR(100);
-- Ejemplos: 'Vertical 1PD', 'Vertical 2', 'Cocinera', 'Técnico Operador', 'Grupo Mixto'

-- Índices
CREATE INDEX IF NOT EXISTS idx_personal_perfil_compensacion
    ON personal(perfil_compensacion_id);

CREATE INDEX IF NOT EXISTS idx_personal_vertical_asignada
    ON personal(vertical_asignada);

CREATE INDEX IF NOT EXISTS idx_personal_grupo_turno
    ON personal(grupo_turno);

-- Comentarios
COMMENT ON COLUMN personal.perfil_compensacion_id IS 'Perfil de compensación que define las reglas de pago del trabajador';
COMMENT ON COLUMN personal.vertical_asignada IS 'Vertical donde trabaja (V1, V2, V3, V1PD) - driver de compensación';
COMMENT ON COLUMN personal.grupo_turno IS 'Clasificación operativa del trabajador (ej: "Vertical 1PD", "Cocinera", "Grupo Mixto")';

-- ============================================================================
-- Backfill: Asignar perfiles por defecto basados en esquema_rotacion existente
-- ============================================================================

-- Los trabajadores con MINA_2X1 o MINA_ROTATIVA_3G (rotación 14x7)
-- recibirán el perfil "Operativo Mina 14x7" cuando se cree en el seed

-- Los trabajadores con FIJO_SEMANAL o MOLINO_FIJO (lineal)
-- recibirán el perfil "Administrativo / Fijo" cuando se cree en el seed

-- NOTA: El backfill real se ejecutará DESPUÉS del seed data
-- Ver: migration_nomina_v7_seed_data.sql
