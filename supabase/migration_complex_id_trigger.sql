-- ============================================================
-- MIGRACIÓN: Trigger auto-complex_id en INSERTs
-- 
-- Problema: 40 de 41 server actions no asignan complex_id al
-- insertar registros. RLS bloquea silenciosamente para
-- admin/supervisor (NULL != uuid). admin_developer inserta
-- con NULL, creando datos huérfanos invisibles para otros.
--
-- Solución: BEFORE INSERT trigger que asigna
-- complex_id = public.user_complex_id() cuando es NULL.
-- Para admin_developer (complex_id NULL en JWT), queda NULL.
-- Para admin/supervisor, queda su complex_id del JWT.
-- ============================================================

-- 1. Función del trigger
CREATE OR REPLACE FUNCTION set_complex_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.complex_id IS NULL THEN
    NEW.complex_id = public.user_complex_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Lista de tablas operativas con complex_id
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'personal',
    'perfiles_compensacion',
    'personal_import_aliases',
    'nomina_pagos',
    'nomina_semanas',
    'nomina_registros',
    'nomina_cierres',
    'nomina_periodos',
    'nomina_periodo_semanas',
    'nomina_mes_periodos',
    'nomina_ciclos',
    'nomina_ciclo_semanas',
    'nomina_vales',
    'nomina_audit_log',
    'gastos',
    'categorias_gasto',
    'gasto_conceptos',
    'compras_programadas',
    'balance_diario',
    'equipos',
    'equipos_historial',
    'inventario_items',
    'inventario_movimientos',
    'reportes_produccion',
    'reportes_extraccion',
    'reportes_quemado',
    'reportes_voladuras',
    'reportes_acarreo',
    'procesamiento_planta',
    'recepcion_material',
    'venta_arenas',
    'lineas_plancha',
    'libro_guardia',
    'mejoras_seguridad',
    'rotacion_plantillas',
    'rotacion_plantilla_cuadrillas',
    'rotacion_plantilla_semanas',
    'rotacion_plantilla_asignaciones',
    'rotacion_plantilla_instancias',
    'rotacion_instancia_cuadrillas',
    'rotacion_instancia_semanas',
    'nominas_cargadas',
    'detalles_nomina'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS set_complex_id_before_insert_%s ON %I',
        t, t
      );
      EXECUTE format(
        'CREATE TRIGGER set_complex_id_before_insert_%s '
        'BEFORE INSERT ON %I '
        'FOR EACH ROW EXECUTE FUNCTION set_complex_id_on_insert()',
        t, t
      );
      RAISE NOTICE 'Trigger creado en tabla %', t;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'Tabla % no existe, saltando', t;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error en tabla %: %', t, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 3. Backfill: registros existentes con complex_id NULL
-- Asigna al complejo por defecto (La Fé / antigua Mina Belén)
DO $$
DECLARE
  default_complex_id UUID;
  t TEXT;
  tables TEXT[] := ARRAY[
    'personal',
    'perfiles_compensacion',
    'personal_import_aliases',
    'nomina_pagos',
    'nomina_semanas',
    'nomina_registros',
    'nomina_cierres',
    'nomina_periodos',
    'nomina_ciclos',
    'nomina_ciclo_semanas',
    'nomina_vales',
    'gastos',
    'categorias_gasto',
    'gasto_conceptos',
    'compras_programadas',
    'balance_diario',
    'equipos',
    'equipos_historial',
    'inventario_items',
    'inventario_movimientos',
    'reportes_produccion',
    'reportes_extraccion',
    'reportes_quemado',
    'reportes_voladuras',
    'reportes_acarreo',
    'procesamiento_planta',
    'recepcion_material',
    'venta_arenas',
    'lineas_plancha',
    'libro_guardia',
    'mejoras_seguridad',
    'rotacion_plantillas',
    'rotacion_plantilla_cuadrillas',
    'rotacion_plantilla_semanas',
    'rotacion_plantilla_asignaciones',
    'rotacion_plantilla_instancias',
    'rotacion_instancia_cuadrillas',
    'rotacion_instancia_semanas',
    'nominas_cargadas',
    'detalles_nomina'
  ];
  updated_count INTEGER;
BEGIN
  SELECT id INTO default_complex_id FROM complexes LIMIT 1;
  IF default_complex_id IS NULL THEN
    RAISE NOTICE 'No hay complejos en la BD, saltando backfill';
    RETURN;
  END IF;
  
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format(
        'UPDATE %I SET complex_id = $1 WHERE complex_id IS NULL',
        t
      ) USING default_complex_id;
      GET DIAGNOSTICS updated_count = ROW_COUNT;
      IF updated_count > 0 THEN
        RAISE NOTICE 'Backfill %: % filas actualizadas', t, updated_count;
      END IF;
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error backfill %: %', t, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 4. Tablas biblioteca/fiscal (también necesitan complex_id en INSERT)
-- Estas tablas tienen RLS diferente (cualquier autenticado puede leer,
-- solo admin/admin_developer pueden escribir)
DO $$
DECLARE
  t TEXT;
  bf_tables TEXT[] := ARRAY[
    'biblioteca_categorias',
    'biblioteca_variables',
    'fiscal_entidades',
    'fiscal_representantes',
    'fiscal_cuentas_bancarias',
    'fiscal_textos_legales',
    'fiscal_parametros'
  ];
BEGIN
  FOREACH t IN ARRAY bf_tables LOOP
    BEGIN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS set_complex_id_before_insert_%s ON %I',
        t, t
      );
      EXECUTE format(
        'CREATE TRIGGER set_complex_id_before_insert_%s '
        'BEFORE INSERT ON %I '
        'FOR EACH ROW EXECUTE FUNCTION set_complex_id_on_insert()',
        t, t
      );
      RAISE NOTICE 'Trigger creado en tabla %', t;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'Tabla % no existe, saltando', t;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error en tabla %: %', t, SQLERRM;
    END;
  END LOOP;
END;
$$;
