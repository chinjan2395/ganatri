import type { PlayerId } from '@ganatri/engine';
import './DesktopPlayerBar.css';

export interface DesktopPlayerBarEntry {
  playerId: PlayerId;
  displayName: string;
  avatarUrl?: string | null;
  isYou: boolean;
  isTurn: boolean;
  captureCount: number;
  disconnected: boolean;
}

interface DesktopPlayerBarProps {
  players: DesktopPlayerBarEntry[];
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function DesktopPlayerBar({ players }: DesktopPlayerBarProps): React.ReactNode {
  if (players.length === 0) return null;

  return (
    <div className="dplayer-bar" role="list" aria-label="Players at the table">
      {players.map((p) => {
        const classes = ['dplayer-card'];
        if (p.isYou) classes.push('dplayer-card--you');
        if (p.isTurn) classes.push('dplayer-card--turn');
        if (p.disconnected) classes.push('dplayer-card--offline');

        return (
          <div key={p.playerId} className={classes.join(' ')} role="listitem">
            <div className="dplayer-card__avatar">
              {p.avatarUrl
                ? <img src={p.avatarUrl} alt="" className="dplayer-card__img" referrerPolicy="no-referrer" />
                : <span className="dplayer-card__initials">{initials(p.displayName)}</span>}
            </div>
            <div className="dplayer-card__meta">
              <span className="dplayer-card__name">
                {p.displayName}
                {p.isYou && <span className="dplayer-card__you"> (You)</span>}
              </span>
              {p.disconnected && <span className="dplayer-card__offline-tag">offline</span>}
            </div>
            <span className="dplayer-card__score" title="Captured">
              <span aria-hidden>⬡</span> {p.captureCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
