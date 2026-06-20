'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, Shield, Activity, Plus, ChevronRight, ArrowRight, Sparkles,
} from 'lucide-react';
import { getAdminDevStats, getAllUsersWithEmails, getComplexes } from '@/lib/actions/admin-dev';
import { MINEOS_BTN_PRIMARY } from '@/lib/mineos-visual';

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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-[var(--mineos-general)]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--mineos-general)]">
            Panel de Control
          </p>
        </div>
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
          { label: 'Complejos', value: stats?.totalComplexes ?? 0, icon: Building2 },
          { label: 'Usuarios', value: stats?.totalUsers ?? 0, icon: Users },
          { label: 'Desarrolladores', value: stats?.totalDevelopers ?? 0, icon: Shield },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl border border-[var(--mineos-general-border)] bg-[var(--card-bg)] p-5 transition-all duration-300 hover:border-[var(--mineos-general)]/40 hover:shadow-lg hover:shadow-[var(--mineos-general)]/5"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-500 group-hover:opacity-70"
                style={{ background: 'var(--mineos-gradient-kpi-general)' }}
              />
              <div className="relative flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--mineos-general-soft)] border border-[var(--mineos-general-border)]">
                  <Icon className="h-5 w-5 text-[var(--mineos-general-bright)]" />
                </div>
                <div>
                  <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                    {s.value}
                  </p>
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
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface-sunken)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Complexes */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[var(--mineos-general)]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Complejos</h2>
                <span className="rounded-full bg-[var(--mineos-general)] px-2 py-0.5 text-[10px] font-bold text-black">
                  {complexes.length}
                </span>
              </div>
              <button
                onClick={() => router.push('/admin-dev/complexes')}
                className={MINEOS_BTN_PRIMARY + ' flex items-center gap-1.5 px-3 py-1.5 text-xs'}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>
            {complexes.length === 0 ? (
              <div className="rounded-2xl border border-[var(--mineos-general-border)] bg-[var(--card-bg)] py-12 text-center">
                <Building2 className="mx-auto mb-3 h-8 w-8 text-[var(--mineos-neutral-muted)]" />
                <p className="text-sm text-[var(--text-secondary)]">No hay complejos registrados</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {complexes.map((c) => {
                  const userCount = users.filter((u) => u.complex_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleEnterComplex(c.id)}
                      className="group relative overflow-hidden rounded-2xl border border-[var(--mineos-general-border)] bg-[var(--card-bg)] p-6 text-left transition-all duration-300 hover:border-[var(--mineos-general)]/50 hover:shadow-xl hover:shadow-[var(--mineos-general)]/8"
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-50"
                        style={{ background: 'var(--mineos-gradient-kpi-general)' }}
                      />
                      <div className="relative">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--mineos-general-soft)] border border-[var(--mineos-general-border)] transition-colors group-hover:bg-[var(--mineos-general)]/20">
                          <Building2 className="h-6 w-6 text-[var(--mineos-general-bright)]" />
                        </div>
                        <h3 className="mb-1 text-base font-bold text-[var(--text-primary)]">{c.name}</h3>
                        <p className="mb-4 text-xs text-[var(--text-secondary)]">
                          {userCount} usuario{userCount !== 1 ? 's' : ''} · {c.active ? 'Activo' : 'Inactivo'}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--mineos-general-bright)] opacity-0 transition-all duration-300 group-hover:opacity-100">
                          Entrar al complejo
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick Links */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--mineos-general)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Accesos Rápidos</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => router.push('/admin-dev/users/developers')}
                className="group flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 transition-all duration-300 hover:border-[var(--mineos-general-border)] hover:shadow-lg hover:shadow-[var(--mineos-general)]/5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--mineos-general-soft)] border border-[var(--mineos-general-border)]">
                    <Shield className="h-5 w-5 text-[var(--mineos-general-bright)]" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-[var(--text-primary)]">Admin Developers</span>
                    <p className="text-xs text-[var(--text-secondary)]">{developers.length} registrados</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--mineos-general-bright)]" />
              </button>
              <button
                onClick={() => router.push('/admin-dev/audit')}
                className="group flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 transition-all duration-300 hover:border-[var(--mineos-general-border)] hover:shadow-lg hover:shadow-[var(--mineos-general)]/5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--mineos-general-soft)] border border-[var(--mineos-general-border)]">
                    <Activity className="h-5 w-5 text-[var(--mineos-general-bright)]" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-[var(--text-primary)]">Auditoría</span>
                    <p className="text-xs text-[var(--text-secondary)]">Registro de actividad</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--mineos-general-bright)]" />
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
