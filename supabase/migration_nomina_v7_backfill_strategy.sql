-- ============================================================================
-- ESTRATEGIA DE MIGRACIÓN DE DATOS EXISTENTES A CICLOS
-- ============================================================================
--
-- PREGUNTA CLAVE:
-- ¿Migramos las semanas históricas ya cerradas al formato de ciclos,
-- o hacemos un "corte limpio" y empezamos ciclos desde el próximo periodo?
--
-- RECOMENDACIÓN: CORTE LIMPIO + BACKFILL SELECTIVO
--
-- Razones:
-- 1. Las semanas ya cerradas tienen integridad financiera validada
--    (triggers trg_nomina_gasto_integrity ya verificaron consistencia).
-- 2. Forzar un backfill masivo de ciclos sobre datos cerrados puede
--    romper la relación con gastos ya contabilizados.
-- 3. Los reportes históricos (NominaPreviewReport) ya funcionan con
--    semanas sueltas — no necesitan ciclos para renderizar.
-- 4. Los ciclos son una capa de AGRUPACIÓN, no reemplazan las semanas.
--    Las semanas siguen siendo la unidad atómica de cierre.
--
-- ============================================================================
-- FASE A: CORTE LIMPIO (se ejecuta inmediatamente)
-- ============================================================================
--
-- Paso 1: Ejecutar las migraciones en orden:
--   1. migration_nomina_v7_perfiles_compensacion.sql
--   2. migration_nomina_v7_ciclos.sql
--   3. migration_nomina_v7_alter_personal.sql
--   4. migration_nomina_v7_alter_registros.sql
--   5. migration_nomina_v7_bonos.sql
--   6. migration_nomina_v7_finiquitos.sql
--   7. migration_nomina_v7_ajustes.sql
--   8. migration_nomina_v7_seed_data.sql
--
-- Paso 2: Todas las semanas existentes permanecen con ciclo_id = NULL.
--         Esto es válido y no rompe nada existente.
--
-- Paso 3: A partir del próximo lunes, el cierre de nómina V3
--         (procesarCierreNominaV3Action) creará ciclos automáticamente
--         para trabajadores con perfil de rotación 14x7.
--
-- ============================================================================
-- FASE B: BACKFILL SELECTIVO (opcional, para reportes históricos)
-- ============================================================================
--
-- Si se desea que los reportes históricos muestren la agrupación por ciclos,
-- se puede ejecutar el siguiente script DESPUÉS de verificar que no hay
-- semanas abiertas en el periodo a backfillear.
--
-- El backfill agrupa semanas de 3 en 3 para trabajadores con MINA_2X1
-- y crea los ciclos correspondientes en retrospectiva.
--
-- IMPORTANTE: Este script es IDEMPOTENTE — puede ejecutarse múltiples veces
-- sin duplicar datos gracias a las restricciones UNIQUE.
-- ============================================================================

-- Script de backfill (ejecutar solo si se desea histórico con ciclos):

DO $$
DECLARE
    v_perfil_14x7 UUID;
    v_perfil_3g UUID;
    v_ciclo RECORD;
    v_semana RECORD;
    v_ciclo_id UUID;
    v_posicion SMALLINT;
    v_weeks_in_cycle SMALLINT;
    v_existing_count INTEGER;
