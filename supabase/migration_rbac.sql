-- ============================================================
-- MineOS RBAC Migration
-- Multi-tenancy + Role-Based Access Control
-- Safe to run on existing database — all operations are idempotent
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin_developer', 'admin', 'mining_supervisor', 'mill_supervisor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. COMPLEXES (Multi-tenancy)
-- ============================================================
CREATE TABLE IF NOT EXISTS complexes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed "Mina Belén" as the default (and initially only) complex
INSERT INTO complexes (name, slug)
SELECT 'Mina Belén', 'mina-belen'
WHERE NOT EXISTS (SELECT 1 FROM complexes WHERE slug = 'mina-belen');

-- ============================================================
-- 3. USER PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(150) NOT NULL,
  role user_role NOT NULL DEFAULT 'admin',
  complex_id UUID REFERENCES complexes(id),  -- NULL for admin_developer
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_complex ON user_profiles(complex_id);

-- ============================================================
-- 4. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  href VARCHAR(500),
  complex_id UUID NOT NULL REFERENCES complexes(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_complex ON notifications(complex_id);

-- ============================================================
-- 5. JWT HELPER FUNCTIONS (public schema — no auth perms needed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', TRUE)::json->'user_metadata'->>'role'),
    'admin'
  )::user_role;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_complex_id()
RETURNS UUID AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', TRUE)::json->'user_metadata'->>'complex_id',
    ''
  )::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 6. AUTH TRIGGER: auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_complex_id UUID;
  target_complex_id UUID;
BEGIN
  SELECT id INTO default_complex_id FROM complexes WHERE slug = 'mina-belen' LIMIT 1;
  target_complex_id := COALESCE((NEW.raw_user_meta_data->>'complex_id')::uuid, default_complex_id);

  -- Global access for devs: NULL complex_id
  IF (NEW.raw_user_meta_data->>'role') = 'admin_developer' THEN
    target_complex_id := NULL;
  END IF;

  INSERT INTO user_profiles (id, display_name, role, complex_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'admin'),
    target_complex_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 6b. BACKFILL EXISTING AUTH USERS into user_profiles
-- ============================================================
DO $$
DECLARE
  belen_id UUID;
  u RECORD;
  user_role_val user_role;
  user_complex UUID;
  user_name TEXT;
BEGIN
  SELECT id INTO belen_id FROM complexes WHERE slug = 'mina-belen' LIMIT 1;

  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    WHERE up.id IS NULL
  LOOP
    user_role_val := COALESCE(
      (u.raw_user_meta_data->>'role')::user_role,
      'admin'
    );

    IF user_role_val = 'admin_developer' THEN
      user_complex := NULL;
    ELSE
      user_complex := COALESCE(
        (u.raw_user_meta_data->>'complex_id')::uuid,
        belen_id
      );
    END IF;

    user_name := COALESCE(u.raw_user_meta_data->>'display_name', u.email);

    INSERT INTO user_profiles (id, display_name, role, complex_id)
    VALUES (u.id, user_name, user_role_val, user_complex)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- 7. NOTIFY ADMINS FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION notify_admins(
  p_complex_id UUID,
  p_type VARCHAR,
  p_title VARCHAR,
  p_body TEXT DEFAULT NULL,
  p_href VARCHAR DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (recipient_id, actor_id, type, title, body, href, complex_id)
  SELECT up.id, p_actor_id, p_type, p_title, p_body, p_href, p_complex_id
  FROM user_profiles up
  WHERE up.complex_id = p_complex_id
    AND up.role = 'admin'
    AND up.active = TRUE
    AND up.id IS DISTINCT FROM p_actor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. ROW LEVEL SECURITY — new tables
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE complexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complexes_read" ON complexes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "user_profiles_own_read" ON user_profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.user_role() = 'admin_developer'
    OR (complex_id = public.user_complex_id() AND public.user_role() = 'admin')
  );

