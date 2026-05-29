'use client';

import { useRef } from 'react';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ReconciliacionDateField({ label, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* fallback */
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className="min-w-0 space-y-0.5">
      <span className="text-[8px] font-bold uppercase text-zinc-500">{label}</span>
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        className="relative w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-900/60 px-2 py-1 transition-colors hover:border-white/20"
      >
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            e.stopPropagation();
            openPicker();
          }}
          className="reconciliacion-date-input relative z-[1] w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-xs leading-tight text-white outline-none"
        />
      </div>
    </div>
  );
}
