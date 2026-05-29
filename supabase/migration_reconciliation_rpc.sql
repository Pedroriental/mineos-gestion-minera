-- RPC agregado para balance operativo (reconciliación)

CREATE OR REPLACE FUNCTION get_balance_operativo(
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL,
  p_molino text DEFAULT NULL,
  p_mina text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desde date := COALESCE(p_desde, current_date - 30);
  v_hasta date := COALESCE(p_hasta, current_date);
  v_oro_planta numeric := 0;
  v_oro_quemado numeric := 0;
  v_sacos_ext integer := 0;
  v_sacos_prod integer := 0;
  v_ton numeric := 0;
  v_gastos numeric := 0;
  v_nomina_reg numeric := 0;
  v_nomina_sem numeric := 0;
  v_arenas numeric := 0;
  v_precio numeric := 99.68;
BEGIN
  SELECT COALESCE(SUM(oro_recuperado_g), 0), COALESCE(SUM(sacos), 0), COALESCE(SUM(toneladas_procesadas), 0)
  INTO v_oro_planta, v_sacos_prod, v_ton
  FROM reportes_produccion
  WHERE fecha BETWEEN v_desde AND v_hasta
    AND (p_molino IS NULL OR molino = p_molino);

  SELECT COALESCE(SUM(total_oro_g), 0)
  INTO v_oro_quemado
  FROM reportes_quemado
  WHERE fecha BETWEEN v_desde AND v_hasta;

  SELECT COALESCE(SUM(sacos_extraidos), 0)::integer
  INTO v_sacos_ext
  FROM reportes_extraccion
  WHERE fecha BETWEEN v_desde AND v_hasta
    AND (p_mina IS NULL OR mina = p_mina);

  SELECT COALESCE(SUM(monto), 0) INTO v_gastos FROM gastos WHERE fecha BETWEEN v_desde AND v_hasta;

  SELECT COALESCE(SUM(nr.monto_pagado), 0)
  INTO v_nomina_reg
  FROM nomina_registros nr
  JOIN nomina_semanas ns ON ns.id = nr.semana_id
  WHERE ns.semana_inicio BETWEEN v_desde AND v_hasta;

  SELECT COALESCE(SUM(total_pagado), 0) INTO v_nomina_sem
  FROM nomina_semanas WHERE semana_inicio BETWEEN v_desde AND v_hasta;

  SELECT COALESCE(SUM(total_venta), 0) INTO v_arenas FROM venta_arenas WHERE fecha BETWEEN v_desde AND v_hasta;

  SELECT COALESCE(precio_usd_por_gramo, 99.68) INTO v_precio
  FROM precio_oro_cache ORDER BY fecha DESC LIMIT 1;

  RETURN json_build_object(
    'fecha_inicio', v_desde,
    'fecha_fin', v_hasta,
    'oro_planta_g', ROUND(v_oro_planta::numeric, 4),
    'oro_quemado_g', ROUND(v_oro_quemado::numeric, 4),
    'sacos_extraccion', v_sacos_ext,
    'sacos_produccion', v_sacos_prod,
    'ton_procesadas', ROUND(v_ton::numeric, 3),
    'gastos_usd', ROUND(v_gastos::numeric, 2),
    'nomina_registros_usd', ROUND(v_nomina_reg::numeric, 2),
    'nomina_semanas_usd', ROUND(v_nomina_sem::numeric, 2),
    'ventas_arenas_usd', ROUND(v_arenas::numeric, 2),
    'precio_oro_usd', ROUND(v_precio::numeric, 2),
    'ingreso_oro_usd', ROUND((v_oro_planta * v_precio)::numeric, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_balance_operativo(date, date, text, text) TO anon, authenticated;
