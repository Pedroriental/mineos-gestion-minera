-- ============================================================
-- MineOS: Migración V4 — Esquemas de Rotación Nómina 2.0
-- Ejecutar en Supabase > SQL Editor > New Query
-- ============================================================

-- 1. Actualizar la restricción CHECK de esquema_rotacion en la tabla 'personal'
ALTER TABLE personal
  DROP CONSTRAINT IF EXISTS personal_esquema_rotacion_check;

ALTER TABLE personal
  ADD CONSTRAINT personal_esquema_rotacion_check
  CHECK (esquema_rotacion IN (
    'FIJO_SEMANAL',
    'MINA_2X1',
    'MOLINO_FIJO',
    'MOLINO_ROTATIVO',
    'MINA_ROTATIVA_3G',
    'MOLINO_15X15'
  ));
