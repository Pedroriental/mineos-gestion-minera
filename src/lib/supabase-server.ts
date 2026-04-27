import { createServerClient as createClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client para Server Components / Server Actions.
 * Inyecta las cookies de sesión para que el servidor actúe con los permisos del usuario.
 * NUNCA importar este módulo en archivos 'use client'.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // El método `setAll` fue llamado desde un Server Component.
            // Puede ser ignorado si tienes un middleware refrescando sesiones.
          }
        },
      },
    }
  );
}
