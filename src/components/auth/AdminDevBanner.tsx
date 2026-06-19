'use client';

import { AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getActiveComplexId } from '@/components/ComplexSwitcher';
import { useState, useEffect } from 'react';

export function AdminDevBanner() {
  const { role } = useAuth();
  const [activeComplex, setActiveComplex] = useState<string | null>(null);

  useEffect(() => {
    setActiveComplex(getActiveComplexId());
  }, []);

  // Only show for admin_developer when inside a specific complex
  if (role !== 'admin_developer' || !activeComplex) return null;

  return (
    <div className="relative z-50 flex items-center gap-2.5 border-b border-purple-500/20 bg-purple-950/30 px-4 py-1.5 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
          Modo Admin Developer
        </span>
      </div>
      <span className="text-[11px] text-purple-300/70">
        Estás dentro de un complejo. Los cambios pueden afectar el funcionamiento del sistema.
      </span>
    </div>
  );
}
