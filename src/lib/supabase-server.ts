/**
 * Supabase client para Server Components / Server Actions.
 * Usa la anon key — los RPCs tienen SECURITY DEFINER + GRANT TO anon.
 * NUNCA importar este módulo en archivos 'use client'.
 */
import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // En el servidor no queremos persistir ni refrescar sesión
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
