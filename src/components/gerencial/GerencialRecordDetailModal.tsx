'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';

type GerencialRecordDetailModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  sheetIcon?: ReactNode;
  panelClassName?: string;
  children: ReactNode;
};

export function GerencialRecordDetailModal({
  open,
  onClose,
  title,
  eyebrow = 'Detalle del registro',
  sheetIcon,
  panelClassName,
  children,
}: GerencialRecordDetailModalProps) {
  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      sheetTitle={title}
      sheetIcon={sheetIcon}
      panelClassName={panelClassName ?? 'sm:max-w-[72rem] sm:p-5'}
    >
      <div className="mb-4 hidden items-start justify-between gap-3 lg:flex">
        <div className="min-w-0">
          <p className="gastos-detail-eyebrow text-[9px] font-bold uppercase tracking-wider">{eyebrow}</p>
          <h2 className="page-form-modal-title truncate text-lg font-semibold">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg p-2 text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"
          aria-label="Cerrar detalle"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5">{children}</div>

      <PageFormModalFooter>
        <button type="button" onClick={onClose} className="btn-secondary">
          Cerrar
        </button>
      </PageFormModalFooter>
    </PageFormModal>
  );
}