CREATE POLICY "notifications_recipient_read" ON notifications
  FOR SELECT USING (
    recipient_id = (
      SELECT id FROM user_profiles WHERE id = auth.uid()
    )
    OR public.user_role() = 'admin_developer'
  );

CREATE POLICY "notifications_system_insert" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 9. ADD complex_id TO ALL OPERATIONAL TABLES
-- ============================================================

CREATE OR REPLACE FUNCTION add_complex_id_if_needed(p_table TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ADD COLUMN complex_id UUID REFERENCES complexes(id)', p_table);
EXCEPTION
  WHEN duplicate_column THEN NULL;
  WHEN undefined_table THEN NULL;
END;
$$ LANGUAGE plpgsql;

-- Personal & Workforce
SELECT add_complex_id_if_needed('personal');
SELECT add_complex_id_if_needed('perfiles_compensacion');
SELECT add_complex_id_if_needed('personal_import_aliases');

-- Payroll (Nomina)
SELECT add_complex_id_if_needed('nomina_pagos');
SELECT add_complex_id_if_needed('nomina_semanas');
SELECT add_complex_id_if_needed('nomina_registros');
SELECT add_complex_id_if_needed('nomina_cierres');
SELECT add_complex_id_if_needed('nomina_vales');
SELECT add_complex_id_if_needed('nomina_ciclos');
SELECT add_complex_id_if_needed('nomina_ciclo_semanas');
SELECT add_complex_id_if_needed('nomina_periodos');
SELECT add_complex_id_if_needed('nomina_periodo_semanas');
SELECT add_complex_id_if_needed('nomina_mes_periodos');
SELECT add_complex_id_if_needed('nomina_audit_log');

-- Expenses & Finance
SELECT add_complex_id_if_needed('gastos');
SELECT add_complex_id_if_needed('categorias_gasto');
SELECT add_complex_id_if_needed('gasto_conceptos');
SELECT add_complex_id_if_needed('compras_programadas');
SELECT add_complex_id_if_needed('balance_diario');

-- Equipment & Inventory
SELECT add_complex_id_if_needed('equipos');
SELECT add_complex_id_if_needed('equipos_historial');
SELECT add_complex_id_if_needed('inventario_items');
SELECT add_complex_id_if_needed('inventario_movimientos');

-- Production Reports
SELECT add_complex_id_if_needed('reportes_produccion');
SELECT add_complex_id_if_needed('reportes_quemado');
SELECT add_complex_id_if_needed('reportes_voladuras');
SELECT add_complex_id_if_needed('reportes_extraccion');
SELECT add_complex_id_if_needed('reportes_acarreo');

-- Plant Operations
SELECT add_complex_id_if_needed('procesamiento_planta');
SELECT add_complex_id_if_needed('recepcion_material');
SELECT add_complex_id_if_needed('venta_arenas');
SELECT add_complex_id_if_needed('lineas_plancha');

-- Operations & Security
SELECT add_complex_id_if_needed('libro_guardia');
SELECT add_complex_id_if_needed('mejoras_seguridad');

-- Rotation (Turnos/Cuadrillas)
SELECT add_complex_id_if_needed('rotacion_plantillas');
SELECT add_complex_id_if_needed('rotacion_plantilla_cuadrillas');
SELECT add_complex_id_if_needed('rotacion_plantilla_semanas');
SELECT add_complex_id_if_needed('rotacion_plantilla_asignaciones');
SELECT add_complex_id_if_needed('rotacion_plantilla_instancias');
SELECT add_complex_id_if_needed('rotacion_instancia_cuadrillas');
SELECT add_complex_id_if_needed('rotacion_instancia_semanas');

-- Nómina additional tables
SELECT add_complex_id_if_needed('nominas_cargadas');
SELECT add_complex_id_if_needed('detalles_nomina');

-- Biblioteca (per-complex variable library)
SELECT add_complex_id_if_needed('biblioteca_variables');
SELECT add_complex_id_if_needed('biblioteca_categorias');

-- Fiscal (per-complex legal/financial config)
SELECT add_complex_id_if_needed('fiscal_entidades');
SELECT add_complex_id_if_needed('fiscal_representantes');
SELECT add_complex_id_if_needed('fiscal_cuentas_bancarias');
SELECT add_complex_id_if_needed('fiscal_textos_legales');
SELECT add_complex_id_if_needed('fiscal_parametros');

DROP FUNCTION IF EXISTS add_complex_id_if_needed(p_table TEXT);

-- ============================================================
-- 10. BACKFILL: assign all existing data to Mina Belén
-- ============================================================

DO $$
DECLARE
  belen_id UUID;
  t TEXT;
  tables_to_backfill TEXT[] := ARRAY[
    'personal','perfiles_compensacion','personal_import_aliases',
    'nomina_pagos','nomina_semanas','nomina_registros','nomina_cierres',
    'nomina_vales','nomina_ciclos','nomina_ciclo_semanas',
    'nomina_periodos','nomina_periodo_semanas','nomina_mes_periodos','nomina_audit_log',
    'gastos','categorias_gasto','gasto_conceptos','compras_programadas','balance_diario',
    'equipos','equipos_historial','inventario_items','inventario_movimientos',
    'reportes_produccion','reportes_quemado','reportes_voladuras','reportes_extraccion','reportes_acarreo',
    'procesamiento_planta','recepcion_material','venta_arenas','lineas_plancha',
    'libro_guardia','mejoras_seguridad',
    'rotacion_plantillas','rotacion_plantilla_cuadrillas','rotacion_plantilla_semanas',
    'rotacion_plantilla_asignaciones','rotacion_plantilla_instancias',
    'rotacion_instancia_cuadrillas','rotacion_instancia_semanas',
    'nominas_cargadas','detalles_nomina',
    'biblioteca_variables','biblioteca_categorias',
    'fiscal_entidades','fiscal_representantes','fiscal_cuentas_bancarias',
    'fiscal_textos_legales','fiscal_parametros'
  ];
BEGIN
  SELECT id INTO belen_id FROM complexes WHERE slug = 'mina-belen' LIMIT 1;

  IF belen_id IS NULL THEN
    RAISE WARNING 'Mina Belén complex not found — skipping backfill';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables_to_backfill
  LOOP
    BEGIN
      EXECUTE format('UPDATE %I SET complex_id = $1 WHERE complex_id IS NULL', t)
        USING belen_id;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 11. DROP OLD BLANKET RLS POLICIES
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'personal','nomina_pagos','categorias_gasto','gastos',
      'inventario_items','inventario_movimientos','compras_programadas',
      'equipos','equipos_historial','mejoras_seguridad',
      'recepcion_material','procesamiento_planta','venta_arenas',
      'precio_oro_cache','balance_diario','nominas_cargadas','detalles_nomina'
    ])
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "auth_full_access" ON %I', t);
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 12. NEW RBAC POLICIES
-- ============================================================

