/**
 * Primitivos de Tabla — API compatible con Shadcn/ui
 * Estilos alineados al tema oscuro de MineOS.
 * No requiere Shadcn instalado.
 */
import { cn } from '@/lib/utils';
import * as React from 'react';

// ── Table ──────────────────────────────────────────────────
function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

// ── TableHeader ──────────────────────────────────────────
function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('[&_tr]:border-b [&_tr]:border-white/[0.06]', className)}
      {...props}
    />
  );
}

// ── TableBody ────────────────────────────────────────────
function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

// ── TableRow ─────────────────────────────────────────────
function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-white/[0.04] transition-colors',
        'hover:bg-white/[0.03] data-[state=selected]:bg-amber-400/5',
        className,
      )}
      {...props}
    />
  );
}

// ── TableHead ────────────────────────────────────────────
function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-10 px-4 text-left align-middle',
        'text-[10px] font-bold uppercase tracking-widest text-white/35',
        'whitespace-nowrap',
        '[&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

// ── TableCell ────────────────────────────────────────────
function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-sm text-white/70',
        '[&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

// ── TableCaption ─────────────────────────────────────────
function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('mt-4 text-xs text-white/35', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};
