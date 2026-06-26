import './Button.css';

export type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ label, tone = 'primary', compact = false, disabled = false, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        'ds-button',
        `ds-button--${tone}`,
        compact ? 'ds-button--compact' : '',
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
