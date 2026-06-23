-- ============================================================
-- Fix: handle_new_user() trigger busca el slug antiguo 'mina-belen'
-- que ya no existe tras fix_complex_rename_and_guest.sql.
-- Resultado: cualquier usuario nuevo creado por medios que no
-- pasen por la server action createUser (ej. Supabase Dashboard
-- "Add user" o invitaciones) queda con complex_id = NULL,
-- y RLS le niega acceso a todo su complejo.
--
-- Solución: usar el primer complex disponible por created_at
-- en lugar de un slug hardcodeado. Esto sobrevive a renames
-- comerciales y a múltiples complejos.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_complex_id UUID;
  target_complex_id UUID;
BEGIN
  -- Tomar el primer complejo por orden de creación (estable, sin depender
  -- de slug o nombre comercial).
  SELECT id INTO default_complex_id
  FROM complexes
  ORDER BY created_at ASC
  LIMIT 1;

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
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger on_auth_user_created ya existe, no es necesario recrearlo.
-- CREATE OR REPLACE FUNCTION lo recrea in-place y mantiene el trigger.
