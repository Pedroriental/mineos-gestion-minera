'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, Shield, Activity, FileDown, ChevronRight, Circle } from 'lucide-react';
import { getAdminDevStats, getAllUsersWithEmails, getComplexCredentials } from '@/lib/actions/admin-dev';
import { downloadCredentialPDF } from '@/lib/credential-pdf';

const ROLE_LABELS: Record<string, string> = {
  admin_developer: 'Desarrollador',
  admin: 'Administrador',
  mining_supervisor: 'Sup. Mina',
  mill_supervisor: 'Sup. Molino',
};

const ROLE_COLORS: Record<string, string> = {
  admin_developer: 'bg-purple-500/15 text-purple-400',
  admin: 'bg-blue-500/15 text-blue-400',
  mining_supervisor: 'bg-amber-500/15 text-amber-400',
  mill_supervisor: 'bg-emerald-500/15 text-emerald-400',
};

interface UserWithEmail {
  id: string;
  display_name: string;
  role: string;
  complex_id: string | null;
  active: boolean;
  email: string;
  complex_name: string | null;
}

export default function AdminDevDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<{ totalComplexes: number; totalUsers: number; totalDevelopers: number } | null>(null);
  const [users, setUsers] = useState<UserWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([getAdminDevStats(), getAllUsersWithEmails()]);
      setStats(s);
      setUsers(u as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group users by complex
  const complexGroups = new Map<string, UserWithEmail[]>();
  const developers: UserWithEmail[] = [];
  const unassigned: UserWithEmail[] = [];

  for (const u of users) {
    if (u.role === 'admin_developer') {
      developers.push(u);
    } else if (u.complex_id) {
      const key = u.complex_name ?? '(sin complejo)';
      if (!complexGroups.has(key)) complexGroups.set(key, []);
      complexGroups.get(key)!.push(u);
    } else {
      unassigned.push(u);
    }
  }

  const handleGeneratePDF = async (complexId: string) => {
    setGeneratingPdf(complexId);
    try {
      const data = await getComplexCredentials(complexId);
      downloadCredentialPDF(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setGeneratingPdf(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 ring-1 ring-purple-500/30">
            <Shield className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--dashboard-text)]">Panel Admin Developer</h1>
            <p className="text-sm text-[var(--dashboard-text-muted)]">Gestión global del sistema MineOS</p>
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Complejos', value: stats?.totalComplexes ?? 0, icon: Building2, color: 'amber' },
          { label: 'Usuarios', value: stats?.totalUsers ?? 0, icon: Users, color: 'blue' },
          { label: 'Admin Developers', value: stats?.totalDevelopers ?? 0, icon: Shield, color: 'purple' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${s.color}-500/15`}>
                  <Icon className={`h-4 w-4 text-${s.color}-400`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--dashboard-text)]">{s.value}</p>
                  <p className="text-[11px] text-[var(--dashboard-text-muted)]">{s.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--dashboard-card-muted)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Admin Developers List */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-400" />
              <h2 className="font-semibold text-[var(--dashboard-text)]">Admin Developers</h2>
              <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-400">
                {developers.length}
              </span>
            </div>
            {developers.length === 0 ? (
              <p className="text-sm text-[var(--dashboard-text-muted)]">No hay admin developers registrados</p>
            ) : (
              <div className="space-y-1.5">
                {developers.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Circle className="h-2 w-2 shrink-0 fill-purple-400 text-purple-400" />
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--dashboard-text)]">{d.display_name}</p>
                        <p className="text-xs text-[var(--dashboard-text-muted)]">{d.email}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-400">
                      Global
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Credentials per Complex */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FileDown className="h-4 w-4 text-amber-400" />
              <h2 className="font-semibold text-[var(--dashboard-text)]">Credenciales por Complejo</h2>
            </div>
            {complexGroups.size === 0 ? (
              <p className="text-sm text-[var(--dashboard-text-muted)]">No hay complejos con usuarios</p>
            ) : (
              <div className="space-y-3">
                {Array.from(complexGroups.entries()).map(([complexName, complexUsers]) => (
                  <div key={complexName} className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-[var(--dashboard-text-muted)]" />
                        <span className="font-semibold text-[var(--dashboard-text)]">{complexName}</span>
                        <span className="rounded-full bg-[var(--dashboard-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--dashboard-text-muted)]">
                          {complexUsers.length} usuarios
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const cid = complexUsers[0]?.complex_id;
                          if (cid) handleGeneratePDF(cid);
                        }}
                        disabled={generatingPdf === complexUsers[0]?.complex_id}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 disabled:opacity-50"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </div>
                    <div className="divide-y divide-[var(--dashboard-border)]">
                      {complexUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--dashboard-text)]">{u.display_name}</p>
                            <p className="text-xs text-[var(--dashboard-text-muted)]">{u.email}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${ROLE_COLORS[u.role] ?? ''}`}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Navigation Cards */}
          <section className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => router.push('/admin-dev/complexes')}
              className="group flex items-center justify-between rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-4 transition-all hover:border-amber-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
                  <Building2 className="h-4 w-4 text-amber-400" />
                </div>
                <span className="font-semibold text-[var(--dashboard-text)]">Gestionar Complejos</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--dashboard-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => router.push('/admin-dev/users/developers')}
              className="group flex items-center justify-between rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-4 transition-all hover:border-purple-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15">
                  <Shield className="h-4 w-4 text-purple-400" />
                </div>
                <span className="font-semibold text-[var(--dashboard-text)]">Crear Admin Developers</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--dashboard-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