BEGIN
    -- Obtener IDs de perfiles de rotación
    SELECT id INTO v_perfil_14x7 FROM perfiles_compensacion WHERE nombre = 'Operativo Mina 14x7';
    SELECT id INTO v_perfil_3g FROM perfiles_compensacion WHERE nombre = 'Operativo Mina 3 Grupos';
    
    -- Solo procesar si existen los perfiles
    IF v_perfil_14x7 IS NULL AND v_perfil_3g IS NULL THEN
        RAISE NOTICE 'No se encontraron perfiles de rotación. Ejecute primero el seed data.';
        RETURN;
    END IF;
    
    -- ========================================================================
    -- BACKFILL PARA MINA (rotación 14x7 = ciclos de 3 semanas)
    -- ========================================================================
    
    -- Agrupar semanas cerradas de mina en bloques de 3
    -- Solo para semanas que NO tienen ciclo_id aún
    FOR v_ciclo IN
        SELECT 
            ns.area,
            MIN(ns.semana_inicio) AS ciclo_inicio,
            MAX(ns.semana_inicio) + INTERVAL '6 days' AS ciclo_fin,
            ARRAY_AGG(ns.id ORDER BY ns.semana_inicio) AS semana_ids
        FROM nomina_semanas ns
        WHERE ns.area = 'mina'
        AND NOT EXISTS (
            SELECT 1 FROM nomina_ciclo_semanas ncs WHERE ncs.semana_id = ns.id
        )
        GROUP BY ns.area, (EXTRACT(EPOCH FROM ns.semana_inicio)::INTEGER / (21 * 86400))
        HAVING COUNT(*) = 3
        ORDER BY MIN(ns.semana_inicio)
    LOOP
        -- Crear el ciclo
        INSERT INTO nomina_ciclos (
            label, fecha_inicio, fecha_fin,
            perfil_compensacion_id, area,
            total_ciclo_usd, total_trabajadores,
            estado, creado_por
        )
        SELECT
            'Ciclo Mina ' || TO_CHAR(v_ciclo.ciclo_inicio, 'DD/MM/YYYY') || ' - ' || TO_CHAR(v_ciclo.ciclo_fin, 'DD/MM/YYYY'),
            v_ciclo.ciclo_inicio,
            v_ciclo.ciclo_fin,
            COALESCE(v_perfil_14x7, v_perfil_3g),
            v_ciclo.area,
            COALESCE(SUM(nr.monto_pagado), 0),
            COUNT(DISTINCT nr.personal_id),
            'CERRADO',
            NULL
        FROM nomina_semanas ns
        LEFT JOIN nomina_registros nr ON nr.semana_id = ns.id
        WHERE ns.id = ANY(v_ciclo.semana_ids)
        RETURNING id INTO v_ciclo_id;
        
        -- Vincular semanas al ciclo con posición
        v_posicion := 0;
        FOREACH v_semana IN ARRAY v_ciclo.semana_ids
        LOOP
            -- Determinar rol basado en posición
            -- Para MINA_2X1: posición 0 = libre, 1 y 2 = trabajada
            INSERT INTO nomina_ciclo_semanas (ciclo_id, semana_id, posicion_en_ciclo, rol_semana)
            VALUES (
                v_ciclo_id,
                v_semana,
                v_posicion,
                CASE 
                    WHEN v_posicion = 0 THEN 'libre'
                    ELSE 'trabajada'
                END
            )
            ON CONFLICT (semana_id) DO NOTHING;
            
            -- Actualizar nomina_registros con ciclo_id y posición
            UPDATE nomina_registros
            SET 
                ciclo_id = v_ciclo_id,
                posicion_en_ciclo = v_posicion
            WHERE semana_id = v_semana
            AND ciclo_id IS NULL;
            
            v_posicion := v_posicion + 1;
        END LOOP;
        
        RAISE NOTICE 'Ciclo creado: % (semanas: %)', v_ciclo_id, array_length(v_ciclo.semana_ids, 1);
    END LOOP;
    
    RAISE NOTICE 'Backfill completado para mina.';
    
END $$;

-- ============================================================================
-- VERIFICACIÓN POST-BACKFILL
-- ============================================================================
-- Ejecutar estas queries para validar la integridad del backfill:

-- 1. Contar ciclos creados
-- SELECT COUNT(*) AS total_ciclos FROM nomina_ciclos;

-- 2. Verificar que total_ciclo_usd coincide con suma de registros
-- SELECT 
--     nc.id, nc.label, nc.total_ciclo_usd,
--     COALESCE(SUM(nr.monto_pagado), 0) AS suma_registros,
--     nc.total_ciclo_usd - COALESCE(SUM(nr.monto_pagado), 0) AS diferencia
-- FROM nomina_ciclos nc
-- LEFT JOIN nomina_ciclo_semanas ncs ON ncs.ciclo_id = nc.id
-- LEFT JOIN nomina_registros nr ON nr.semana_id = ncs.semana_id
-- GROUP BY nc.id, nc.label, nc.total_ciclo_usd
-- HAVING nc.total_ciclo_usd != COALESCE(SUM(nr.monto_pagado), 0);

-- 3. Verificar que no hay semanas duplicadas en ciclos
-- SELECT semana_id, COUNT(*) 
-- FROM nomina_ciclo_semanas 
-- GROUP BY semana_id 
-- HAVING COUNT(*) > 1;

-- 4. Semanas de mina sin ciclo (deberían ser solo las que no completan 3)
-- SELECT COUNT(*) AS semanas_sin_ciclo
-- FROM nomina_semanas ns
-- WHERE ns.area = 'mina'
-- AND NOT EXISTS (SELECT 1 FROM nomina_ciclo_semanas ncs WHERE ncs.semana_id = ns.id);
