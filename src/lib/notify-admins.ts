import { createServerClient } from './supabase-server';
import type { UserRole } from './types';

/**
 * Notify all admins in the same complex when a supervisor submits data.
 * Call this from any Server Action where a supervisor creates/updates a record.
 *
 * @param params.complexId - The complex where the action happened
 * @param params.type - Notification type (e.g., 'report_submitted', 'safety_incident')
 * @param params.title - Short title for the notification
 * @param params.body - Optional body text (e.g., "Juan envió reporte de extracción")
 * @param params.href - Optional deep link to the relevant page
 * @param params.actorId - The user who triggered the action
 * @param params.actorRole - The role of the actor (to skip if already admin)
 */
export async function notifyAdmins(params: {
  complexId: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  actorId: string;
  actorRole?: UserRole;
}) {
  // If the actor is already an admin, no need to notify admins
  if (params.actorRole === 'admin' || params.actorRole === 'admin_developer') {
    return;
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('notify_admins', {
    p_complex_id: params.complexId,
    p_type: params.type,
    p_title: params.title,
    p_body: params.body ?? null,
    p_href: params.href ?? null,
    p_actor_id: params.actorId,
  });

  if (error) {
    console.error('[notifyAdmins] Failed:', error.message);
  }
}
