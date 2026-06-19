'use server';

import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/rbac';
import type { UserRole } from '@/lib/types';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ============================================================
// COMPLEXES CRUD
// ============================================================

export async function getComplexes() {
  await requireRole('admin_developer');
  const { data, error } = await supabaseAdmin
    .from('complexes')
    .select('*')
    .order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function getComplex(id: string) {
  await requireRole('admin_developer');
  const { data, error } = await supabaseAdmin
    .from('complexes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createComplex(name: string, slug: string) {
  await requireRole('admin_developer');
  const { data, error } = await supabaseAdmin
    .from('complexes')
    .insert({ name, slug })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateComplex(id: string, patch: { name?: string; slug?: string; active?: boolean }) {
  await requireRole('admin_developer');
  const { error } = await supabaseAdmin
    .from('complexes')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteComplex(id: string) {
  await requireRole('admin_developer');
  // Check if complex has users
  const { count } = await supabaseAdmin
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('complex_id', id);
  if (count && count > 0) {
    throw new Error(`No se puede eliminar: el complejo tiene ${count} usuario(s) asignado(s). Reasigne o elimine los usuarios primero.`);
  }
  const { error } = await supabaseAdmin
    .from('complexes')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ============================================================
// USER MANAGEMENT (admin + supervisors per complex)
// ============================================================

export async function getUsersByComplex(complexId: string) {
  await requireRole('admin_developer');
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, display_name, role, complex_id, active, created_at')
    .eq('complex_id', complexId)
    .order('role')
    .order('display_name');
  if (error) throw new Error(error.message);
  return data;
}

export async function getAllDevelopers() {
  await requireRole('admin_developer');
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, display_name, role, complex_id, active, created_at')
    .eq('role', 'admin_developer')
    .order('display_name');
  if (error) throw new Error(error.message);
  return data;
}

export async function createUser(params: {
  email: string;
  password: string;
  display_name: string;
  role: UserRole;
  complex_id?: string | null;
}) {
  await requireRole('admin_developer');

  // admin_developer must NOT have a complex
  if (params.role === 'admin_developer' && params.complex_id) {
    throw new Error('Los admin_developer no deben tener complejo asignado.');
  }
  // admin and supervisors MUST have a complex
  if (params.role !== 'admin_developer' && !params.complex_id) {
    throw new Error('Los admin y supervisores deben tener un complejo asignado.');
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      display_name: params.display_name,
      role: params.role,
      complex_id: params.complex_id ?? null,
    },
  });
  if (error) throw new Error(error.message);

  // Ensure user_profiles row exists with correct data
  // (trigger may have created it, but we ensure consistency)
  await supabaseAdmin.from('user_profiles').upsert({
    id: data.user.id,
    display_name: params.display_name,
    role: params.role,
    complex_id: params.complex_id ?? null,
    active: true,
  }, { onConflict: 'id' });

  return data.user;
}

export async function updateUserProfile(userId: string, patch: {
  display_name?: string;
  role?: UserRole;
  complex_id?: string | null;
  active?: boolean;
}) {
  await requireRole('admin_developer');

  // Update user_profiles
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(patch)
    .eq('id', userId);
  if (error) throw new Error(error.message);

  // Sync raw_user_meta_data in auth.users so JWT has correct role
  const metadataPatch: Record<string, unknown> = {};
  if (patch.role !== undefined) metadataPatch.role = patch.role;
  if (patch.display_name !== undefined) metadataPatch.display_name = patch.display_name;
  if (patch.complex_id !== undefined) metadataPatch.complex_id = patch.complex_id;

  if (Object.keys(metadataPatch).length > 0) {
    // Get current metadata first
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const currentMeta = authUser?.user?.user_metadata ?? {};
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { ...currentMeta, ...metadataPatch },
    });
  }
}

export async function deleteUser(userId: string) {
  await requireRole('admin_developer');
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireRole('admin_developer');
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) throw new Error(error.message);
}

// ============================================================
// ALL USERS WITH EMAILS (for credentials view)
// ============================================================

export async function getAllUsersWithEmails() {
  await requireRole('admin_developer');

  // Get all profiles
  const { data: profiles, error: pe } = await supabaseAdmin
    .from('user_profiles')
    .select('id, display_name, role, complex_id, active, created_at')
    .order('role')
    .order('display_name');
  if (pe) throw new Error(pe.message);

  // Get auth users for emails
  const userIds = profiles?.map((p) => p.id) ?? [];
  const authUsers: Record<string, string> = {};
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const { data: authPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (!authPage?.users?.length) { hasMore = false; break; }
    for (const au of authPage.users) {
      if (userIds.includes(au.id)) authUsers[au.id] = au.email ?? '';
    }
    if (authPage.users.length < 100) hasMore = false;
    else page++;
  }

  // Get complex names
  const { data: complexes } = await supabaseAdmin.from('complexes').select('id, name');
  const complexMap = new Map((complexes ?? []).map((c) => [c.id, c.name]));

  return (profiles ?? []).map((p) => ({
    ...p,
    email: authUsers[p.id] ?? '(sin email)',
    complex_name: p.complex_id ? (complexMap.get(p.complex_id) ?? '(desconocido)') : null,
  }));
}

// ============================================================
// CREDENTIALS PDF DATA
// ============================================================

export async function getComplexCredentials(complexId: string) {
  await requireRole('admin_developer');

  const { data: complex, error: ce } = await supabaseAdmin
    .from('complexes')
    .select('name, slug')
    .eq('id', complexId)
    .single();
  if (ce) throw new Error(ce.message);

  const { data: users, error: ue } = await supabaseAdmin
    .from('user_profiles')
    .select('id, display_name, role')
    .eq('complex_id', complexId)
    .eq('active', true)
    .in('role', ['admin', 'mining_supervisor', 'mill_supervisor'])
    .order('role')
    .order('display_name');
  if (ue) throw new Error(ue.message);

  // Get emails from auth.users (we need to list them)
  const userIds = users?.map((u) => u.id) ?? [];
  const authUsers: Record<string, string> = {};

  // We can't directly query auth.users by ID list with service role easily,
  // so we'll use the listUsers API with pagination
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const { data: authPage } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (!authPage?.users?.length) {
      hasMore = false;
      break;
    }
    for (const au of authPage.users) {
      if (userIds.includes(au.id)) {
        authUsers[au.id] = au.email ?? '';
      }
    }
    if (authPage.users.length < 100) hasMore = false;
    else page++;
  }

  return {
    complex,
    users: (users ?? []).map((u) => ({
      ...u,
      email: authUsers[u.id] ?? '(sin email)',
    })),
  };
}

// ============================================================
// AUDIT LOG (simple — reads from nomina_audit_log or similar)
// ============================================================

export async function getAuditLogs(limit = 100) {
  await requireRole('admin_developer');
  // Use nomina_audit_log if it exists, otherwise return empty
  try {
    const { data, error } = await supabaseAdmin
      .from('nomina_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

// ============================================================
// STATS for dashboard
// ============================================================

export async function getAdminDevStats() {
  await requireRole('admin_developer');

  const [complexesRes, usersRes, devsRes] = await Promise.all([
    supabaseAdmin.from('complexes').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin_developer'),
  ]);

  return {
    totalComplexes: complexesRes.count ?? 0,
    totalUsers: usersRes.count ?? 0,
    totalDevelopers: devsRes.count ?? 0,
  };
}
