-- ============================================================
-- MineOS: Blindaje de Nómina (Fase 4) — Audit Trail por triggers
--
-- Trazabilidad "quién modificó qué y cuándo" sobre las TABLAS DE
-- DINERO, a nivel de base de datos:
--
--   • Captura INSERT / UPDATE / DELETE aunque la escritura venga del
--     dashboard de Supabase, de un script SQL o de un servicio futuro
--     (el log aplicativo nomina_audit_log solo ve lo que pasa por la app).
--   • UPDATE guarda SOLO el diff (columnas que cambiaron, antes/después),
--     filtrando ruido (updated_at). DELETE guarda la fila completa para
--     forense/recuperación. INSERT registra autoría (la fila viva ya es
--     el estado).
--   • Identidad real vía auth.uid() (JWT verificado), nunca del cliente.
--   • Tabla INMUTABLE para usuarios: RLS sin policies de escritura;
--     solo el trigger (SECURITY DEFINER) inserta.
--
-- Tablas auditadas: personal, perfiles_compensacion, nomina_semanas,
-- nomina_registros, nomina_cierres, nomina_vales, nomina_ajustes.
--
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ── 1. Tabla de auditoría ───────────────────────────────────
CREATE TABLE IF NOT EXISTS nomina_audit_trail (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla       TEXT NOT NULL,
  fila_id     UUID,
  operacion   TEXT NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
  usuario     UUID DEFAULT auth.uid(),
  -- UPDATE: { col: { antes, despues } } · DELETE: fila completa · INSERT: null
  cambios     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_tabla_fila
  ON nomina_audit_trail (tabla, fila_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created
  ON nomina_audit_trail (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_usuario
  ON nomina_audit_trail (usuario);

-- ── 2. Inmutabilidad: solo lectura para usuarios ────────────
ALTER TABLE nomina_audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_trail_select ON nomina_audit_trail;
CREATE POLICY audit_trail_select ON nomina_audit_trail
  FOR SELECT TO authenticated USING (true);
-- Sin policies de INSERT/UPDATE/DELETE: ningún rol de aplicación puede
-- escribir ni alterar el trail. Inserta únicamente el trigger definer.

REVOKE INSERT, UPDATE, DELETE ON nomina_audit_trail FROM authenticated;
REVOKE ALL ON nomina_audit_trail FROM anon;
GRANT SELECT ON nomina_audit_trail TO authenticated;

-- ── 3. Función de trigger genérica (diff-only) ──────────────
CREATE OR REPLACE FUNCTION fn_audit_nomina()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fila_id uuid;
  v_cambios jsonb;
BEGIN
  v_fila_id := COALESCE(
    (to_jsonb(NEW) ->> 'id')::uuid,
    (to_jsonb(OLD) ->> 'id')::uuid
  );

  IF TG_OP = 'UPDATE' THEN
    -- Diff: solo columnas que cambiaron, excluyendo timestamps de ruido
    SELECT jsonb_object_agg(n.key, jsonb_build_object('antes', o.value, 'despues', n.value))
    INTO v_cambios
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value
      AND n.key NOT IN ('updated_at');

    -- Nada cambió de verdad (solo updated_at): no ensuciar el trail
    IF v_cambios IS NULL OR v_cambios = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_cambios := to_jsonb(OLD);
  ELSE
    v_cambios := NULL; -- INSERT: la fila viva ya es el estado
  END IF;

  INSERT INTO nomina_audit_trail (tabla, fila_id, operacion, usuario, cambios)
  VALUES (TG_TABLE_NAME, v_fila_id, TG_OP, auth.uid(), v_cambios);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- El trigger no debe ser invocable directamente por usuarios
REVOKE ALL ON FUNCTION fn_audit_nomina() FROM PUBLIC, anon, authenticated;

-- ── 4. Adjuntar triggers a las tablas de dinero ─────────────
-- Idempotente y tolerante a tablas aún no migradas (p. ej. nomina_ajustes).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'personal',
    'perfiles_compensacion',
    'nomina_semanas',
    'nomina_registros',
    'nomina_cierres',
    'nomina_vales',
    'nomina_ajustes'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'audit trail: tabla % no existe, se omite', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_nomina ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_nomina
         AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION fn_audit_nomina()',
      t
    );
  END LOOP;
END $$;

COMMENT ON TABLE nomina_audit_trail IS
  'Audit trail inmutable de tablas de dinero (Fase 4 blindaje). UPDATE guarda diff antes/después; DELETE guarda la fila completa; usuario = auth.uid().';

-- ── 5. Consultas útiles (referencia) ────────────────────────
-- ¿Quién cambió el salario de un trabajador?
--   SELECT created_at, usuario, cambios->'salario_base'
--   FROM nomina_audit_trail
--   WHERE tabla = 'personal' AND fila_id = '<personal_id>' AND cambios ? 'salario_base'
--   ORDER BY created_at DESC;
--
-- Historial completo de una semana de nómina:
--   SELECT * FROM nomina_audit_trail
--   WHERE (tabla = 'nomina_semanas' AND fila_id = '<semana_id>')
--   ORDER BY created_at DESC;
