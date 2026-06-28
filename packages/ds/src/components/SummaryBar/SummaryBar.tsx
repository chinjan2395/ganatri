import type { ReactNode } from 'react';
import './SummaryBar.css';

export interface DsSummaryBarProps {
  total: number;
  wins: number;
  winRate: string;
}

export function DsSummaryBar({ total, wins, winRate }: DsSummaryBarProps): ReactNode {
  return (
    <div className="ds-summary-bar">
      <div className="ds-summary-bar__item">
        <span className="ds-summary-bar__value">{total}</span>
        <span className="ds-summary-bar__label">Games</span>
      </div>
      <div className="ds-summary-bar__divider" aria-hidden="true" />
      <div className="ds-summary-bar__item">
        <span className="ds-summary-bar__value ds-summary-bar__value--accent">{wins}</span>
        <span className="ds-summary-bar__label">Wins</span>
      </div>
      <div className="ds-summary-bar__divider" aria-hidden="true" />
      <div className="ds-summary-bar__item">
        <span className="ds-summary-bar__value">{winRate}</span>
        <span className="ds-summary-bar__label">Win Rate</span>
      </div>
    </div>
  );
}
