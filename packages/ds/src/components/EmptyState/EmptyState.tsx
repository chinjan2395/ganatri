import type { ReactNode } from 'react';
import './EmptyState.css';

export interface DsEmptyStateProps {
  message: string;
  className?: string;
}

export function DsEmptyState({ message, className }: DsEmptyStateProps): ReactNode {
  const rootClass = `ds-empty-state${className ? ` ${className}` : ''}`;
  return (
    <p className={rootClass}>{message}</p>
  );
}
