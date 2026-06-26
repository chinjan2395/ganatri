import type { ReactNode } from 'react';
import './PageHeader.css';

export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="ds-hero">
      <div className="ds-hero__copy">
        <span className="ds-eyebrow">{eyebrow}</span>
        <h1 className="ds-hero__title">{title}</h1>
        <p className="ds-hero__description">{description}</p>
      </div>
      {actions ? <div className="ds-hero__actions">{actions}</div> : null}
    </header>
  );
}
