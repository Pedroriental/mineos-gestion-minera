import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase-server';

function displayNameFromUser(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.nombre === 'string' && meta.nombre.trim()) ||
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim());
  if (fromMeta) return fromMeta;
  if (user.email) {
    const local = user.email.split('@')[0];
    return local.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return 'Usuario';
}

/**
 * Resuelve UUID de auth.users → nombre legible para "Registrado por".
 * Usa service role si está disponible; si no, al menos el usuario de la sesión actual.
 */
export async function resolveRegistradoPorLabels(
  ids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const labels: Record<string, string> = {};

  const supabase = await createServerClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();
  if (sessionUser?.id) {
    labels[sessionUser.id] = displayNameFromUser(sessionUser);
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return labels;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  await Promise.all(
    unique.map(async (id) => {
      if (labels[id]) return;
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data?.user) {
        labels[id] = 'Usuario desconocido';
        return;
      }
      labels[id] = displayNameFromUser(data.user);
    }),
  );

  return labels;
}
