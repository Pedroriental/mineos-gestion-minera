-- ============================================================
-- MineOS: Limpieza de tablas legacy (reemplazadas por reportes_* / nomina_*)
-- Tablas a eliminar: cronograma_disparos, disparos_detalle, quemada_plancha,
--                    nominas_cargadas, detalles_nomina, columna disparo_id
-- Validación: 0 registros en todas, 0 referencias en código fuente
-- ============================================================

BEGIN;

-- 1. Romper FKs entrantes desde tablas legacy hacia otras tablas
ALTER TABLE disparos_detalle      DROP CONSTRAINT IF EXISTS disparos_detalle_cronograma_id_fkey;
ALTER TABLE recepcion_material   DROP CONSTRAINT IF EXISTS recepcion_material_disparo_id_fkey;
ALTER TABLE detalles_nomina      DROP CONSTRAINT IF EXISTS detalles_nomina_nomina_id_fkey;
ALTER TABLE detalles_nomina      DROP CONSTRAINT IF EXISTS detalles_nomina_personal_id_fkey;

-- 2. Romper FKs de autoría (creadas en migración anterior)
ALTER TABLE cronograma_disparos  DROP CONSTRAINT IF EXISTS cronograma_disparos_registrado_por_fkey;
ALTER TABLE quemada_plancha      DROP CONSTRAINT IF EXISTS quemada_plancha_registrado_por_fkey;
ALTER TABLE nominas_cargadas     DROP CONSTRAINT IF EXISTS nominas_cargadas_registrado_por_fkey;

-- 3. Romper FK de quemada_plancha → procesamiento_planta
ALTER TABLE quemada_plancha      DROP CONSTRAINT IF EXISTS quemada_plancha_procesamiento_id_fkey;

-- 4. Eliminar columna huérfana disparo_id de recepcion_material
--    (20 registros, todos con disparo_id = NULL)
ALTER TABLE recepcion_material   DROP COLUMN IF EXISTS disparo_id;

-- 5. Borrar tablas legacy
DROP TABLE IF EXISTS disparos_detalle      CASCADE;
DROP TABLE IF EXISTS cronograma_disparos   CASCADE;
DROP TABLE IF EXISTS quemada_plancha       CASCADE;
DROP TABLE IF EXISTS detalles_nomina       CASCADE;
DROP TABLE IF EXISTS nominas_cargadas      CASCADE;

-- 6. Limpiar índices huérfanos (por si DROP TABLE no los eliminó)
DROP INDEX IF EXISTS idx_cronograma_fecha;
DROP INDEX IF EXISTS idx_cronograma_registrado_por;
DROP INDEX IF EXISTS idx_quemada_fecha;
DROP INDEX IF EXISTS idx_quemada_registrado_por;
DROP INDEX IF EXISTS idx_nominas_cargadas_registrado_por;

COMMIT;
