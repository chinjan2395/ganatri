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
  /** HTML button type — defaults to "button" */
  type?: 'button' | 'submit' | 'reset';
  /** Extra CSS class names */
  className?: string;
  /** tooltip / aria title */
  title?: string;
}

export function DsButton({
  label,
  tone = 'primary',
  compact = false,
  disabled = false,
  onClick,
  children,
  type = 'button',
  className,
  title,
}: DsButtonProps): ReactNode {
  const cls = [
    'ds-button',
    `ds-button--${tone}`,
    compact ? 'ds-button--compact' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children ?? label}
    </button>
  );
}
