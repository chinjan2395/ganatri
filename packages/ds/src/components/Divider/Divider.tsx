import type { ReactNode } from 'react';
import './Divider.css';

export interface DsDividerProps {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}

export function DsDivider({ orientation = 'horizontal', label }: DsDividerProps): ReactNode {
  return (
    <div className={`ds-divider ds-divider--${orientation}`} aria-hidden={!label}>
      {label ? <span className="ds-divider__label">{label}</span> : null}
    </div>
  );
}
