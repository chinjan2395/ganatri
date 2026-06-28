import type { ReactNode } from 'react';
import { DsIcon } from '../Icon';
import './TitleBlock.css';

export interface DsTitleBlockProps {
  title: string;
  subtitle?: string;
  /** Show a crown icon above the flourish. Default false. */
  showCrown?: boolean;
  /** Size variant. Default "md" */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DsTitleBlock({
  title,
  subtitle,
  showCrown = false,
  size = 'md',
  className,
}: DsTitleBlockProps): ReactNode {
  const rootClass = `ds-title-block ds-title-block--${size}${className ? ` ${className}` : ''}`;
  return (
    <div className={rootClass}>
      {showCrown ? (
        <span className="ds-title-block__crown" aria-hidden="true">
          <DsIcon name="crown" size={24} aria-hidden />
        </span>
      ) : null}
      <span className="ds-title-block__flourish" aria-hidden="true">
        <DsIcon name="flourish" size={48} aria-hidden />
      </span>
      <h2 className="ds-title-block__title">{title}</h2>
      {subtitle !== undefined ? (
        <p className="ds-title-block__subtitle">{subtitle}</p>
      ) : null}
    </div>
  );
}
