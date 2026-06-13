import type { PlayerId } from '@ganatri/engine';
import './OpponentSeat.css';

export interface OpponentSeatProps {
  playerId: PlayerId;
  isYou: boolean;
  handCount: number;
  captureCount?: number; // Part 1
  isTurn: boolean;
  isSafe: boolean;
  safeRank?: number; // 1-based position in safeOrder
  disconnected: boolean;
}

function shortId(id: PlayerId): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

export function OpponentSeat(props: OpponentSeatProps): React.ReactNode {
  const { playerId, isYou, handCount, captureCount, isTurn, isSafe, safeRank, disconnected } = props;
  const classes = ['seat'];
  if (isTurn) classes.push('seat--turn');
  if (isSafe) classes.push('seat--safe');
  if (disconnected) classes.push('seat--disconnected');

  return (
    <div className={classes.join(' ')}>
      <div className="seat__avatar">
        <span>{shortId(playerId).slice(0, 2).toUpperCase()}</span>
        {disconnected && <div className="seat__overlay">offline</div>}
      </div>
      <div className="seat__name">
        {shortId(playerId)}
        {isYou && <span className="seat__you"> (you)</span>}
      </div>
      <div className="seat__stats">
        <span title="cards in hand">🂠 {handCount}</span>
        {captureCount !== undefined && <span title="captured cards">⊞ {captureCount}</span>}
      </div>
      {isSafe && <div className="seat__badge">safe{safeRank ? ` #${safeRank}` : ''}</div>}
    </div>
  );
}
