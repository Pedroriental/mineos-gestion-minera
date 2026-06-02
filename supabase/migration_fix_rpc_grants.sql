-- =============================================================
-- MineOS - Migration: Seguridad en RPCs
--
-- Cambia GRANT EXECUTE de TO anon, authenticated a solo
-- TO authenticated para todas las funciones RPC que exponen
-- datos financieros y de nómina.
-- =============================================================

DO $$
DECLARE
  fn text;
  sigs text[] := ARRAY[
    'get_nomina_historico_semanal(text)',
    'get_vales_pendientes(uuid)',
    'marcar_vales_cobrados(uuid[])',
    'get_historial_pagos_trabajador(uuid,integer)',
    'get_tendencia_semanal(text,integer)',
    'get_rentabilidad(integer)',
    'get_rentabilidad(date,date)',
    'get_produccion_diaria(integer)',
    'get_produccion_diaria(date,date)',
    'get_gastos_por_categoria(integer)',
    'get_gastos_por_categoria(date,date)',
    'get_balance_operativo(date,date,text,text)'
  ];
BEGIN
  FOREACH fn IN ARRAY sigs LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Function % does not exist, skipping', fn;
    END;
  END LOOP;
END $$;
