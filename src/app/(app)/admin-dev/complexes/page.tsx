'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Check, X, Trash2, Edit2, Users, FileDown, ArrowRight } from 'lucide-react';
import { getComplexes, createComplex, updateComplex, deleteComplex, getUsersByComplex, getComplexCredentials } from '@/lib/actions/admin-dev';
import { downloadCredentialPDF } from '@/lib/credential-pdf';
import { mineosPanel, mineosBtnSubtleClass, MINEOS_BTN_PRIMARY } from '@/lib/mineos-visual';
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

  const handleGeneratePDF = async (complexId: string) => {
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
    <div className="app-viewport-canvas mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--mineos-general-bright)]/70">
            Desarrollo
          </p>
          <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Complejos</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Gestionar complejos mineros</p>
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

      {showCreate && (
        <div className="mb-6 rounded-xl border border-[var(--mineos-general-border)] bg-[var(--card-bg)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Crear Complejo</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Nombre</label>
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                }}
                placeholder="Ej: La Fé"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Slug</label>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                placeholder="la-fe"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} className="flex items-center gap-1.5 rounded-lg bg-[var(--mineos-general)] px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[var(--mineos-general-bright)]">
              <Check className="h-3.5 w-3.5" /> Crear
            </button>
            <button onClick={() => { setShowCreate(false); setNewName(''); setNewSlug(''); }} className="flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--surface-sunken)]" />
          ))}
        </div>
      ) : complexes.length === 0 ? (
        <div className={mineosPanel('general') + ' py-16 text-center'}>
          <Building2 className="mx-auto mb-3 h-8 w-8 text-[var(--mineos-neutral-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">No hay complejos creados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complexes.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition-colors hover:border-[var(--mineos-general-border)]"
            >
              {editing === c.id ? (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]"
                    />
                    <input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                      className="rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(c.id)} className="flex items-center gap-1 rounded-lg bg-[var(--mineos-general)] px-3 py-1.5 text-xs font-bold text-black">
                      <Check className="h-3 w-3" /> Guardar
                    </button>
                    <button onClick={() => setEditing(null)} className="rounded-lg border border-[var(--card-border)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">{c.name}</h3>
                      <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        {c.slug}
                      </span>
                      {!c.active && (
                        <span className="rounded-full bg-[var(--mineos-expense-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--mineos-expense)]">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        localStorage.setItem('mineos_active_complex', c.id);
                        router.push('/dashboard');
                      }}
                      className="flex items-center gap-1 rounded-lg bg-[var(--mineos-general-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--mineos-general-bright)] transition-colors hover:bg-[var(--mineos-general-border)]"
                      title="Entrar al complejo"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Entrar
                    </button>
                    <button
                      onClick={() => router.push(`/admin-dev/complexes/${c.id}`)}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--mineos-general-soft)] hover:text-[var(--mineos-general-bright)]"
                      title="Gestionar usuarios"
                    >
                      <Users className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleGeneratePDF(c.id)}
                      disabled={generatingPdf === c.id}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--mineos-general-soft)] hover:text-[var(--mineos-general-bright)] disabled:opacity-50"
                      title="Generar credenciales PDF"
                    >
                      <FileDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setEditing(c.id); setEditName(c.name); setEditSlug(c.slug); }}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--mineos-general-soft)] hover:text-[var(--mineos-general-bright)]"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(c.id, c.active)}
                      className={`rounded-lg p-2 transition-colors ${c.active ? 'text-[var(--text-muted)] hover:bg-[var(--mineos-general-soft)] hover:text-[var(--mineos-general-bright)]' : 'text-[var(--mineos-benefit)] hover:bg-[var(--mineos-benefit-soft)]'}`}
                      title={c.active ? 'Desactivar' : 'Activar'}
                    >
                      {c.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--mineos-expense-soft)] hover:text-[var(--mineos-expense)]"
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
