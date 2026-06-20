'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, Shield, Activity, Plus, ChevronRight, ArrowRight,
} from 'lucide-react';
import { getAdminDevStats, getAllUsersWithEmails, getComplexes } from '@/lib/actions/admin-dev';
import { mineosPanel, mineosKpiValue, mineosKpiGlow } from '@/lib/mineos-visual';

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

const ROLE_LABELS: Record<string, string> = {
  admin_developer: 'Desarrollador',
  admin: 'Administrador',
  mining_supervisor: 'Sup. Mina',
  mill_supervisor: 'Sup. Molino',
  guest: 'Observador',
};

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
    <div className="app-viewport-canvas mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--mineos-general-bright)]/70">
          Panel de Control
        </p>
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
          Desarrollo
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Gestión global del sistema MineOS
        </p>
      </header>

      {/* KPI Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Complejos', value: stats?.totalComplexes ?? 0, icon: Building2, tone: 'general' as const },
          { label: 'Usuarios', value: stats?.totalUsers ?? 0, icon: Users, tone: 'benefit' as const },
          { label: 'Desarrolladores', value: stats?.totalDevelopers ?? 0, icon: Shield, tone: 'neutral' as const },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`relative overflow-hidden rounded-xl border border-[var(--mineos-general-border)] bg-[var(--card-bg)] p-5`}
            >
              {/* Gold gradient wash */}
              <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{ background: 'var(--mineos-gradient-kpi-general)' }}
              />
              <div className="relative flex items-center gap-4">
                <div className={mineosKpiGlow(s.tone)}>
                  <Icon className={`h-5 w-5 ${s.tone === 'neutral' ? 'text-[var(--mineos-neutral-muted)]' : 'text-[var(--mineos-general-bright)]'}`} />
                </div>
                <div>
                  <p className={mineosKpiValue(s.tone)}>{s.value}</p>
                  <p className="text-[11px] font-medium text-[var(--text-secondary)]">{s.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--surface-sunken)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Complexes */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[var(--mineos-general-bright)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Complejos</h2>
                <span className="rounded-full bg-[var(--mineos-general-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mineos-general-bright)]">
                  {complexes.length}
                </span>
              </div>
              <button
                onClick={() => router.push('/admin-dev/complexes')}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--mineos-general-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--mineos-general-bright)] transition-colors hover:bg-[var(--mineos-general-border)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>
            {complexes.length === 0 ? (
              <div className={mineosPanel('general')}>
                <p className="text-sm text-[var(--text-secondary)]">No hay complejos registrados</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {complexes.map((c) => {
                  const userCount = users.filter((u) => u.complex_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleEnterComplex(c.id)}
                      className="group relative overflow-hidden rounded-xl border border-[var(--mineos-general-border)] bg-[var(--card-bg)] p-5 text-left transition-all hover:border-[var(--mineos-general-bright)]/40"
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{ background: 'var(--mineos-gradient-kpi-general)' }}
                      />
                      <div className="relative">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--mineos-general-soft)]">
                          <Building2 className="h-5 w-5 text-[var(--mineos-general-bright)]" />
                        </div>
                        <h3 className="mb-1 text-sm font-bold text-[var(--text-primary)]">{c.name}</h3>
                        <p className="mb-3 text-[11px] text-[var(--text-secondary)]">
                          {userCount} usuario{userCount !== 1 ? 's' : ''} · {c.active ? 'Activo' : 'Inactivo'}
                        </p>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mineos-general-bright)] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          Entrar
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
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
              className="group flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition-all hover:border-[var(--mineos-general-border)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--mineos-general-soft)]">
                  <Shield className="h-4 w-4 text-[var(--mineos-general-bright)]" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Admin Developers</span>
                  <p className="text-[11px] text-[var(--text-secondary)]">{developers.length} registrados</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => router.push('/admin-dev/audit')}
              className="group flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition-all hover:border-[var(--mineos-general-border)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--mineos-general-soft)]">
                  <Activity className="h-4 w-4 text-[var(--mineos-general-bright)]" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Auditoría</span>
                  <p className="text-[11px] text-[var(--text-secondary)]">Registro de actividad</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
