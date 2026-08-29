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

const userLabelCache = new Map<string, string>();

export async function resolveRegistradoPorLabels(
  ids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const labels: Record<string, string> = {};
  const missingIds: string[] = [];

  for (const id of unique) {
    if (userLabelCache.has(id)) {
      labels[id] = userLabelCache.get(id)!;
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) return labels;

  const supabase = await createServerClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();
  if (sessionUser?.id) {
    const name = displayNameFromUser(sessionUser);
    labels[sessionUser.id] = name;
    userLabelCache.set(sessionUser.id, name);
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return labels;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  await Promise.all(
    missingIds.map(async (id) => {
      if (labels[id]) return;
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data?.user) {
        labels[id] = 'Usuario desconocido';
        userLabelCache.set(id, 'Usuario desconocido');
        return;
      }
      const name = displayNameFromUser(data.user);
      labels[id] = name;
      userLabelCache.set(id, name);
    }),
  );

  return labels;
}
