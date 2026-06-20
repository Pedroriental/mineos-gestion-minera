'use client';

import { useEffect, useState, useCallback } from 'react';
import { Shield, Plus, Check, X, Trash2 } from 'lucide-react';
import { getAllDevelopers, createUser, deleteUser } from '@/lib/actions/admin-dev';
import { mineosPanel, MINEOS_BTN_PRIMARY } from '@/lib/mineos-visual';

interface DevUser {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
  created_at: string;
}

export default function DevelopersPage() {
  const [developers, setDevelopers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getAllDevelopers();
      setDevelopers(data as any);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
        role: 'admin_developer',
      });
      setSuccess(`Creado: ${newName} (${newEmail})`);
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
    if (!confirm(`¿Eliminar al Admin Developer "${name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await deleteUser(userId);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="app-viewport-canvas mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--mineos-general-bright)]/70">
            Desarrollo
          </p>
          <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Admin Developers</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Acceso global a todos los complejos</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className={MINEOS_BTN_PRIMARY + ' flex items-center gap-2 px-4 py-2 text-sm'}
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-[var(--mineos-expense-border)] bg-[var(--mineos-expense-soft)] px-4 py-3 text-sm text-[var(--mineos-expense)]">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-[var(--mineos-benefit-border)] bg-[var(--mineos-benefit-soft)] px-4 py-3 text-sm text-[var(--mineos-benefit)]">
          {success}
        </div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-xl border border-[var(--mineos-general-border)] bg-[var(--card-bg)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Crear Admin Developer</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Nombre</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Email</label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                placeholder="dev@mineos.local"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Contraseña</label>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} className="flex items-center gap-1.5 rounded-lg bg-[var(--mineos-general)] px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[var(--mineos-general-bright)]">
              <Check className="h-3.5 h-3.5" /> Crear
            </button>
            <button onClick={() => { setShowCreate(false); setError(''); }} className="flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface-sunken)]" />
          ))}
        </div>
      ) : developers.length === 0 ? (
        <div className={mineosPanel('general') + ' py-16 text-center'}>
          <Shield className="mx-auto mb-3 h-8 w-8 text-[var(--mineos-neutral-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">No hay Admin Developers registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {developers.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 transition-colors hover:border-[var(--mineos-general-border)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">{d.display_name}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">Acceso global — sin complejo asignado</p>
              </div>
              <button
                onClick={() => handleDelete(d.id, d.display_name)}
                className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--mineos-expense-soft)] hover:text-[var(--mineos-expense)]"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
