-- ============================================================
-- Fix 1: Renombrar complejo "Mina Belén" → "La Fé"
-- ============================================================
UPDATE complexes 
SET name = 'La Fé', slug = 'la-fe' 
WHERE slug = 'mina-belen' OR name = 'Mina Belén';

-- ============================================================
-- Fix 2: Agregar 'guest' al enum user_role
-- ============================================================
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Fix 3: Crear usuario guest en auth + perfil
-- ============================================================
-- Primero crea el usuario en Supabase Dashboard → Auth → Users:
--   Email: invitado@mineos.local
--   Password: MineOS_Viewer_2024!
--   Confirmar email: ✅
-- LUEGO ejecuta esto:
DO $$
DECLARE
  guest_uuid UUID;
BEGIN
  SELECT id INTO guest_uuid FROM auth.users WHERE email = 'invitado@mineos.local' LIMIT 1;
  IF guest_uuid IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, email, full_name, role, complex_id, active)
    VALUES (guest_uuid, 'invitado@mineos.local', 'Observador', 'guest', NULL, TRUE)
    ON CONFLICT (id) DO UPDATE SET role = 'guest', complex_id = NULL, active = TRUE;
    UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role": "guest"}'::jsonb WHERE id = guest_uuid;
    RAISE NOTICE 'Guest listo: %', guest_uuid;
  ELSE
    RAISE NOTICE 'Usuario guest NO encontrado — créalo primero en Auth';
  END IF;
END $$;

-- ============================================================
-- Fix 4: Asegurar que la tabla notifications existe + realtime
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  actor_id UUID,
  recipient_id UUID NOT NULL,
  complex_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
