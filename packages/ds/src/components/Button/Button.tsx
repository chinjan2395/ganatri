import type { ReactNode } from 'react';
import './Button.css';

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

export interface DsButtonProps {
  label?: string;
  tone?: ButtonTone;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

export function DsButton({
  label,
  tone = 'primary',
  compact = false,
  disabled = false,
  onClick,
  children,
}: DsButtonProps): ReactNode {
  return (
    <button
      type="button"
      className={`ds-button ds-button--${tone}${compact ? ' ds-button--compact' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children ?? label}
    </button>
  );
}
