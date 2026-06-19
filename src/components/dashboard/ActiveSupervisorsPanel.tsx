'use client';

import { useEffect, useState } from 'react';
import { Users, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SupervisorInfo {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
  lastSignIn?: string;
}

const ROLE_LABELS: Record<string, string> = {
  mining_supervisor: 'Sup. Mina',
  mill_supervisor: 'Sup. Molino',
  admin: 'Admin',
};

export function ActiveSupervisorsPanel() {
  const [supervisors, setSupervisors] = useState<SupervisorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, display_name, role, active')
        .in('role', ['admin', 'mining_supervisor', 'mill_supervisor'])
        .order('role')
        .order('display_name');

      if (!profiles) {
        setLoading(false);
        return;
      }

      // Get auth users for last sign-in
      const userIds = profiles.map((p) => p.id);
      const signInMap: Record<string, string> = {};

      // We can't directly query auth.users from client, so we'll use the profiles
      // The active status from user_profiles is sufficient for now

      setSupervisors(
        profiles.map((p) => ({
          id: p.id,
          display_name: p.display_name,
          role: p.role,
          active: p.active,
          lastSignIn: signInMap[p.id],
        })),
      );
      setLoading(false);
    };

    load();

    // Real-time subscription for user_profiles changes
    const channel = supabase
      .channel('supervisor-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => {
          load(); // Reload on any change
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-[var(--dashboard-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--dashboard-text)]">Supervisores</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--dashboard-card-muted)]" />
          ))}
        </div>
      </div>
    );
  }

  const activeCount = supervisors.filter((s) => s.active).length;

  return (
    <div className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--dashboard-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--dashboard-text)]">Supervisores</h3>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
          {activeCount} activos
        </span>
      </div>
      <div className="space-y-1.5">
        {supervisors.length === 0 ? (
          <p className="text-xs text-[var(--dashboard-text-muted)]">No hay supervisores registrados</p>
        ) : (
          supervisors.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--dashboard-card-muted)]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Circle
                  className={`h-2 w-2 shrink-0 ${s.active ? 'fill-emerald-400 text-emerald-400' : 'fill-gray-500 text-gray-500'}`}
                />
                <span className="truncate text-[12px] font-medium text-[var(--dashboard-text)]">
                  {s.display_name}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--dashboard-card-muted)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                {ROLE_LABELS[s.role] ?? s.role}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
