-- ============================================================================
-- MineOS — Reset de nómina V7 y base de trabajadores
-- Ejecutar en Supabase > SQL Editor (entorno de pruebas / limpieza controlada)
--
-- Vacía tablas de ciclos, registros, personal y perfiles obsoletos.
-- Inserta los 3 perfiles de compensación vigentes.
-- ============================================================================

BEGIN;

-- Esquema MOLINO_14X14 (idempotente si ya se aplicó migration_nomina_v8_molino_14x14.sql)
ALTER TABLE perfiles_compensacion
  DROP CONSTRAINT IF EXISTS perfiles_compensacion_esquema_rotacion_default_check;
ALTER TABLE perfiles_compensacion
  ADD CONSTRAINT perfiles_compensacion_esquema_rotacion_default_check
  CHECK (esquema_rotacion_default IN (
    'FIJO_SEMANAL', 'MINA_2X1', 'MOLINO_FIJO', 'MOLINO_ROTATIVO',
    'MINA_ROTATIVA_3G', 'MOLINO_15X15', 'MOLINO_14X14'
  ));

ALTER TABLE personal
  DROP CONSTRAINT IF EXISTS personal_esquema_rotacion_check;
ALTER TABLE personal
  ADD CONSTRAINT personal_esquema_rotacion_check
  CHECK (esquema_rotacion IN (
    'FIJO_SEMANAL', 'MINA_2X1', 'MOLINO_FIJO', 'MOLINO_ROTATIVO',
    'MINA_ROTATIVA_3G', 'MOLINO_15X15', 'MOLINO_14X14'
  ));

-- ---------------------------------------------------------------------------
-- 1. Tablas dependientes (FK hacia nomina_registros / nomina_ciclos / personal)
-- ---------------------------------------------------------------------------
DELETE FROM nomina_bonos_aplicados;
DELETE FROM nomina_ajustes;
DELETE FROM nomina_finiquitos;

-- ---------------------------------------------------------------------------
-- 2. Ciclos (orden: junction → ciclos)
-- ---------------------------------------------------------------------------
DELETE FROM nomina_ciclo_semanas;
DELETE FROM nomina_ciclos;

-- ---------------------------------------------------------------------------
-- 3. Registros de nómina semanal
-- ---------------------------------------------------------------------------
DELETE FROM nomina_registros;

-- ---------------------------------------------------------------------------
-- 4. Vales / adelantos y alias de importación (referencian personal)
-- ---------------------------------------------------------------------------
DELETE FROM nomina_vales;
DELETE FROM personal_import_aliases;

DELETE FROM nomina_pagos WHERE TRUE;

-- ---------------------------------------------------------------------------
-- 5. Maestro de trabajadores
-- ---------------------------------------------------------------------------
DELETE FROM personal;

-- ---------------------------------------------------------------------------
-- 6. Perfiles de compensación
-- ---------------------------------------------------------------------------
DELETE FROM perfiles_compensacion;

-- ---------------------------------------------------------------------------
-- 7. Seed: 3 perfiles vigentes
-- ---------------------------------------------------------------------------
INSERT INTO perfiles_compensacion (
    nombre,
    descripcion,
    esquema_rotacion_default,
    politica_dia_libre,
    politica_reposo,
    duracion_ciclo_dias,
    semanas_trabajadas_por_ciclo,
    semanas_libres_por_ciclo,
    bonos_automaticos,
    multiplicadores,
    activo
) VALUES
(
    'Administrativo / Fijo Semanal',
    'Personal administrativo. Tarifa fija semanal sin ciclo de rotación.',
    'FIJO_SEMANAL',
    'SIN_PAGO',
    'PARCIAL',
    7,
    1,
    0,
    '[]'::JSONB,
    '{}'::JSONB,
    true
),
(
    'Operativo Mina 14x7',
    'Ciclo de 21 días: 1 semana libre (tarifa plana) + 2 semanas trabajadas prorrateadas.',
    'MINA_2X1',
    'TARIFA_PLANA',
    'PAGO_COMPLETO',
    21,
    2,
    1,
    '[]'::JSONB,
    '{}'::JSONB,
    true
),
(
    'Operativo Molinos 14x14',
    'Ciclo de 28 días (4 semanas): semana 0 libre pagada, semana 1 libre $0, semanas 2-3 trabajadas prorrateadas.',
    'MOLINO_14X14',
    'TARIFA_PLANA',
    'PARCIAL',
    28,
    2,
    2,
    '[]'::JSONB,
    '{}'::JSONB,
    true
);

COMMIT;

SELECT 'perfiles_compensacion' AS tabla, COUNT(*) AS filas FROM perfiles_compensacion
UNION ALL
SELECT 'personal', COUNT(*) FROM personal
UNION ALL
SELECT 'nomina_registros', COUNT(*) FROM nomina_registros
UNION ALL
SELECT 'nomina_ciclos', COUNT(*) FROM nomina_ciclos
UNION ALL
SELECT 'nomina_ciclo_semanas', COUNT(*) FROM nomina_ciclo_semanas;
