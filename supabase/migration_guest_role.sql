-- ============================================================
-- Guest/Observador Role Migration
-- Run AFTER migration_rbac.sql
-- ============================================================

-- 1. Add 'guest' to the user_role enum
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create user_profiles entry for guest user (if auth user exists)
-- The guest user MUST be created first in Supabase Dashboard > Auth > Users
-- Email: invitado@mineos.local
-- Password: MineOS_Viewer_2024!
-- Then run this migration to create the profile

DO $$
DECLARE
  guest_uuid UUID;
BEGIN
  -- Find the guest user in auth.users
  SELECT id INTO guest_uuid
  FROM auth.users
  WHERE email = 'invitado@mineos.local'
  LIMIT 1;

  IF guest_uuid IS NOT NULL THEN
    -- Upsert user_profiles entry
    INSERT INTO public.user_profiles (id, display_name, role, complex_id, active)
    VALUES (guest_uuid, 'Observador', 'guest', NULL, TRUE)
    ON CONFLICT (id) DO UPDATE SET
      role = 'guest',
      complex_id = NULL,
      active = TRUE,
      display_name = 'Observador';

    -- Sync raw_user_meta_data in auth.users
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || '{"role": "guest"}'::jsonb
    WHERE id = guest_uuid;

    RAISE NOTICE 'Guest user profile created/updated for %', guest_uuid;
  ELSE
    RAISE NOTICE 'Guest user not found in auth.users. Create it in Supabase Dashboard first.';
  END IF;
END $$;
