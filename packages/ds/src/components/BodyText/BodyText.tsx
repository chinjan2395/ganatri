import type { ReactNode } from 'react';
import './BodyText.css';

export interface DsBodyTextProps {
  tone?: 'default' | 'muted' | 'error';
  children: ReactNode;
  className?: string;
}

export function DsBodyText({ tone = 'default', children, className }: DsBodyTextProps): ReactNode {
  const rootClass = `ds-body-text ds-body-text--${tone}${className ? ` ${className}` : ''}`;
  return <p className={rootClass}>{children}</p>;
}
