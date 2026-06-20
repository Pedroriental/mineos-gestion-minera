'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, Shield, Activity, Plus, ChevronRight, Circle, ArrowRight,
} from 'lucide-react';
import { getAdminDevStats, getAllUsersWithEmails, getComplexes } from '@/lib/actions/admin-dev';

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

interface Complex {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export default function AdminDevDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<{ totalComplexes: number; totalUsers: number; totalDevelopers: number } | null>(null);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [users, setUsers] = useState<UserWithEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, u, c] = await Promise.all([getAdminDevStats(), getAllUsersWithEmails(), getComplexes()]);
      setStats(s);
      setUsers(u as any);
      setComplexes(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const developers = users.filter((u) => u.role === 'admin_developer');

  const handleEnterComplex = (complexId: string) => {
    localStorage.setItem('mineos_active_complex', complexId);
    router.push('/dashboard');
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
        <div className="space-y-8">
          {/* Complexes as Cards */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-400" />
                <h2 className="font-semibold text-[var(--dashboard-text)]">Complejos</h2>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  {complexes.length}
                </span>
              </div>
              <button
                onClick={() => router.push('/admin-dev/complexes')}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Complejo
              </button>
            </div>
            {complexes.length === 0 ? (
              <p className="text-sm text-[var(--dashboard-text-muted)]">No hay complejos registrados</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {complexes.map((c) => {
                  const userCount = users.filter((u) => u.complex_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleEnterComplex(c.id)}
                      className="group flex flex-col items-start rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-5 text-left transition-all hover:border-amber-500/40 hover:bg-[var(--dashboard-card)]/80"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
                        <Building2 className="h-5 w-5 text-amber-400" />
                      </div>
                      <h3 className="mb-1 font-semibold text-[var(--dashboard-text)]">{c.name}</h3>
                      <p className="mb-3 text-xs text-[var(--dashboard-text-muted)]">
                        {userCount} usuario{userCount !== 1 ? 's' : ''} · {c.active ? 'Activo' : 'Inactivo'}
                      </p>
                      <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-amber-400 opacity-0 transition-opacity group-hover:opacity-100">
                        Entrar al complejo
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick Links */}
          <section className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => router.push('/admin-dev/users/developers')}
              className="group flex items-center justify-between rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-4 transition-all hover:border-purple-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15">
                  <Shield className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <span className="font-semibold text-[var(--dashboard-text)]">Admin Developers</span>
                  <p className="text-[11px] text-[var(--dashboard-text-muted)]">{developers.length} registrados</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--dashboard-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => router.push('/admin-dev/audit')}
              className="group flex items-center justify-between rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-4 transition-all hover:border-emerald-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Activity className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="font-semibold text-[var(--dashboard-text)]">Auditoría</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--dashboard-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
