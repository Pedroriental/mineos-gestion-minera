-- =============================================================
-- MineOS - RPCs de Rentabilidad y Producción Diaria
-- Ejecutar completo en Supabase > SQL Editor
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- RPC 1: get_rentabilidad(periodo_dias)
--   Devuelve un JSON con el resumen financiero y productivo
--   del período solicitado.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_rentabilidad(periodo_dias integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER          -- Ejecuta como owner: accede a todas las tablas
SET search_path = public
AS $$
DECLARE
  v_fecha_inicio    date    := current_date - (periodo_dias || ' days')::interval;
  v_oro_planta      numeric := 0;
  v_sacos_total     integer := 0;
  v_ton_total       numeric := 0;
  v_quemado_oro     numeric := 0;
  v_quemado_amalg   numeric := 0;
  v_gastos_total    numeric := 0;
  v_precio_gramo    numeric := 99.68;   -- fallback si no hay precio en caché
  v_ingreso_bruto   numeric;
  v_ganancia        numeric;
  v_margen_pct      numeric;
  v_prod_days       integer;
BEGIN
  -- 1) Producción de planta (molino)
  SELECT
    COALESCE(SUM(oro_recuperado_g),   0),
    COALESCE(SUM(sacos),              0)::integer,
    COALESCE(SUM(toneladas_procesadas), 0)
  INTO v_oro_planta, v_sacos_total, v_ton_total
  FROM reportes_produccion
  WHERE fecha >= v_fecha_inicio;

  -- 2) Oro confirmado por quemadas (dato real de venta)
  SELECT
    COALESCE(SUM(total_oro_g),      0),
    COALESCE(SUM(total_amalgama_g), 0)
  INTO v_quemado_oro, v_quemado_amalg
  FROM reportes_quemado
  WHERE fecha >= v_fecha_inicio;

  -- 3) Gastos totales del período
  SELECT COALESCE(SUM(monto), 0)
  INTO v_gastos_total
  FROM gastos
  WHERE fecha >= v_fecha_inicio;

  -- 4) Precio del oro más reciente disponible en caché
  SELECT COALESCE(precio_usd_por_gramo, 99.68)
  INTO v_precio_gramo
  FROM precio_oro_cache
  ORDER BY fecha DESC
  LIMIT 1;

  -- 5) Días distintos con producción
  SELECT COUNT(DISTINCT fecha)::integer
  INTO v_prod_days
  FROM reportes_produccion
  WHERE fecha >= v_fecha_inicio;

  -- 6) Cálculos financieros
  --    Si hay quemadas usamos ese dato (es el oro real vendido),
  --    si no, usamos la producción de planta.
  v_ingreso_bruto := GREATEST(v_quemado_oro, v_oro_planta) * v_precio_gramo;
  v_ganancia      := v_ingreso_bruto - v_gastos_total;
  v_margen_pct    := CASE
                       WHEN v_ingreso_bruto > 0
                       THEN ROUND((v_ganancia / v_ingreso_bruto) * 100, 2)
                       ELSE 0
                     END;

  RETURN json_build_object(
    -- Metadatos
    'periodo_dias',       periodo_dias,
    'fecha_inicio',       v_fecha_inicio,
    'fecha_fin',          current_date,
    'dias_con_produccion', v_prod_days,
    -- Producción
    'oro_planta_g',       ROUND(v_oro_planta::numeric,    4),
    'oro_quemado_g',      ROUND(v_quemado_oro::numeric,   4),
    'amalgama_total_g',   ROUND(v_quemado_amalg::numeric, 2),
    'sacos_total',        v_sacos_total,
    'ton_procesadas',     ROUND(v_ton_total::numeric,     3),
    'ley_cabeza_gpt',     CASE WHEN v_ton_total > 0
                            THEN ROUND(v_oro_planta / v_ton_total, 4)
                            ELSE 0 END,
    'prom_diario_g',      CASE WHEN v_prod_days > 0
                            THEN ROUND(v_oro_planta / v_prod_days, 2)
                            ELSE 0 END,
    -- Financiero
    'precio_usd_gramo',   ROUND(v_precio_gramo::numeric,  2),
    'ingreso_bruto_usd',  ROUND(v_ingreso_bruto::numeric, 2),
    'gastos_total_usd',   ROUND(v_gastos_total::numeric,  2),
    'ganancia_usd',       ROUND(v_ganancia::numeric,      2),
    'margen_pct',         v_margen_pct,
    'es_rentable',        v_ganancia > 0,
    'costo_por_gramo',    CASE WHEN v_oro_planta > 0
                            THEN ROUND(v_gastos_total / v_oro_planta, 2)
                            ELSE 0 END
  );
END;
$$;

-- Acceso: anon para que el server component sin JWT pueda llamarlo
GRANT EXECUTE ON FUNCTION get_rentabilidad(integer) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- RPC 2: get_produccion_diaria(periodo_dias)
--   Devuelve una tabla con agregados por día, ordenados ASC.
--   Ideal para el area chart del resumen ejecutivo.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_produccion_diaria(periodo_dias integer DEFAULT 30)
RETURNS TABLE (
  fecha      date,
  oro_g      numeric,
  sacos      integer,
  ton        numeric,
  turnos     integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rp.fecha,
    ROUND(SUM(rp.oro_recuperado_g)::numeric,    4)  AS oro_g,
    SUM(rp.sacos)::integer                          AS sacos,
    ROUND(SUM(rp.toneladas_procesadas)::numeric, 3) AS ton,
    COUNT(*)::integer                               AS turnos
  FROM reportes_produccion rp
  WHERE rp.fecha >= current_date - (periodo_dias || ' days')::interval
  GROUP BY rp.fecha
  ORDER BY rp.fecha ASC;
$$;

GRANT EXECUTE ON FUNCTION get_produccion_diaria(integer) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- RPC 3: get_gastos_por_categoria(periodo_dias)
--   Devuelve el desglose de gastos agrupado por categoría.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_gastos_por_categoria(periodo_dias integer DEFAULT 30)
RETURNS TABLE (
  categoria   text,
  total_usd   numeric,
  pct         numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH totals AS (
    SELECT
      COALESCE(cg.nombre, 'Sin categoría') AS categoria,
      COALESCE(SUM(g.monto), 0)            AS total_usd
    FROM gastos g
    LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_id
    WHERE g.fecha >= current_date - (periodo_dias || ' days')::interval
    GROUP BY cg.nombre
  ),
  grand AS (
    SELECT COALESCE(SUM(total_usd), 1) AS gran_total FROM totals
  )
  SELECT
    t.categoria,
    ROUND(t.total_usd::numeric, 2) AS total_usd,
    ROUND((t.total_usd / g.gran_total * 100)::numeric, 1) AS pct
  FROM totals t, grand g
  ORDER BY t.total_usd DESC;
$$;

GRANT EXECUTE ON FUNCTION get_gastos_por_categoria(integer) TO anon, authenticated;
