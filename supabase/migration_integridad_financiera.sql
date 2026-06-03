-- ============================================================
-- MineOS: Trigger de Integridad Financiera
-- Valida que nomina_semanas.total_pagado coincida exactamente
-- con SUM(nomina_registros.monto_pagado) y con gastos.monto
-- cuando existe gasto_id.
-- ============================================================

-- ── 1. Función de verificación para trigger ────────────────

CREATE OR REPLACE FUNCTION verify_nomina_gasto_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_sum_registros NUMERIC;
  v_gasto_monto   NUMERIC;
  v_gasto_fecha   DATE;
BEGIN
  -- Solo validar cuando se establece o cambia gasto_id
  IF TG_OP = 'INSERT' AND NEW.gasto_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.gasto_id IS NOT NULL AND NEW.gasto_id IS NOT DISTINCT FROM OLD.gasto_id THEN
    RETURN NEW;
  END IF;

  -- 1. Verificar que la suma de monto_pagado en nomina_registros coincida con total_pagado
  SELECT COALESCE(SUM(monto_pagado), 0) INTO v_sum_registros
  FROM nomina_registros
  WHERE semana_id = NEW.id;

  IF v_sum_registros != NEW.total_pagado THEN
    RAISE EXCEPTION 'INTEGRIDAD FINANCIERA [CRITICO]: nomina_semanas.total_pagado ($%) no coincide con SUM(nomina_registros.monto_pagado) ($%) para semana %. Diferencia: $%',
      NEW.total_pagado, v_sum_registros, NEW.id, (NEW.total_pagado - v_sum_registros);
  END IF;

  -- 2. Si existe gasto_id, verificar que gastos.monto coincida
  IF NEW.gasto_id IS NOT NULL THEN
    SELECT monto, fecha INTO v_gasto_monto, v_gasto_fecha
    FROM gastos
    WHERE id = NEW.gasto_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INTEGRIDAD FINANCIERA [CRITICO]: gastos.id (%) referenciado por nomina_semanas (%) no existe',
        NEW.gasto_id, NEW.id;
    END IF;

    IF v_gasto_monto != NEW.total_pagado THEN
      RAISE EXCEPTION 'INTEGRIDAD FINANCIERA [CRITICO]: gastos.monto ($%) no coincide con nomina_semanas.total_pagado ($%) para gasto % vinculado a semana %',
        v_gasto_monto, NEW.total_pagado, NEW.gasto_id, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. Trigger constraint (deferred) sobre nomina_semanas ──

DROP TRIGGER IF EXISTS trg_nomina_gasto_integrity ON nomina_semanas;

CREATE CONSTRAINT TRIGGER trg_nomina_gasto_integrity
AFTER INSERT OR UPDATE OF total_pagado, gasto_id ON nomina_semanas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION verify_nomina_gasto_integrity();

COMMENT ON TRIGGER trg_nomina_gasto_integrity ON nomina_semanas IS
  'Verifica que total_pagado coincida con SUM(monto_pagado) de sus registros y con gastos.monto si existe gasto_id';

-- ── 3. Función de detección de discrepancias (para consulta programática) ──

DROP FUNCTION IF EXISTS fn_detect_nomina_discrepancies();

CREATE OR REPLACE FUNCTION fn_detect_nomina_discrepancies()
RETURNS TABLE(
  semana_id         UUID,
  tipo              TEXT,
  descripcion       TEXT,
  valor_esperado    NUMERIC,
  valor_real        NUMERIC,
  diferencia        NUMERIC,
  fecha_inicio      DATE,
  fecha_fin         DATE
) AS $$
BEGIN
  RETURN QUERY
  WITH suma_registros AS (
    SELECT
      ns.id,
      ns.semana_inicio,
      ns.semana_fin,
      ns.total_pagado,
      ns.gasto_id,
      COALESCE(SUM(nr.monto_pagado), 0) AS suma_montos
    FROM nomina_semanas ns
    LEFT JOIN nomina_registros nr ON nr.semana_id = ns.id
    WHERE ns.gasto_id IS NOT NULL
    GROUP BY ns.id, ns.semana_inicio, ns.semana_fin, ns.total_pagado, ns.gasto_id
  )
  SELECT
    sr.id,
    'CRITICO',
    'nomina_semanas.total_pagado no coincide con SUM(nomina_registros.monto_pagado)',
    sr.total_pagado,
    sr.suma_montos,
    (sr.total_pagado - sr.suma_montos),
    sr.semana_inicio,
    sr.semana_fin
  FROM suma_registros sr
  WHERE sr.total_pagado != sr.suma_montos

  UNION ALL

  SELECT
    sr.id,
    'CRITICO',
    'gastos.monto no coincide con nomina_semanas.total_pagado',
    sr.total_pagado,
    g.monto,
    (sr.total_pagado - g.monto),
    sr.semana_inicio,
    sr.semana_fin
  FROM suma_registros sr
  JOIN gastos g ON g.id = sr.gasto_id
  WHERE g.monto != sr.total_pagado;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 4. Función integral de verificación financiera ──

DROP FUNCTION IF EXISTS fn_financial_integrity_check(DATE, DATE);

