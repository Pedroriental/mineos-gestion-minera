-- =============================================================
-- MineOS - RPC: execute_dynamic_report
-- Motor universal de consultas dinámicas para reportes cruzados.
-- Acepta un payload JSON con módulos, filtros y agrupación.
-- =============================================================

CREATE OR REPLACE FUNCTION execute_dynamic_report(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from  date;
  v_date_to    date;
  v_modules    text[];
  v_filters    jsonb;
  v_group_by   text;
  v_cross      jsonb;   -- crossModuleJoin
  v_module     text;
  v_table      text;
  v_date_col   text;
  v_where      text;
  v_select     text;
  v_group_expr text;
  v_label_expr text;
  v_sql        text;
  v_result     jsonb;
  v_results    jsonb := '{}'::jsonb;
  v_module_key text;
  v_filter     jsonb;
  v_col        text;
  v_cond       text;
  v_parts      text[];
  v_val        text;
  v_col_type   text;
  v_join       text;
BEGIN
  -- Validar campos obligatorios
  v_date_from := COALESCE((payload->>'dateFrom')::date, current_date - 30);
  v_date_to   := COALESCE((payload->>'dateTo')::date, current_date);
  v_modules   := ARRAY(SELECT jsonb_array_elements_text(payload->'modules'));
  v_filters   := COALESCE(payload->'filters', '{}'::jsonb);
  v_group_by  := COALESCE(payload->>'groupBy', 'mes');
  v_cross     := payload->'crossModuleJoin';

  -- Si hay crossModuleJoin, devolver union de modulos filtrados por el valor de cruce
  IF v_cross IS NOT NULL AND jsonb_typeof(v_cross) = 'object' THEN
    DECLARE
      v_cross_type  text := v_cross->>'type';
      v_cross_val   text := v_cross->>'value';
      v_include     text[] := ARRAY(SELECT jsonb_array_elements_text(v_cross->'include'));
      v_cross_col   text;
      v_cross_sql   text;
    BEGIN
      FOR v_module IN SELECT unnest(v_include) LOOP
        v_module_key := v_module;
        v_table := CASE v_module
          WHEN 'produccion' THEN 'reportes_produccion'
          WHEN 'extraccion'  THEN 'reportes_extraccion'
          WHEN 'quemado'     THEN 'reportes_quemado'
          WHEN 'voladuras'   THEN 'reportes_voladuras'
          WHEN 'gastos'      THEN 'gastos'
          WHEN 'nomina'      THEN 'nomina_semanas'
          ELSE NULL
        END;
        IF v_table IS NULL THEN CONTINUE; END IF;

        v_date_col := CASE v_module
          WHEN 'nomina' THEN 'semana_inicio' ELSE 'fecha'
        END;

        -- Determinar columna de cruce segun tipo
        v_cross_col := CASE v_cross_type
          WHEN 'vertical' THEN CASE v_module
            WHEN 'produccion' THEN 'material_codigo'
            WHEN 'extraccion'  THEN 'vertical'
            WHEN 'voladuras'   THEN 'vertical_disparo'
            ELSE NULL
          END
          WHEN 'molino'   THEN CASE v_module
            WHEN 'produccion' THEN 'molino'
            ELSE NULL
          END
          WHEN 'mina'     THEN CASE v_module
            WHEN 'extraccion' THEN 'mina'
            WHEN 'voladuras' THEN 'mina'
            ELSE NULL
          END
          WHEN 'fecha'    THEN v_date_col || '::date'
          ELSE NULL
        END;
        IF v_cross_col IS NULL THEN CONTINUE; END IF;

        -- Build cross-module query
        v_cross_sql := format(
          'SELECT to_jsonb(t) FROM (SELECT * FROM %I WHERE %I && $1) t',
          v_table, v_cross_col
        );
        -- For regex matching on vertical codes
        IF v_cross_type = 'vertical' THEN
          v_cross_sql := format(
            'SELECT jsonb_agg(row_to_json(t.*)) FROM (SELECT * FROM %I WHERE %I BETWEEN %L AND %L AND %I ~* %L) t',
            v_table, v_date_col, v_date_from, v_date_to, v_cross_col, '^' || v_cross_val
          );
        ELSE
          v_cross_sql := format(
            'SELECT jsonb_agg(row_to_json(t.*)) FROM (SELECT * FROM %I WHERE %I BETWEEN %L AND %L AND %I = %L) t',
            v_table, v_date_col, v_date_from, v_date_to, v_cross_col, v_cross_val
          );
        END IF;

        BEGIN
          EXECUTE v_cross_sql INTO v_result;
          v_results := jsonb_set(v_results, ARRAY[v_module], COALESCE(v_result, '[]'::jsonb));
        EXCEPTION WHEN OTHERS THEN
          v_results := jsonb_set(v_results, ARRAY[v_module], jsonb_build_object('error', SQLERRM));
        END;
      END LOOP;
    END;
    RETURN jsonb_build_object(
      'ok', true,
      'dateRange', jsonb_build_object('from', v_date_from, 'to', v_date_to),
      'crossModule', v_cross,
      'data', v_results
    );
  END IF;

  -- ── Modo normal: un modulo por consulta ──────────────────────
  FOR v_module IN SELECT unnest(v_modules) LOOP
    v_module_key := v_module;
    v_table := CASE v_module
      WHEN 'produccion' THEN 'reportes_produccion'
      WHEN 'extraccion'  THEN 'reportes_extraccion'
      WHEN 'quemado'     THEN 'reportes_quemado'
      WHEN 'voladuras'   THEN 'reportes_voladuras'
      WHEN 'gastos'      THEN 'gastos'
      WHEN 'nomina'      THEN 'nomina_semanas'
      WHEN 'balance'     THEN 'balance_diario'
      ELSE NULL
    END;
    IF v_table IS NULL THEN
      v_results := jsonb_set(v_results, ARRAY[v_module], jsonb_build_object('error', 'Modulo no soportado: ' || v_module));
      CONTINUE;
    END IF;

    v_date_col := CASE v_module
      WHEN 'nomina' THEN 'semana_inicio' ELSE 'fecha'
    END;

    v_join := CASE v_module
      WHEN 'gastos' THEN 'LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_id'
      ELSE ''
    END;

    -- Alias segun join
    DECLARE
      v_alias text := CASE WHEN v_join <> '' THEN
        CASE v_module WHEN 'gastos' THEN 'g' ELSE '' END
      ELSE '' END;
    BEGIN

    -- Construir WHERE clause a partir de filters
    v_where := format('%I BETWEEN %L AND %L', v_date_col, v_date_from, v_date_to);
    v_filter := v_filters->v_module;
    IF v_filter IS NOT NULL AND jsonb_typeof(v_filter) = 'object' THEN
      FOR v_col IN SELECT jsonb_object_keys(v_filter) LOOP
        DECLARE
          v_col_val jsonb := v_filter->v_col;
          v_op      text;
          v_col_db  text := CASE WHEN v_alias <> '' THEN v_alias || '.' || v_col ELSE v_col END;
        BEGIN
          IF jsonb_typeof(v_col_val) = 'object' THEN
            -- Operadores: in, gte, lte, gt, lt, eq, regex, ilike
            IF v_col_val ? 'in' THEN
              v_parts := ARRAY(SELECT jsonb_array_elements_text(v_col_val->'in'));
              v_where := v_where || format(' AND %I = ANY(ARRAY[%s])',
                v_col,
                (SELECT string_agg(format('%L', p), ',') FROM unnest(v_parts) p)
              );
            END IF;
            IF v_col_val ? 'regex' THEN
              v_where := v_where || format(' AND %I ~* %L', v_col, v_col_val->>'regex');
            END IF;
            IF v_col_val ? 'ilike' THEN
              v_where := v_where || format(' AND %I ILIKE %L', v_col, v_col_val->>'ilike');
            END IF;
            FOR v_op IN SELECT unnest(ARRAY['gte','lte','gt','lt','eq']) LOOP
              IF v_col_val ? v_op THEN
                v_where := v_where || format(' AND %I %s %L', v_col, v_op, (v_col_val->>v_op));
              END IF;
            END LOOP;
          ELSIF jsonb_typeof(v_col_val) = 'array' THEN
            v_parts := ARRAY(SELECT jsonb_array_elements_text(v_col_val));
            v_where := v_where || format(' AND %I = ANY(ARRAY[%s])',
              v_col,
              (SELECT string_agg(format('%L', p), ',') FROM unnest(v_parts) p)
            );
          ELSIF jsonb_typeof(v_col_val) = 'string' THEN
            v_where := v_where || format(' AND %I = %L', v_col, v_col_val#>>'{}');
          ELSIF jsonb_typeof(v_col_val) = 'number' THEN
            v_where := v_where || format(' AND %I = %s', v_col, v_col_val#>>'{}');
          END IF;
        END;
      END LOOP;
    END IF;

    -- Construir GROUP BY y SELECT segun groupBy
    v_group_expr := CASE v_group_by
      WHEN 'dia'    THEN format('%I::date', v_date_col)
      WHEN 'semana' THEN format('date_trunc(''week'', %I)::date', v_date_col)
      WHEN 'mes'    THEN format('date_trunc(''month'', %I)::date', v_date_col)
      WHEN 'ano'    THEN format('date_trunc(''year'', %I)::date', v_date_col)
      ELSE COALESCE(v_group_by, v_col)  -- agrupar por columna arbitraria (molino, mina, area...)
    END;
    v_label_expr := CASE v_group_by
      WHEN 'dia'    THEN format('to_char(%I, ''YYYY-MM-DD'')', v_date_col)
      WHEN 'semana' THEN format('to_char(date_trunc(''week'', %I)::date, ''YYYY-MM-DD'')', v_date_col)
      WHEN 'mes'    THEN format('to_char(date_trunc(''month'', %I)::date, ''YYYY-MM'')', v_date_col)
      WHEN 'ano'    THEN format('to_char(date_trunc(''year'', %I)::date, ''YYYY'')', v_date_col)
      ELSE v_group_by
    END;

    -- Armar query final diferente segun el modulo (columnas de agregacion especificas)
    v_sql := CASE v_module
      WHEN 'produccion' THEN format(
        'WITH rows AS (SELECT %s AS periodo, %s AS periodo_label, COUNT(*)::int AS registros, COALESCE(SUM(oro_recuperado_g),0) AS oro_recuperado_g, COALESCE(SUM(sacos),0) AS sacos, COALESCE(SUM(toneladas_procesadas),0) AS toneladas, ROUND(COALESCE(AVG(tenor_tonelada_gpt),0)::numeric,2) AS tenor_promedio_gpt, ROUND(COALESCE(AVG(merma_1_pct),0)::numeric,2) AS merma_promedio_pct FROM reportes_produccion WHERE %s GROUP BY 1,2 ORDER BY 1), totals AS (SELECT COALESCE(SUM(oro_recuperado_g),0) AS total_oro, COALESCE(SUM(sacos),0) AS total_sacos, COALESCE(SUM(toneladas_procesadas),0) AS total_ton FROM reportes_produccion WHERE %s) SELECT jsonb_build_object(''rows'', COALESCE((SELECT jsonb_agg(row_to_json(rows.*)) FROM rows), ''[]''::jsonb), ''totals'', COALESCE((SELECT row_to_json(totals.*)::jsonb FROM totals), ''{}''::jsonb))',
        v_group_expr, v_label_expr, v_where, v_where
      )

      WHEN 'extraccion' THEN format(
        'WITH rows AS (SELECT %s AS periodo, %s AS periodo_label, COUNT(*)::int AS registros, COALESCE(SUM(sacos_extraidos),0) AS sacos_extraidos FROM reportes_extraccion WHERE %s GROUP BY 1,2 ORDER BY 1), totals AS (SELECT COALESCE(SUM(sacos_extraidos),0) AS total_sacos FROM reportes_extraccion WHERE %s) SELECT jsonb_build_object(''rows'', COALESCE((SELECT jsonb_agg(row_to_json(rows.*)) FROM rows), ''[]''::jsonb), ''totals'', COALESCE((SELECT row_to_json(totals.*)::jsonb FROM totals), ''{}''::jsonb))',
        v_group_expr, v_label_expr, v_where, v_where
      )

      WHEN 'quemado' THEN format(
        'WITH rows AS (SELECT %s AS periodo, %s AS periodo_label, COUNT(*)::int AS registros, COALESCE(SUM(total_amalgama_g),0) AS amalgama_g, COALESCE(SUM(total_oro_g),0) AS oro_quemado_g, COALESCE(SUM(manto_oro_g),0) AS manto_oro_g, COALESCE(SUM(retorta_oro_g),0) AS retorta_oro_g FROM reportes_quemado WHERE %s GROUP BY 1,2 ORDER BY 1), totals AS (SELECT COALESCE(SUM(total_oro_g),0) AS total_oro FROM reportes_quemado WHERE %s) SELECT jsonb_build_object(''rows'', COALESCE((SELECT jsonb_agg(row_to_json(rows.*)) FROM rows), ''[]''::jsonb), ''totals'', COALESCE((SELECT row_to_json(totals.*)::jsonb FROM totals), ''{}''::jsonb))',
        v_group_expr, v_label_expr, v_where, v_where
      )

      WHEN 'voladuras' THEN format(
        'WITH rows AS (SELECT %s AS periodo, %s AS periodo_label, COUNT(*)::int AS registros, COUNT(*) FILTER (WHERE sin_novedad = false)::int AS disparos, COALESCE(SUM(huecos_cantidad),0) AS huecos, COALESCE(SUM(chupis_cantidad),0) AS chupis, COALESCE(SUM(arroz_kg),0) AS arroz_kg FROM reportes_voladuras WHERE %s GROUP BY 1,2 ORDER BY 1), totals AS (SELECT COUNT(*)::int AS total_registros, COALESCE(SUM(huecos_cantidad),0) AS total_huecos FROM reportes_voladuras WHERE %s) SELECT jsonb_build_object(''rows'', COALESCE((SELECT jsonb_agg(row_to_json(rows.*)) FROM rows), ''[]''::jsonb), ''totals'', COALESCE((SELECT row_to_json(totals.*)::jsonb FROM totals), ''{}''::jsonb))',
        v_group_expr, v_label_expr, v_where, v_where
      )

      WHEN 'gastos' THEN format(
        'WITH rows AS (SELECT %s AS periodo, %s AS periodo_label, COUNT(*)::int AS registros, COALESCE(SUM(g.monto),0) AS total_usd, ROUND(COALESCE(AVG(g.monto),0)::numeric,2) AS promedio_usd, COALESCE(MAX(g.monto),0) AS mayor_gasto_usd FROM gastos g %s WHERE %s GROUP BY 1,2 ORDER BY 1), totals AS (SELECT COALESCE(SUM(monto),0) AS total_usd, COUNT(*)::int AS total_registros FROM gastos WHERE %s) SELECT jsonb_build_object(''rows'', COALESCE((SELECT jsonb_agg(row_to_json(rows.*)) FROM rows), ''[]''::jsonb), ''totals'', COALESCE((SELECT row_to_json(totals.*)::jsonb FROM totals), ''{}''::jsonb))',
        v_group_expr, v_label_expr, v_join, v_where, v_where
      )

      WHEN 'nomina' THEN format(
        'WITH rows AS (SELECT %s AS periodo, %s AS periodo_label, COUNT(*)::int AS semanas, COALESCE(SUM(total_pagado),0) AS total_pagado_usd FROM nomina_semanas WHERE %s GROUP BY 1,2 ORDER BY 1), totals AS (SELECT COALESCE(SUM(total_pagado),0) AS total_pagado_usd, COUNT(*)::int AS total_semanas FROM nomina_semanas WHERE %s) SELECT jsonb_build_object(''rows'', COALESCE((SELECT jsonb_agg(row_to_json(rows.*)) FROM rows), ''[]''::jsonb), ''totals'', COALESCE((SELECT row_to_json(totals.*)::jsonb FROM totals), ''{}''::jsonb))',
        v_group_expr, v_label_expr, v_where, v_where
      )

      WHEN 'balance' THEN format(
        'WITH rows AS (SELECT %s AS periodo, %s AS periodo_label, COALESCE(SUM(gramos_oro_recuperado_total),0) AS oro_g, ROUND(COALESCE(AVG(precio_oro_usd_gramo),0)::numeric,2) AS precio_oro_usd, COALESCE(SUM(ingreso_bruto_oro_usd),0) AS ingreso_oro_usd, COALESCE(SUM(ingreso_venta_arenas_usd),0) AS ingreso_arenas_usd, COALESCE(SUM(gasto_nomina_usd),0) AS gasto_nomina_usd, COALESCE(SUM(gasto_insumos_usd),0) AS gasto_insumos_usd, COALESCE(SUM(gasto_operativo_usd),0) AS gasto_operativo_usd, COALESCE(SUM(rentabilidad_usd),0) AS rentabilidad_usd, ROUND(COALESCE(AVG(margen_porcentaje),0)::numeric,2) AS margen_pct FROM balance_diario WHERE %s GROUP BY 1,2 ORDER BY 1) SELECT jsonb_build_object(''rows'', COALESCE((SELECT jsonb_agg(row_to_json(rows.*)) FROM rows), ''[]''::jsonb))',
        v_group_expr, v_label_expr, v_where
      )

      ELSE format('SELECT jsonb_build_object(''rows'', ''[]''::jsonb, ''totals'', ''{}''::jsonb)')
    END;

    -- Ejecutar
    BEGIN
      EXECUTE v_sql INTO v_result;
      v_results := jsonb_set(v_results, ARRAY[v_module], COALESCE(v_result, '{}'::jsonb));
    EXCEPTION WHEN OTHERS THEN
      v_results := jsonb_set(v_results, ARRAY[v_module], jsonb_build_object(
        'error', SQLERRM,
        'sql', v_sql
      ));
    END;

    END; -- end of alias block
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'dateRange', jsonb_build_object('from', v_date_from, 'to', v_date_to),
    'groupBy', v_group_by,
    'modules', to_jsonb(v_modules),
    'data', v_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION execute_dynamic_report(jsonb) TO authenticated;
