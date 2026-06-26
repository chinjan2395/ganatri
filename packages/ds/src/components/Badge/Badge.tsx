import type { ReactNode } from 'react';
import './Badge.css';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface DsBadgeProps {
  label: string;
  tone?: Tone;
}

export function DsBadge({ label, tone = 'default' }: DsBadgeProps): ReactNode {
  return <span className={`ds-badge ds-badge--${tone}`}>{label}</span>;
}
