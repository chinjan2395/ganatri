import type { ReactNode } from 'react';
import './Card.css';

export type CardTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface CardProps {
  title?: string;
  subtitle?: string;
  tone?: CardTone;
  children: ReactNode;
}

export function Card({ title, subtitle, tone = 'default', children }: CardProps) {
  return (
    <article className={`ds-card ds-card--${tone}`}>
      {(title ?? subtitle) ? (
        <div className="ds-card__header">
          {title ? <h3>{title}</h3> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </article>
  );
}
