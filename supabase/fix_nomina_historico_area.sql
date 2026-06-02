-- ============================================================
-- MineOS: Script de corrección de datos históricos de nómina
-- BUG #1 FIX: personal y semanas que quedaron con area='mina'
-- pero pertenecen a Molinos (planta) o Administración.
-- 
-- EJECUTAR MANUALMENTE en Supabase SQL Editor.
-- HACER BACKUP antes de ejecutar.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PASO 1: Ver cuántos registros tienen el problema
-- (Ejecutar primero para diagnóstico)
-- ─────────────────────────────────────────────────────────────

-- Registros históricos donde el snapshot indica planta pero el área es mina
SELECT
  ns.semana_inicio,
  ns.area AS semana_area,
  nr.personal_snapshot->>'area' AS snapshot_area,
  nr.personal_snapshot->>'cargo' AS snapshot_cargo,
  nr.personal_snapshot->>'nombre_completo' AS nombre,
  nr.personal_snapshot->>'section_title' AS section_title,
  COUNT(*) AS registros
FROM nomina_registros nr
JOIN nomina_semanas ns ON nr.semana_id = ns.id
WHERE nr.origen = 'import_historico'
  AND ns.area = 'mina'
  AND nr.personal_snapshot->>'area' IN ('planta', 'administracion')
GROUP BY ns.semana_inicio, ns.area, snapshot_area, snapshot_cargo, nombre, section_title
ORDER BY ns.semana_inicio DESC, snapshot_area;

-- ─────────────────────────────────────────────────────────────
-- PASO 2: (OPCIONAL) Corregir personal que debería ser planta
-- Solo ejecutar si el diagnóstico del PASO 1 muestra resultados.
-- ─────────────────────────────────────────────────────────────

/*
-- Actualizar area en personal si el snapshot dice planta
UPDATE personal p
SET area = sub.correct_area
FROM (
  SELECT DISTINCT
    nr.personal_id,
    nr.personal_snapshot->>'area' AS correct_area
  FROM nomina_registros nr
  JOIN nomina_semanas ns ON nr.semana_id = ns.id
  WHERE nr.origen = 'import_historico'
    AND ns.area = 'mina'
    AND nr.personal_snapshot->>'area' IN ('planta', 'administracion')
) sub
WHERE p.id = sub.personal_id
  AND p.area = 'mina'  -- Solo corregir los que están mal
  AND sub.correct_area IS NOT NULL;
*/

-- ─────────────────────────────────────────────────────────────
-- PASO 3: (OPCIONAL) Crear semanas separadas para planta
-- Este paso es más complejo. Solo ejecutar si el PASO 1
-- confirma que hay mezcla de áreas.
-- ─────────────────────────────────────────────────────────────

/*
-- Ver semanas que tienen registros mezclados (mina + planta)
SELECT
  ns.id AS semana_id,
  ns.semana_inicio,
  ns.area AS semana_area,
  COUNT(DISTINCT nr.personal_snapshot->>'area') AS areas_distintas
FROM nomina_semanas ns
JOIN nomina_registros nr ON nr.semana_id = ns.id
WHERE ns.origen = 'import_historico'
  AND ns.area = 'mina'
GROUP BY ns.id, ns.semana_inicio, ns.area
HAVING COUNT(DISTINCT nr.personal_snapshot->>'area') > 1
ORDER BY ns.semana_inicio DESC;
*/

-- ─────────────────────────────────────────────────────────────
-- NOTAS
-- ─────────────────────────────────────────────────────────────
-- 1. Los imports futuros ya están corregidos en el código (v2.0).
-- 2. Los datos existentes pueden dejarse "as-is" si los totales
--    globales son correctos y no se necesita separación por área.
-- 3. La vista previa ahora usa personal_snapshot.area para
--    determinar la sección correcta (bug #3 fix).
-- ─────────────────────────────────────────────────────────────
