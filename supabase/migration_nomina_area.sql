-- ============================================================
-- MineOS: Migración - Separar nóminas por área (mina / planta)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. Agregar columna area a nomina_semanas
ALTER TABLE nomina_semanas
  ADD COLUMN IF NOT EXISTS area TEXT NOT NULL DEFAULT 'mina';

-- 2. Eliminar el constraint UNIQUE antiguo (semana_inicio sola)
ALTER TABLE nomina_semanas
  DROP CONSTRAINT IF EXISTS nomina_semanas_semana_inicio_key;

-- 3. Agregar nuevo constraint UNIQUE compuesto (semana_inicio + area)
ALTER TABLE nomina_semanas
  ADD CONSTRAINT nomina_semanas_semana_inicio_area_key UNIQUE (semana_inicio, area);

-- 4. Agregar columna gasto_id si no existe (la necesita Revertir)
ALTER TABLE nomina_semanas
  ADD COLUMN IF NOT EXISTS gasto_id UUID REFERENCES gastos(id) ON DELETE SET NULL;

-- Índice para la nueva restricción
CREATE INDEX IF NOT EXISTS idx_nomina_semanas_area ON nomina_semanas(area);
