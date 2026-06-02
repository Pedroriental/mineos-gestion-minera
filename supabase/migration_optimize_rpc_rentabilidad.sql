-- =============================================================
-- MineOS - Optimización: RPC get_rentabilidad con CTE
--
-- Convierte 5 SELECTs secuenciales en un solo CTE,
-- reduciendo los scans de tablas de 5 a 1.
-- =============================================================

CREATE OR REPLACE FUNCTION get_rentabilidad(periodo_dias integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha_inicio date;
  result json;
BEGIN
  v_fecha_inicio := current_date - (periodo_dias || ' days')::interval;

  WITH
    prod AS (
      SELECT
        COALESCE(SUM(oro_recuperado_g), 0) AS oro_planta,
        COALESCE(SUM(sacos), 0)::integer AS sacos,
        COALESCE(SUM(toneladas_procesadas), 0) AS ton,
        COUNT(DISTINCT fecha)::integer AS prod_days
      FROM reportes_produccion
      WHERE fecha >= v_fecha_inicio
    ),
    quemado AS (
      SELECT
        COALESCE(SUM(total_oro_g), 0) AS oro_quemado,
        COALESCE(SUM(total_amalgama_g), 0) AS amalgama
      FROM reportes_quemado
      WHERE fecha >= v_fecha_inicio
    ),
    gastos_totales AS (
      SELECT COALESCE(SUM(monto), 0) AS total
      FROM gastos
      WHERE fecha >= v_fecha_inicio
    ),
    precio AS (
      SELECT COALESCE(precio_usd_por_gramo, 99.68) AS gramo
      FROM precio_oro_cache
      ORDER BY fecha DESC
      LIMIT 1
    )
  SELECT json_build_object(
    'periodo_dias',       periodo_dias,
    'fecha_inicio',       v_fecha_inicio,
    'fecha_fin',          current_date,
    'dias_con_produccion', prod.prod_days,
    'oro_planta_g',       ROUND(prod.oro_planta, 4),
    'oro_quemado_g',      ROUND(quemado.oro_quemado, 4),
    'amalgama_total_g',   ROUND(quemado.amalgama, 2),
    'sacos_total',        prod.sacos,
    'ton_procesadas',     ROUND(prod.ton, 3),
    'ley_cabeza_gpt',     CASE WHEN prod.ton > 0 THEN ROUND(prod.oro_planta / prod.ton, 4) ELSE 0 END,
    'prom_diario_g',      CASE WHEN prod.prod_days > 0 THEN ROUND(prod.oro_planta / prod.prod_days, 2) ELSE 0 END,
    'precio_usd_gramo',   ROUND(precio.gramo, 2),
    'ingreso_bruto_usd',  ROUND(GREATEST(quemado.oro_quemado, prod.oro_planta) * precio.gramo, 2),
    'gastos_total_usd',   ROUND(gastos_totales.total, 2),
    'ganancia_usd',       ROUND(GREATEST(quemado.oro_quemado, prod.oro_planta) * precio.gramo - gastos_totales.total, 2),
    'margen_pct',         CASE WHEN GREATEST(quemado.oro_quemado, prod.oro_planta) * precio.gramo > 0
                            THEN ROUND(((GREATEST(quemado.oro_quemado, prod.oro_planta) * precio.gramo - gastos_totales.total) / (GREATEST(quemado.oro_quemado, prod.oro_planta) * precio.gramo)) * 100, 2)
                            ELSE 0 END,
    'es_rentable',        GREATEST(quemado.oro_quemado, prod.oro_planta) * precio.gramo > gastos_totales.total,
    'costo_por_gramo',    CASE WHEN prod.oro_planta > 0 THEN ROUND(gastos_totales.total / prod.oro_planta, 2) ELSE 0 END
  ) INTO result
  FROM prod, quemado, gastos_totales, precio;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rentabilidad(integer) TO authenticated;
