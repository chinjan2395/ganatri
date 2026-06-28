import type { ReactNode } from 'react';
import { DsAvatar } from '../Avatar';
import './RankRow.css';

export interface DsRankRowProps {
  rank: number;
  displayName: string;
  avatarUrl?: string | null;
  isMe?: boolean;
  compact?: boolean;
  gamesWon: number;
  gamesPlayed: number;
  winRate: string;
}

function MedalIcon({ rank }: { rank: number }): ReactNode {
  if (rank === 1) {
    return (
      <svg className="ds-rank-row__medal ds-rank-row__medal--gold" viewBox="0 0 24 24" aria-label="Gold medal">
        <circle cx="12" cy="14" r="8" fill="currentColor" opacity="0.2" />
        <circle cx="12" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 3l3-3 3 3-1.5 4h-3z" fill="currentColor" />
        <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="bold" fill="currentColor">1</text>
      </svg>
    );
  }
  if (rank === 2) {
    return (
      <svg className="ds-rank-row__medal ds-rank-row__medal--silver" viewBox="0 0 24 24" aria-label="Silver medal">
        <circle cx="12" cy="14" r="8" fill="currentColor" opacity="0.2" />
        <circle cx="12" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 3l3-3 3 3-1.5 4h-3z" fill="currentColor" />
        <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="bold" fill="currentColor">2</text>
      </svg>
    );
  }
  return (
    <svg className="ds-rank-row__medal ds-rank-row__medal--bronze" viewBox="0 0 24 24" aria-label="Bronze medal">
      <circle cx="12" cy="14" r="8" fill="currentColor" opacity="0.2" />
      <circle cx="12" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 3l3-3 3 3-1.5 4h-3z" fill="currentColor" />
      <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="bold" fill="currentColor">3</text>
    </svg>
  );
}

export function DsRankRow({
  rank,
  displayName,
  avatarUrl,
  isMe = false,
  compact = false,
  gamesWon,
  gamesPlayed,
  winRate,
}: DsRankRowProps): ReactNode {
  const classes = [
    'ds-rank-row',
    isMe ? 'ds-rank-row--me' : '',
    compact ? 'ds-rank-row--compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const name = isMe ? `${displayName} (You)` : displayName;

  return (
    <div className={classes}>
      <span className="ds-rank-row__rank">
        {rank <= 3 ? (
          <MedalIcon rank={rank} />
        ) : (
          <span className="ds-rank-row__rank-num">{rank}</span>
        )}
      </span>
      <DsAvatar src={avatarUrl} displayName={displayName} size={32} />
      <span className="ds-rank-row__name">{name}</span>
      <span className="ds-rank-row__stat ds-rank-row__stat--wins">{gamesWon}</span>
      <span className="ds-rank-row__stat">{gamesPlayed}</span>
      <span className="ds-rank-row__stat ds-rank-row__stat--rate">{winRate}</span>
    </div>
  );
}
