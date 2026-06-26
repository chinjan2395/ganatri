import type { ReactNode } from 'react';
import './Card.css';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface DsCardProps {
  title?: string;
  subtitle?: string;
  tone?: Tone;
  children: ReactNode;
}

export function DsCard({
  title,
  subtitle,
  tone = 'default',
  children,
}: DsCardProps): ReactNode {
  return (
    <article className={`ds-card ds-card--${tone}`}>
      {title !== undefined || subtitle !== undefined ? (
        <div className="ds-card__header">
          {title !== undefined ? <h3>{title}</h3> : null}
          {subtitle !== undefined ? <p>{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </article>
  );
}
