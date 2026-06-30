import type { ReactNode } from 'react';
import './SectionHeading.css';

export interface DsSectionHeadingProps {
  level: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}

export function DsSectionHeading({ level, children, className }: DsSectionHeadingProps): ReactNode {
  const rootClass = `ds-section-heading ds-section-heading--h${level}${className ? ` ${className}` : ''}`;
  if (level === 2) return <h2 className={rootClass}>{children}</h2>;
  if (level === 3) return <h3 className={rootClass}>{children}</h3>;
  return <h4 className={rootClass}>{children}</h4>;
}
