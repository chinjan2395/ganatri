import type { ReactNode } from 'react';
import { DsCard } from '../Card';
import './ScoreCard.css';

export interface ScoreCardEntry {
  id: string;
  name: string;
  isYou: boolean;
  /** Capture count (Part 1) or safe rank (Part 2) — caller decides. */
  score: number;
  isLeader?: boolean;
  isTurn?: boolean;
}

export interface ScoreCardProps {
  /** Rendered in the order given — caller is responsible for sort order. */
  entries: ScoreCardEntry[];
  title?: string;
  className?: string;
}

export function ScoreCard({ entries, title = 'SCORES', className }: ScoreCardProps): ReactNode {
  return (
    <DsCard className={['ds-score-card', className].filter(Boolean).join(' ')} title={title}>
      <div className="ds-score-card__rows">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className={`ds-score-card__row${entry.isLeader ? ' ds-score-card__row--leader' : ''}`}
          >
            <span className="ds-score-card__rank">{i + 1}</span>
            <span className={`ds-score-card__name${entry.isYou ? ' ds-score-card__name--you' : ''}`}>
              {entry.name}
            </span>
            {entry.isTurn && <span className="ds-score-card__turn-dot" aria-label="Current turn" />}
            <span className="ds-score-card__value">{entry.score}</span>
          </div>
        ))}
      </div>
    </DsCard>
  );
}
