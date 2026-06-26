import './Field.css';

export interface FieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  helper?: string;
}

export function Field({ label, value, placeholder, helper }: FieldProps) {
  return (
    <label className="ds-field">
      <span className="ds-field__label">{label}</span>
      <input value={value} placeholder={placeholder} readOnly />
      {helper ? <span className="ds-field__helper">{helper}</span> : null}
    </label>
  );
}
