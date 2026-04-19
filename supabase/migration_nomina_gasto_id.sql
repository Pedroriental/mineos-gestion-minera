-- ============================================================
-- MineOS: Agrega gasto_id a nomina_semanas
-- Permite revertir una semana eliminando el gasto exacto
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

ALTER TABLE nomina_semanas
  ADD COLUMN IF NOT EXISTS gasto_id UUID REFERENCES gastos(id) ON DELETE SET NULL;
