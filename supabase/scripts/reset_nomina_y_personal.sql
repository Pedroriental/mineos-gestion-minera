-- ============================================================================
-- MineOS — Reset de nómina V7 y base de trabajadores
-- Ejecutar en Supabase > SQL Editor (entorno de pruebas / limpieza controlada)
--
-- Vacía tablas de ciclos, registros, personal y perfiles obsoletos.
-- Inserta únicamente los 2 perfiles de compensación vigentes.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tablas dependientes (FK hacia nomina_registros / nomina_ciclos / personal)
-- ---------------------------------------------------------------------------
DELETE FROM nomina_bonos_aplicados;
DELETE FROM nomina_ajustes;
DELETE FROM nomina_finiquitos;

-- ---------------------------------------------------------------------------
-- 2. Ciclos de 21 días (orden: junction → ciclos)
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

-- Legacy (si existe en el proyecto)
DELETE FROM nomina_pagos WHERE TRUE;

-- ---------------------------------------------------------------------------
-- 5. Maestro de trabajadores
-- ---------------------------------------------------------------------------
DELETE FROM personal;

-- ---------------------------------------------------------------------------
-- 6. Perfiles de compensación (elimina esquemas obsoletos: Molino rotativo, etc.)
-- ---------------------------------------------------------------------------
DELETE FROM perfiles_compensacion;

-- ---------------------------------------------------------------------------
-- 7. Seed: únicamente los 2 perfiles reales
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
    'Personal administrativo y molinos con tarifa fija semanal. Sin ciclo de rotación 14x7.',
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
    'Personal operativo de mina: ciclo cerrado de 21 días (1 semana libre + 2 trabajadas).',
    'MINA_2X1',
    'TARIFA_PLANA',
    'PAGO_COMPLETO',
    21,
    2,
    1,
    '[]'::JSONB,
    '{}'::JSONB,
    true
);

COMMIT;

-- Verificación rápida
SELECT 'perfiles_compensacion' AS tabla, COUNT(*) AS filas FROM perfiles_compensacion
UNION ALL
SELECT 'personal', COUNT(*) FROM personal
UNION ALL
SELECT 'nomina_registros', COUNT(*) FROM nomina_registros
UNION ALL
SELECT 'nomina_ciclos', COUNT(*) FROM nomina_ciclos
UNION ALL
SELECT 'nomina_ciclo_semanas', COUNT(*) FROM nomina_ciclo_semanas;
