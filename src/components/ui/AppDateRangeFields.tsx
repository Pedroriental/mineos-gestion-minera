'use client';

import { cn } from '@/lib/utils';
import { AppDatePicker } from '@/components/ui/AppDatePicker';

type AppDateRangeFieldsProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  labelClassName?: string;
  layout?: 'stack' | 'pair';
  className?: string;
  disabled?: boolean;
};

export function AppDateRangeFields({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'Desde',
  toLabel = 'Hasta',
  fromPlaceholder = 'Desde',
  toPlaceholder = 'Hasta',
  labelClassName,
  layout = 'stack',
  className,
  disabled,
}: AppDateRangeFieldsProps) {
  return (
    <div
      className={cn(
        'app-date-range-fields',
        layout === 'pair' && 'app-date-range-fields--pair',
        className,
      )}
    >
      <div className="app-date-range-fields__item">
        <label className={cn('app-date-range-fields__label', labelClassName)}>{fromLabel}</label>
        <AppDatePicker
          className="w-full"
          value={from}
          onChange={onFromChange}
          placeholder={fromPlaceholder}
          disabled={disabled}
        />
      </div>
      <div className="app-date-range-fields__item">
        <label className={cn('app-date-range-fields__label', labelClassName)}>{toLabel}</label>
        <AppDatePicker
          className="w-full"
          value={to}
          onChange={onToChange}
          placeholder={toPlaceholder}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
