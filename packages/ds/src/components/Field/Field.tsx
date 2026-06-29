import type { ReactNode } from 'react';
import './Field.css';

export interface DsFieldProps {
  label?: string;
  value?: string;
  placeholder?: string;
  helper?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** triggers on Enter keydown */
  onSubmit?: () => void;
  maxLength?: number;
  autoFocus?: boolean;
  autoCapitalize?: string;
  type?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function DsField({
  label,
  value,
  placeholder,
  helper,
  onChange,
  onKeyDown,
  onSubmit,
  maxLength,
  autoFocus,
  autoCapitalize,
  type = 'text',
  id,
  name,
  disabled,
  inputRef,
}: DsFieldProps): ReactNode {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (onSubmit && e.key === 'Enter') onSubmit();
    onKeyDown?.(e);
  }

  return (
    <label className="ds-field">
      {label !== undefined ? <span className="ds-field__label">{label}</span> : null}
      <input
        ref={inputRef}
        type={type}
        id={id}
        name={name}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        disabled={disabled}
        readOnly={onChange === undefined}
        onChange={onChange ?? (() => undefined)}
        onKeyDown={onSubmit !== undefined || onKeyDown !== undefined ? handleKeyDown : undefined}
      />
      {helper !== undefined ? <span className="ds-field__helper">{helper}</span> : null}
    </label>
  );
}
