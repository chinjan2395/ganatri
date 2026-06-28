import type { ReactNode } from 'react';
import { useState } from 'react';
import './HistoryRow.css';

export type DsHistoryOutcome = 'won' | 'lost' | 'abandoned' | 'neutral';

export interface DsHistoryRowPlayer {
  seatIndex: number;
  displayName: string;
  finalRank: number | null;
  captureCount: number;
  wasCut: boolean;
  matchScore: number;
  isYou: boolean;
}

export interface DsHistoryRowProps {
  outcome: DsHistoryOutcome;
  outcomeLabel: string;
  date: string;
  opponents: string[];
  playerCount: number;
  duration: string;
  matchScore: number;
  xpEarned: number;
  rankedRatingDelta: number;
  players: DsHistoryRowPlayer[];
  isWin: boolean;
}

function rankSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

const OUTCOME_BADGE_CLASS: Record<DsHistoryOutcome, string> = {
  won: 'ds-history-row__badge--won',
  lost: 'ds-history-row__badge--lost',
  abandoned: 'ds-history-row__badge--abandoned',
  neutral: 'ds-history-row__badge--neutral',
};

export function DsHistoryRow({
  outcome,
  outcomeLabel,
  date,
  opponents,
  playerCount,
  duration,
  matchScore,
  xpEarned,
  rankedRatingDelta,
  players,
  isWin,
}: DsHistoryRowProps): ReactNode {
  const [open, setOpen] = useState(false);

  const badgeClass = `ds-history-row__badge ${OUTCOME_BADGE_CLASS[outcome]}`;
  const rowClass = `ds-history-row${isWin ? ' ds-history-row--win' : ''}`;
  const ratingSign = rankedRatingDelta >= 0 ? '+' : '';

  const sortedPlayers = [...players].sort(
    (a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99),
  );

  return (
    <div className={rowClass}>
      <button
        type="button"
        className="ds-history-row__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={badgeClass}>{outcomeLabel}</span>
        <div className="ds-history-row__main">
          <span className="ds-history-row__date">{date}</span>
          <span className="ds-history-row__opponents">
            {opponents.length ? `vs ${opponents.join(', ')}` : 'Solo'}
          </span>
        </div>
        <div className="ds-history-row__meta">
          <span className="ds-history-row__meta-line">
            {playerCount}p · {duration}
          </span>
          <span className="ds-history-row__meta-line ds-history-row__meta-line--dim">
            Score {matchScore} · XP +{xpEarned} · Rating {ratingSign}{rankedRatingDelta}
          </span>
        </div>
        <span
          className={`ds-history-row__chevron${open ? ' ds-history-row__chevron--open' : ''}`}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
              fill="currentColor"
            />
          </svg>
        </span>
      </button>

      <div
        className="ds-history-row__scorecard"
        style={{
          maxHeight: open ? '600px' : '0',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.2s ease',
        }}
      >
        <div className="ds-history-row__scorecard-inner">
          <div className="ds-history-row__sc-head ds-history-row__sc-grid">
            <span>Player</span>
            <span>Seat</span>
            <span>Rank</span>
            <span>Captured</span>
            <span>Cut</span>
            <span>Score</span>
          </div>
          {sortedPlayers.map((p) => (
            <div
              key={p.seatIndex}
              className={`ds-history-row__sc-row ds-history-row__sc-grid${p.isYou ? ' ds-history-row__sc-row--you' : ''}`}
            >
              <span className="ds-history-row__sc-name">
                {p.displayName}
                {p.isYou && <span className="ds-history-row__sc-youtag">you</span>}
              </span>
              <span>{p.seatIndex + 1}</span>
              <span>{p.finalRank != null ? rankSuffix(p.finalRank) : '—'}</span>
              <span>{p.captureCount}</span>
              <span>{p.wasCut ? 'Yes' : '—'}</span>
              <span>{p.matchScore}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
