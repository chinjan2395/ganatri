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
  /** Accessible label for icon-only buttons */
  'aria-label'?: string;
  // Touch / pointer event handlers for PTT-style interactions
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  onTouchStart?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchCancel?: (e: React.TouchEvent<HTMLButtonElement>) => void;
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
  'aria-label': ariaLabel,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
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
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {children ?? label}
    </button>
  );
}
