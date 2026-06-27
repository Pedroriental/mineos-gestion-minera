'use client';

type Props = {
  value: string | null | undefined;
  size?: 'sm' | 'md';
};

export function TrabajadorCuadrillaBadge({ value, size = 'sm' }: Props) {
  if (!value || !value.trim()) {
    return (
      <span className={size === 'sm' ? 'text-[10px] text-zinc-600' : 'text-xs text-zinc-500'}>
        —
      </span>
    );
  }
  return (
    <span
      className={
        size === 'sm'
          ? 'inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300'
          : 'inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-300'
      }
    >
      {value}
    </span>
  );
}
