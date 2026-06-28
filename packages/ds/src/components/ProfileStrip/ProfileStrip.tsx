import type { ReactNode } from 'react';
import { DsAvatar } from '../Avatar';
import './ProfileStrip.css';

export interface DsProfileStripProps {
  displayName: string;
  avatarUrl?: string | null;
  playerId?: string | null;
  className?: string;
}

export function DsProfileStrip({
  displayName,
  avatarUrl,
  playerId,
  className,
}: DsProfileStripProps): ReactNode {
  const rootClass = `ds-profile-strip${className ? ` ${className}` : ''}`;

  return (
    <div className={rootClass}>
      <DsAvatar src={avatarUrl} displayName={displayName} size={52} />

      <div className="ds-profile-strip__info">
        <span className="ds-profile-strip__name">{displayName}</span>
        {playerId != null && (
          <span className="ds-profile-strip__id">Player ID: {playerId}</span>
        )}
      </div>
    </div>
  );
}