CREATE OR REPLACE FUNCTION apply_rbac_policies(table_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE POLICY "rbac_full_access_%s" ON %I
      FOR ALL
      USING (
        public.user_role() = ''admin_developer''
        OR (public.user_role() = ''admin'' AND complex_id = public.user_complex_id())
      )
      WITH CHECK (
        public.user_role() = ''admin_developer''
        OR (public.user_role() = ''admin'' AND complex_id = public.user_complex_id())
      )', table_name, table_name);

  EXECUTE format('
    CREATE POLICY "rbac_supervisor_read_%s" ON %I
      FOR SELECT
      USING (
        complex_id = public.user_complex_id()
        AND public.user_role() IN (''mining_supervisor'', ''mill_supervisor'')
      )', table_name, table_name);

  EXECUTE format('
    CREATE POLICY "rbac_supervisor_insert_%s" ON %I
      FOR INSERT
      WITH CHECK (
        complex_id = public.user_complex_id()
        AND public.user_role() IN (''mining_supervisor'', ''mill_supervisor'')
      )', table_name, table_name);
EXCEPTION
  WHEN undefined_table THEN NULL;
END;
$$ LANGUAGE plpgsql;

SELECT apply_rbac_policies('personal');
SELECT apply_rbac_policies('perfiles_compensacion');
SELECT apply_rbac_policies('personal_import_aliases');
SELECT apply_rbac_policies('nomina_pagos');
SELECT apply_rbac_policies('nomina_semanas');
SELECT apply_rbac_policies('nomina_registros');
SELECT apply_rbac_policies('nomina_cierres');
SELECT apply_rbac_policies('nomina_vales');
SELECT apply_rbac_policies('nomina_ciclos');
SELECT apply_rbac_policies('nomina_ciclo_semanas');
SELECT apply_rbac_policies('nomina_periodos');
SELECT apply_rbac_policies('nomina_periodo_semanas');
SELECT apply_rbac_policies('nomina_mes_periodos');
SELECT apply_rbac_policies('nomina_audit_log');
SELECT apply_rbac_policies('gastos');
SELECT apply_rbac_policies('categorias_gasto');
SELECT apply_rbac_policies('gasto_conceptos');
SELECT apply_rbac_policies('compras_programadas');
SELECT apply_rbac_policies('balance_diario');
SELECT apply_rbac_policies('equipos');
SELECT apply_rbac_policies('equipos_historial');
SELECT apply_rbac_policies('inventario_items');
SELECT apply_rbac_policies('inventario_movimientos');
SELECT apply_rbac_policies('reportes_produccion');
SELECT apply_rbac_policies('reportes_quemado');
SELECT apply_rbac_policies('reportes_voladuras');
SELECT apply_rbac_policies('reportes_extraccion');
SELECT apply_rbac_policies('reportes_acarreo');
SELECT apply_rbac_policies('procesamiento_planta');
SELECT apply_rbac_policies('recepcion_material');
SELECT apply_rbac_policies('venta_arenas');
SELECT apply_rbac_policies('lineas_plancha');
SELECT apply_rbac_policies('libro_guardia');
SELECT apply_rbac_policies('mejoras_seguridad');
SELECT apply_rbac_policies('rotacion_plantillas');
SELECT apply_rbac_policies('rotacion_plantilla_cuadrillas');
SELECT apply_rbac_policies('rotacion_plantilla_semanas');
SELECT apply_rbac_policies('rotacion_plantilla_asignaciones');
SELECT apply_rbac_policies('rotacion_plantilla_instancias');
SELECT apply_rbac_policies('rotacion_instancia_cuadrillas');
SELECT apply_rbac_policies('rotacion_instancia_semanas');
SELECT apply_rbac_policies('nominas_cargadas');
SELECT apply_rbac_policies('detalles_nomina');

DROP FUNCTION IF EXISTS apply_rbac_policies(TEXT);

-- Biblioteca & Fiscal: all read, admin write
DO $$
DECLARE
  t TEXT;
  read_write_tables TEXT[] := ARRAY[
    'biblioteca_variables','biblioteca_categorias',
    'fiscal_entidades','fiscal_representantes','fiscal_cuentas_bancarias',
    'fiscal_textos_legales','fiscal_parametros'
  ];
BEGIN
  FOREACH t IN ARRAY read_write_tables
  LOOP
    BEGIN
      EXECUTE format('
        CREATE POLICY "rbac_all_read_%s" ON %I
          FOR SELECT USING (auth.role() = ''authenticated'')', t, t);

      EXECUTE format('
        CREATE POLICY "rbac_admin_write_%s" ON %I
          FOR ALL
          USING (
            public.user_role() = ''admin_developer''
            OR (public.user_role() = ''admin'' AND complex_id = public.user_complex_id())
          )
          WITH CHECK (
            public.user_role() = ''admin_developer''
            OR (public.user_role() = ''admin'' AND complex_id = public.user_complex_id())
          )', t, t);
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;
