import type { PlayerId } from '@ganatri/engine';
import './OpponentSeat.css';

export interface OpponentSeatProps {
  playerId: PlayerId;
  /** Human-readable display name; falls back to shortened playerId. */
  displayName?: string;
  isYou: boolean;
  handCount: number;
  captureCount?: number; // Part 1
  isTurn: boolean;
  isSafe: boolean;
  safeRank?: number; // 1-based position in safeOrder
  disconnected: boolean;
  /** Condensed style for the top-row opponent seats. */
  compact?: boolean;
}

function shortId(id: PlayerId): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

/** Stable per-player hue so each avatar gets its own colour. */
function hueFor(id: PlayerId): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export function OpponentSeat(props: OpponentSeatProps): React.ReactNode {
  const { playerId, displayName, isYou, handCount, captureCount, isTurn, isSafe, safeRank, disconnected, compact } =
    props;
  const classes = ['seat'];
  if (isYou) classes.push('seat--you');
  if (isTurn) classes.push('seat--turn');
  if (isSafe) classes.push('seat--safe');
  if (disconnected) classes.push('seat--disconnected');
  if (compact) classes.push('seat--compact');

  const label = displayName || shortId(playerId);
  const showCaptures = captureCount !== undefined && captureCount > 0;
  const avatarStyle = { '--seat-hue': hueFor(playerId) } as React.CSSProperties;

  return (
    <div className={classes.join(' ')}>
      <span className="seat__name" title={label}>
        {label}
      </span>

      <div className={`seat__turn-crown${isTurn ? '' : ' seat__turn-crown--placeholder'}`} aria-hidden={!isTurn}>
        {isTurn && (
          <span className="seat__turn-crown-icon">{isYou ? '♛' : '▼'}</span>
        )}
      </div>

      <div className="seat__avatar" style={avatarStyle}>
        <span className="seat__initials">{label.slice(0, 2).toUpperCase()}</span>
        {disconnected && <div className="seat__overlay" />}
      </div>

      <div className="seat__stats">
        {disconnected ? (
          <span className="seat__stat-badge seat__stat-badge--offline">offline</span>
        ) : (
          <>
            <span className="seat__stat" title="Cards in hand">
              <span className="seat__stat-icon" aria-hidden>
                🃏
              </span>
              <span className="seat__stat-val">{handCount}</span>
            </span>
            {showCaptures && (
              <span className="seat__stat seat__stat--capture" title="Captured cards">
                <span className="seat__stat-icon" aria-hidden>
                  ⬡
                </span>
                <span className="seat__stat-val">{captureCount}</span>
              </span>
            )}
            {isSafe && (
              <span className="seat__stat seat__stat--safe" title="Safe player">
                <span className="seat__stat-icon" aria-hidden>
                  ✓
                </span>
                <span className="seat__stat-val">{safeRank ?? '—'}</span>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
