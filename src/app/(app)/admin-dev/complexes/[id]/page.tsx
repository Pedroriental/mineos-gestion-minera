'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { ArrowLeft, Plus, Check, X, Trash2, Key, UserPlus, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getComplex, getUsersByComplex, createUser, deleteUser, resetUserPassword } from '@/lib/actions/admin-dev';
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
  const [resettingId, setResettingId] = useState<string | null>(null);
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
      setSuccess(`Usuario "${newName}" creado. Email: ${newEmail}`);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('admin');
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return;
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
      setSuccess('Contraseña actualizada.');
      setResettingId(null);
      setNewResetPass('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <button
        onClick={() => router.push('/admin-dev/complexes')}
        className="mb-4 flex items-center gap-1.5 text-sm text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Complejos
      </button>

      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dashboard-text)]">
            {complex?.name ?? 'Cargando...'}
          </h1>
          <p className="text-sm text-[var(--dashboard-text-muted)]">
            Usuarios asignados a este complejo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              localStorage.setItem('mineos_active_complex', id);
              router.push('/admin');
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/25"
          >
            <ArrowRight className="h-4 w-4" />
            Entrar al Complejo
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--dashboard-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            <UserPlus className="h-4 w-4" />
            Crear Usuario
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{success}</div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-5">
          <h3 className="mb-3 font-semibold text-[var(--dashboard-text)]">Crear Usuario</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Nombre completo</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Email</label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                placeholder="juan@mineos.local"
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Contraseña</label>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Rol</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} className="flex items-center gap-1.5 rounded-lg bg-[var(--dashboard-accent)] px-3 py-1.5 text-sm font-semibold text-white">
              <Check className="h-3.5 w-3.5" /> Crear
            </button>
            <button onClick={() => { setShowCreate(false); setError(''); }} className="flex items-center gap-1.5 rounded-lg bg-[var(--dashboard-card-muted)] px-3 py-1.5 text-sm text-[var(--dashboard-text-muted)]">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--dashboard-card-muted)]" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--dashboard-border)] p-12 text-center">
          <UserPlus className="mx-auto mb-3 h-8 w-8 text-[var(--dashboard-text-muted)]" />
          <p className="text-sm text-[var(--dashboard-text-muted)]">No hay usuarios asignados a este complejo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--dashboard-text)]">{u.display_name}</p>
                <p className="text-xs text-[var(--dashboard-text-muted)]">
                  {ROLE_LABELS[u.role] ?? u.role}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {resettingId === u.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={newResetPass}
                      onChange={(e) => setNewResetPass(e.target.value)}
                      type="password"
                      placeholder="Nueva contraseña"
                      className="w-36 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-2 py-1 text-xs text-[var(--dashboard-text)] outline-none"
                      autoFocus
                    />
                    <button onClick={() => handleResetPassword(u.id)} className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { setResettingId(null); setNewResetPass(''); }} className="rounded p-1 text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-card-muted)]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setResettingId(u.id); setNewResetPass(''); }}
                      className="rounded-lg p-2 text-[var(--dashboard-text-muted)] hover:bg-amber-500/10 hover:text-amber-400"
                      title="Restablecer contraseña"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.display_name)}
                      className="rounded-lg p-2 text-[var(--dashboard-text-muted)] hover:bg-red-500/10 hover:text-red-400"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
