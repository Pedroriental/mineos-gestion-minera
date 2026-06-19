'use client';

import { useEffect, useState, useCallback } from 'react';
import { Shield, Plus, Check, X, Trash2 } from 'lucide-react';
import { getAllDevelopers, createUser, deleteUser } from '@/lib/actions/admin-dev';

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
        // NO complex_id — admin_developer is global
      });
      setSuccess(`Admin Developer "${newName}" creado. Email: ${newEmail}`);
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
    if (!confirm(`¿Eliminar al Admin Developer "${name}"? Esta acción no se puede deshacer.`)) return;
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 ring-1 ring-purple-500/30">
            <Shield className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--dashboard-text)]">Admin Developers</h1>
            <p className="text-sm text-[var(--dashboard-text-muted)]">Acceso global a todos los complejos — sin asignación a ninguno</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--dashboard-accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Nuevo Admin Developer
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{success}</div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-5">
          <h3 className="mb-3 font-semibold text-[var(--dashboard-text)]">Crear Admin Developer</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Nombre completo</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre"
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Email</label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                placeholder="dev@mineos.local"
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Contraseña</label>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              />
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
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--dashboard-card-muted)]" />
          ))}
        </div>
      ) : developers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--dashboard-border)] p-12 text-center">
          <Shield className="mx-auto mb-3 h-8 w-8 text-[var(--dashboard-text-muted)]" />
          <p className="text-sm text-[var(--dashboard-text-muted)]">No hay Admin Developers registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {developers.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--dashboard-text)]">{d.display_name}</p>
                <p className="text-xs text-[var(--dashboard-text-muted)]">Acceso global — sin complejo asignado</p>
              </div>
              <button
                onClick={() => handleDelete(d.id, d.display_name)}
                className="rounded-lg p-2 text-[var(--dashboard-text-muted)] hover:bg-red-500/10 hover:text-red-400"
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
