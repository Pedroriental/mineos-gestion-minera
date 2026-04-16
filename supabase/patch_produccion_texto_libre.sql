-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Este parche cambia los selectores estrictos por campos de texto libre

ALTER TABLE reportes_produccion DROP COLUMN IF EXISTS molino_id CASCADE;
ALTER TABLE reportes_produccion DROP COLUMN IF EXISTS material_id CASCADE;

ALTER TABLE reportes_produccion ADD COLUMN IF NOT EXISTS molino VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE reportes_produccion ADD COLUMN IF NOT EXISTS material VARCHAR(150) NOT NULL DEFAULT '';
