'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, ChevronDown, Globe } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Complex } from '@/lib/types';

const STORAGE_KEY = 'mineos_active_complex';

export function getActiveComplexId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setActiveComplexId(id: string | null) {
  if (id) {
    localStorage.setItem(STORAGE_KEY, id);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export default function ComplexSwitcher() {
  const { role, complexId } = useAuth();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const isDev = role === 'admin_developer';

  useEffect(() => {
    if (!isDev) return;
    const stored = getActiveComplexId();
    setActiveId(stored ?? complexId ?? null);

    supabase
      .from('complexes')
      .select('id, name, slug, active')
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setComplexes(data);
      });
  }, [isDev, complexId]);

  const positionMenu = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, []);

  const toggle = useCallback(() => {
    if (!open) positionMenu();
    setOpen((o) => !o);
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const select = (id: string | null) => {
    setActiveId(id);
    setActiveComplexId(id);
    setOpen(false);
    window.location.reload();
  };

  if (!isDev) return null;

  const selected = complexes.find((c) => c.id === activeId);
  const label = selected?.name ?? 'Todos los complejos';

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] font-semibold transition-all',
          open
            ? 'border-[var(--dashboard-accent)]/35 bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]'
            : 'border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]',
        )}
        title="Cambiar complejo activo"
      >
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden max-w-[10rem] truncate sm:inline">{label}</span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            className="app-popover fixed z-[201] w-64 overflow-hidden py-1 shadow-2xl"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <div className="border-b border-[var(--dashboard-border)] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dashboard-text-muted)]">
                Seleccionar Complejo
              </p>
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1">
              <button
                onClick={() => select(null)}
                className={cn(
                  'app-popover-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                  activeId === null && 'font-semibold text-[var(--dashboard-text)]',
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
                  <Globe className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate">Todos los complejos</span>
                {activeId === null && <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
              </button>

              {complexes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={cn(
                    'app-popover-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                    activeId === c.id && 'font-semibold text-[var(--dashboard-text)]',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--dashboard-accent)]/10 text-[var(--dashboard-accent)]">
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {activeId === c.id && <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
