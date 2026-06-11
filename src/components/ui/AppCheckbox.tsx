'use client';

import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AppCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Compacto para tablas y grillas densas */
  size?: 'sm' | 'md';
  children?: ReactNode;
};

export function AppCheckbox({
  checked,
  onChange,
  disabled,
  id: idProp,
  className,
  size = 'md',
  children,
}: AppCheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <label
      htmlFor={id}
      className={cn(
        'app-checkbox',
        size === 'sm' && 'app-checkbox--sm',
        disabled && 'app-checkbox--disabled',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="app-checkbox__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="app-checkbox__box" aria-hidden>
        <Check className="app-checkbox__icon" strokeWidth={3} />
      </span>
      {children ? <span className="app-checkbox__label">{children}</span> : null}
    </label>
  );
}
