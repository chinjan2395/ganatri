import type { ReactNode } from 'react';
import { DsAvatar } from '../Avatar';
import { DsIcon } from '../Icon';
import './ProfileCard.css';

export interface DsProfileStat {
  label: string;
  value: string;
}

export interface DsProfileCardProps {
  displayName: string;
  avatarUrl?: string | null;
  playerId?: string | null;
  /** Show the floating crown decoration at top-center. Default false. */
  showCrown?: boolean;
  /** Up to 4 stat pairs (label + value). Rendered as a 2-column grid. */
  stats?: DsProfileStat[];
  className?: string;
}

export function DsProfileCard({
  displayName,
  avatarUrl,
  playerId,
  showCrown = false,
  stats,
  className,
}: DsProfileCardProps): ReactNode {
  const rootClass = `ds-profile-card${className ? ` ${className}` : ''}`;

  return (
    <div className={rootClass}>
      {showCrown && (
        <div className="ds-profile-card__crown" aria-hidden="true">
          <DsIcon name="crown" size={28} />
        </div>
      )}

      <div className="ds-profile-card__avatar-wrap">
        <DsAvatar src={avatarUrl} displayName={displayName} size={72} />
      </div>

      <h2 className="ds-profile-card__name">{displayName}</h2>

      {playerId != null && (
        <p className="ds-profile-card__id">Player ID: {playerId}</p>
      )}

      {stats && stats.length > 0 && (
        <div className="ds-profile-card__stats">
          {stats.slice(0, 4).map((stat) => (
            <div key={stat.label} className="ds-profile-card__stat">
              <span className="ds-profile-card__stat-label">{stat.label}</span>
              <span className="ds-profile-card__stat-value">{stat.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
