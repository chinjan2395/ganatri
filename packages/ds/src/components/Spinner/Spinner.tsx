import type { ReactNode } from 'react';
import './Spinner.css';

export interface DsSpinnerProps {
  size?: number;
  className?: string;
}

export function DsSpinner({ size = 32, className }: DsSpinnerProps): ReactNode {
  const rootClass = `ds-spinner${className ? ` ${className}` : ''}`;
  return (
    <div
      className={rootClass}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
