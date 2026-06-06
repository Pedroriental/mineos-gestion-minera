'use client';

import { AppDatePicker } from '@/components/ui/AppDatePicker';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ReconciliacionDateField({ label, value, onChange }: Props) {
  return (
    <div className="app-date-range-fields__item">
      <span className="app-date-range-fields__label text-[8px] font-bold uppercase text-zinc-500">
        {label}
      </span>
      <AppDatePicker className="w-full" value={value} onChange={onChange} />
    </div>
  );
}