CREATE OR REPLACE FUNCTION fn_financial_integrity_check(
  p_fecha_desde DATE DEFAULT CURRENT_DATE - INTERVAL '90 days',
  p_fecha_hasta DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  modulo       TEXT,
  severidad    TEXT,
  mensaje      TEXT,
  fecha_ref    DATE,
  valor_esper  NUMERIC,
  valor_real   NUMERIC,
  diferencia   NUMERIC
) AS $$
BEGIN
  -- A: Discrepancias de nómina
  RETURN QUERY
  SELECT
    'nomina'::TEXT,
    d.tipo,
    d.descripcion,
    d.fecha_inicio,
    d.valor_esperado,
    d.valor_real,
    d.diferencia
  FROM fn_detect_nomina_discrepancies() d
  WHERE d.fecha_inicio >= p_fecha_desde AND d.fecha_inicio <= p_fecha_hasta;

  -- B: balance_diario vs fuentes reales
  RETURN QUERY
  WITH
  ingresos_reales AS (
    SELECT
      bd.fecha,
      bd.ingreso_bruto_oro_usd,
      bd.ingreso_venta_arenas_usd,
      bd.ingreso_total_usd,
      bd.gasto_nomina_usd,
      bd.gasto_insumos_usd,
      bd.gasto_operativo_usd,
      bd.gasto_total_usd,
      bd.rentabilidad_usd,
      COALESCE(rp.oro_planta, 0) * COALESCE(poc.precio_usd_por_gramo, 0) AS ingreso_oro_calculado,
      COALESCE(va.total_arenas, 0) AS ingreso_arenas_calculado,
      COALESCE(gn.total_nomina, 0) AS gasto_nomina_calculado,
      COALESCE(go.total_operativo, 0) AS gasto_operativo_calculado
    FROM balance_diario bd
    LEFT JOIN (
      SELECT fecha, SUM(oro_recuperado_g) AS oro_planta
      FROM reportes_produccion
      GROUP BY fecha
    ) rp ON rp.fecha = bd.fecha
    LEFT JOIN (
      SELECT fecha, precio_usd_por_gramo
      FROM precio_oro_cache
    ) poc ON poc.fecha = bd.fecha
    LEFT JOIN (
      SELECT fecha, SUM(total_venta) AS total_arenas
      FROM venta_arenas
      GROUP BY fecha
    ) va ON va.fecha = bd.fecha
    LEFT JOIN (
      SELECT g.fecha, SUM(g.monto) AS total_nomina
      FROM gastos g
      JOIN categorias_gasto cg ON cg.id = g.categoria_id
      WHERE cg.tipo = 'nomina' OR cg.nombre ILIKE '%nomina%'
      GROUP BY g.fecha
    ) gn ON gn.fecha = bd.fecha
    LEFT JOIN (
      SELECT g.fecha, SUM(g.monto) AS total_operativo
      FROM gastos g
      JOIN categorias_gasto cg ON cg.id = g.categoria_id
      WHERE cg.tipo != 'nomina' AND cg.nombre NOT ILIKE '%nomina%'
      GROUP BY g.fecha
    ) go ON go.fecha = bd.fecha
    WHERE bd.fecha >= p_fecha_desde AND bd.fecha <= p_fecha_hasta
  )
  SELECT
    'balance'::TEXT,
    'ADVERTENCIA'::TEXT,
    'ingreso_bruto_oro_usd no coincide con oro_recuperado_g * precio_oro',
    ir.fecha,
    ir.ingreso_bruto_oro_usd,
    ir.ingreso_oro_calculado,
    (ir.ingreso_bruto_oro_usd - ir.ingreso_oro_calculado)
  FROM ingresos_reales ir
  WHERE ABS(ir.ingreso_bruto_oro_usd - ir.ingreso_oro_calculado) > 0.01

  UNION ALL

  SELECT
    'balance'::TEXT,
    'ADVERTENCIA'::TEXT,
    'gasto_nomina_usd no coincide con la suma de gastos de nomina',
    ir.fecha,
    ir.gasto_nomina_usd,
    ir.gasto_nomina_calculado,
    (ir.gasto_nomina_usd - ir.gasto_nomina_calculado)
  FROM ingresos_reales ir
  WHERE ABS(ir.gasto_nomina_usd - ir.gasto_nomina_calculado) > 0.01

  UNION ALL

  SELECT
    'balance'::TEXT,
    'CRITICO'::TEXT,
    'rentabilidad_usd no coincide con ingreso_total_usd - gasto_total_usd',
    ir.fecha,
    ir.rentabilidad_usd,
    (ir.ingreso_total_usd - ir.gasto_total_usd),
    (ir.rentabilidad_usd - (ir.ingreso_total_usd - ir.gasto_total_usd))
  FROM ingresos_reales ir
  WHERE ABS(ir.rentabilidad_usd - (ir.ingreso_total_usd - ir.gasto_total_usd)) > 0.01;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 5. Política de seguridad ──

GRANT EXECUTE ON FUNCTION fn_detect_nomina_discrepancies() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_financial_integrity_check(DATE, DATE) TO authenticated;
