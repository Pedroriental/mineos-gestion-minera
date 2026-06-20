'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Check, X, Trash2, Edit2, Users, FileDown, ArrowRight } from 'lucide-react';
import { getComplexes, createComplex, updateComplex, deleteComplex, getUsersByComplex, getComplexCredentials } from '@/lib/actions/admin-dev';
import { downloadCredentialPDF } from '@/lib/credential-pdf';
import type { Complex } from '@/lib/types';

export default function ComplexesPage() {
  const router = useRouter();
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [error, setError] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getComplexes();
      setComplexes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    setError('');
    try {
      await createComplex(newName.trim(), newSlug.trim().toLowerCase().replace(/\s+/g, '-'));
      setNewName('');
      setNewSlug('');
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdate = async (id: string) => {
    setError('');
    try {
      await updateComplex(id, { name: editName.trim(), slug: editSlug.trim().toLowerCase().replace(/\s+/g, '-') });
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    setError('');
    try {
      await updateComplex(id, { active: !active });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el complejo "${name}"? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await deleteComplex(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleGeneratePDF = async (complexId: string, complexName: string) => {
    setGeneratingPdf(complexId);
    try {
      const data = await getComplexCredentials(complexId);
      downloadCredentialPDF(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGeneratingPdf(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30">
            <Building2 className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--dashboard-text)]">Complejos</h1>
            <p className="text-sm text-[var(--dashboard-text-muted)]">Gestionar complejos mineros</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--dashboard-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nuevo Complejo
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-5">
          <h3 className="mb-3 font-semibold text-[var(--dashboard-text)]">Crear Complejo</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Nombre</label>
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                }}
                placeholder="Ej: Mina Belén"
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dashboard-text-muted)]">Slug</label>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                placeholder="mina-belen"
                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} className="flex items-center gap-1.5 rounded-lg bg-[var(--dashboard-accent)] px-3 py-1.5 text-sm font-semibold text-white">
              <Check className="h-3.5 w-3.5" /> Crear
            </button>
            <button onClick={() => { setShowCreate(false); setNewName(''); setNewSlug(''); }} className="flex items-center gap-1.5 rounded-lg bg-[var(--dashboard-card-muted)] px-3 py-1.5 text-sm text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--dashboard-card-muted)]" />
          ))}
        </div>
      ) : complexes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--dashboard-border)] p-12 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-[var(--dashboard-text-muted)]" />
          <p className="text-sm text-[var(--dashboard-text-muted)]">No hay complejos creados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complexes.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-4"
            >
              {editing === c.id ? (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
                    />
                    <input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                      className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] px-3 py-2 text-sm text-[var(--dashboard-text)] outline-none focus:border-[var(--dashboard-accent)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(c.id)} className="flex items-center gap-1 rounded-lg bg-[var(--dashboard-accent)] px-3 py-1.5 text-xs font-semibold text-white">
                      <Check className="h-3 w-3" /> Guardar
                    </button>
                    <button onClick={() => setEditing(null)} className="rounded-lg bg-[var(--dashboard-card-muted)] px-3 py-1.5 text-xs text-[var(--dashboard-text-muted)]">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--dashboard-text)]">{c.name}</h3>
                      <span className="rounded-full bg-[var(--dashboard-card-muted)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                        {c.slug}
                      </span>
                      {!c.active && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        localStorage.setItem('mineos_active_complex', c.id);
                        router.push('/admin');
                      }}
                      className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/25"
                      title="Entrar al complejo"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Entrar
                    </button>
                    <button
                      onClick={() => router.push(`/admin-dev/complexes/${c.id}`)}
                      className="rounded-lg p-2 text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-accent)]/10 hover:text-[var(--dashboard-accent)]"
                      title="Gestionar usuarios"
                    >
                      <Users className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleGeneratePDF(c.id, c.name)}
                      disabled={generatingPdf === c.id}
                      className="rounded-lg p-2 text-[var(--dashboard-text-muted)] hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
                      title="Generar credenciales PDF"
                    >
                      <FileDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setEditing(c.id); setEditName(c.name); setEditSlug(c.slug); }}
                      className="rounded-lg p-2 text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-accent)]/10 hover:text-[var(--dashboard-accent)]"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(c.id, c.active)}
                      className={`rounded-lg p-2 ${c.active ? 'text-[var(--dashboard-text-muted)] hover:bg-amber-500/10 hover:text-amber-400' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                      title={c.active ? 'Desactivar' : 'Activar'}
                    >
                      {c.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="rounded-lg p-2 text-[var(--dashboard-text-muted)] hover:bg-red-500/10 hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
