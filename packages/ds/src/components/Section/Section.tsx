import type { ReactNode } from 'react';
import './Section.css';

export interface SectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="ds-section">
      <div className="ds-section__header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}
