'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { ArrowLeft, Plus, Check, X, Trash2, Key, UserPlus, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getComplex, getUsersByComplex, createUser, deleteUser, resetUserPassword } from '@/lib/actions/admin-dev';
import { mineosPanel, MINEOS_BTN_PRIMARY } from '@/lib/mineos-visual';
import type { UserProfile, UserRole } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  mining_supervisor: 'Supervisor de Mina',
  mill_supervisor: 'Supervisor de Molino',
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'mining_supervisor', label: 'Supervisor de Mina' },
  { value: 'mill_supervisor', label: 'Supervisor de Molino' },
];

export default function ComplexDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [complex, setComplex] = useState<{ name: string; slug: string } | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newResetPass, setNewResetPass] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([getComplex(id), getUsersByComplex(id)]);
      setComplex(c);
      setUsers(u as any);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newEmail.trim() || !newPassword.trim() || !newName.trim()) return;
    setError('');
    setSuccess('');
    try {
      await createUser({
        email: newEmail.trim(),
        password: newPassword,
        display_name: newName.trim(),
        role: newRole,
        complex_id: id,
      });
      setSuccess(`Usuario "${newName}" creado`);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await deleteUser(userId);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!newResetPass.trim()) return;
    setError('');
    setSuccess('');
    try {
      await resetUserPassword(userId, newResetPass);
      setSuccess('Contraseña actualizada');
      setResetUserId(null);
      setNewResetPass('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="app-viewport-canvas mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <button
        onClick={() => router.push('/admin-dev/complexes')}
        className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--mineos-general-bright)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a Complejos
      </button>

      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--mineos-general-bright)]/70">
            Desarrollo
          </p>
          <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {complex?.name ?? 'Cargando...'}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            Usuarios asignados a este complejo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              localStorage.setItem('mineos_active_complex', id);
              router.push('/dashboard');
            }}
            className="flex items-center gap-2 rounded-lg bg-[var(--mineos-general-soft)] px-4 py-2 text-sm font-semibold text-[var(--mineos-general-bright)] transition-colors hover:bg-[var(--mineos-general-border)]"
          >
            <ArrowRight className="h-4 w-4" />
            Entrar
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className={MINEOS_BTN_PRIMARY + ' flex items-center gap-2 px-4 py-2 text-sm'}
          >
            <UserPlus className="h-4 w-4" />
            Crear Usuario
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-[var(--mineos-expense-border)] bg-[var(--mineos-expense-soft)] px-4 py-3 text-sm text-[var(--mineos-expense)]">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-[var(--mineos-benefit-border)] bg-[var(--mineos-benefit-soft)] px-4 py-3 text-sm text-[var(--mineos-benefit)]">{success}</div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-xl border border-[var(--mineos-general-border)] bg-[var(--card-bg)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Crear Usuario</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Nombre</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre completo"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Email</label>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="usuario@mineos.local"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Contraseña</label>
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Rol</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} className="flex items-center gap-1.5 rounded-lg bg-[var(--mineos-general)] px-3 py-1.5 text-xs font-bold text-black hover:bg-[var(--mineos-general-bright)]">
              <Check className="h-3.5 w-3.5" /> Crear
            </button>
            <button onClick={() => setShowCreate(false)} className="flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--surface-sunken)]" />)}
        </div>
      ) : users.length === 0 ? (
        <div className={mineosPanel('general') + ' py-16 text-center'}>
          <UserPlus className="mx-auto mb-3 h-8 w-8 text-[var(--mineos-neutral-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">No hay usuarios en este complejo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 transition-colors hover:border-[var(--mineos-general-border)]">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">{(u as any).display_name}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {ROLE_LABELS[u.role] ?? u.role}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {resetUserId === u.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={newResetPass}
                      onChange={(e) => setNewResetPass(e.target.value)}
                      type="password"
                      placeholder="Nueva contraseña"
                      className="w-36 rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]"
                    />
                    <button onClick={() => handleResetPassword(u.id)} className="rounded p-1.5 text-[var(--mineos-benefit)] hover:bg-[var(--mineos-benefit-soft)]">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { setResetUserId(null); setNewResetPass(''); }} className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setResetUserId(u.id)} className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--mineos-general-soft)] hover:text-[var(--mineos-general-bright)]" title="Restablecer contraseña">
                    <Key className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => handleDelete(u.id, (u as any).display_name)} className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--mineos-expense-soft)] hover:text-[var(--mineos-expense)]" title="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
