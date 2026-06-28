import type { ReactNode } from 'react';
import './Placeholder.css';

export type DsPlaceholderVariant = 'performance' | 'cards' | 'modes' | 'achievements';

export interface DsPlaceholderProps {
  variant: DsPlaceholderVariant;
  title: string;
  dropdownLabel?: string;
  linkLabel?: string;
  className?: string;
}

function PerformanceContent({ title, dropdownLabel }: { title: string; dropdownLabel?: string }): ReactNode {
  return (
    <>
      <div className="ds-placeholder__head">
        <h3 className="ds-placeholder__title">{title}</h3>
        {dropdownLabel && (
          <span className="ds-placeholder__dropdown" aria-disabled="true">
            {dropdownLabel}
          </span>
        )}
      </div>
      <div className="ds-placeholder__chart-area">
        <svg
          className="ds-placeholder__chart-silhouette"
          viewBox="0 0 200 80"
          aria-hidden="true"
        >
          <polyline
            points="0,60 40,45 80,55 120,30 160,40 200,20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.3"
          />
        </svg>
        <span className="ds-placeholder__coming-soon">Coming soon</span>
      </div>
    </>
  );
}

function CardsContent({ title }: { title: string }): ReactNode {
  return (
    <>
      <h3 className="ds-placeholder__title">{title}</h3>
      <div className="ds-placeholder__cards-row">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="ds-placeholder__card-silhouette" aria-hidden="true" />
        ))}
      </div>
      <span className="ds-placeholder__coming-soon">Coming soon</span>
    </>
  );
}

function ModesContent({ title }: { title: string }): ReactNode {
  const modes = ['Classic', 'Points', 'Practice'];
  return (
    <>
      <h3 className="ds-placeholder__title">{title}</h3>
      <div className="ds-placeholder__modes-row">
        {modes.map((m) => (
          <div key={m} className="ds-placeholder__mode-chip">
            <div className="ds-placeholder__mode-circle" aria-hidden="true" />
            <span className="ds-placeholder__mode-label">{m}</span>
          </div>
        ))}
      </div>
      <span className="ds-placeholder__coming-soon">Coming soon</span>
    </>
  );
}

function AchievementsContent({ title, linkLabel }: { title: string; linkLabel?: string }): ReactNode {
  const badges = ['First Win', 'Sharp Shooter', 'Safe Player'];
  return (
    <>
      <h3 className="ds-placeholder__title">{title}</h3>
      <div className="ds-placeholder__badges-row">
        {badges.map((b) => (
          <div key={b} className="ds-placeholder__badge-silhouette">
            <div className="ds-placeholder__badge-shield" aria-hidden="true" />
            <span className="ds-placeholder__badge-label">{b}</span>
          </div>
        ))}
      </div>
      <span className="ds-placeholder__coming-soon">Coming soon</span>
      <button type="button" className="ds-placeholder__link" disabled>
        {linkLabel ?? 'View All Achievements'}
      </button>
    </>
  );
}

export function DsPlaceholder({
  variant,
  title,
  dropdownLabel,
  linkLabel,
  className,
}: DsPlaceholderProps): ReactNode {
  const rootClass = ['ds-placeholder', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {variant === 'performance' && (
        <PerformanceContent title={title} dropdownLabel={dropdownLabel} />
      )}
      {variant === 'cards' && <CardsContent title={title} />}
      {variant === 'modes' && <ModesContent title={title} />}
      {variant === 'achievements' && (
        <AchievementsContent title={title} linkLabel={linkLabel} />
      )}
    </div>
  );
}
