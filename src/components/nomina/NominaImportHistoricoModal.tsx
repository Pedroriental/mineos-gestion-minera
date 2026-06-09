'use client';

import { PageFormModal } from '@/components/ui/PageFormModal';
import { NominaImportWizard } from '@/components/nomina/NominaImportWizard';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  userId?: string;
  onImported?: () => void;
};

export function NominaImportHistoricoModal({ open, onClose, userId, onImported }: Props) {
  return (
    <PageFormModal open={open} onClose={onClose} panelClassName="sm:max-w-4xl">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 text-white/40 hover:text-white sm:right-6 sm:top-6"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
      <h3 className="page-form-modal-title mb-2 pr-10 text-xl font-bold tracking-wide text-white/90">
        Archivar nómina histórica
      </h3>
      <p className="mb-5 text-xs text-zinc-500 leading-relaxed">
        Carga Excel/PDF multi-semana (todas las áreas). Guarda periodos cerrados con montos exactos e
        infiere rotación automáticamente.
      </p>
      <NominaImportWizard
        userId={userId}
        onComplete={() => {
          onImported?.();
          onClose();
        }}
      />
    </PageFormModal>
  );
}
