import type { ReactNode } from 'react';
import './Field.css';

export interface DsFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  helper?: string;
}

export function DsField({
  label,
  value,
  placeholder,
  helper,
}: DsFieldProps): ReactNode {
  return (
    <label className="ds-field">
      <span className="ds-field__label">{label}</span>
      <input value={value} placeholder={placeholder} readOnly onChange={() => undefined} />
      {helper !== undefined ? <span className="ds-field__helper">{helper}</span> : null}
    </label>
  );
}
