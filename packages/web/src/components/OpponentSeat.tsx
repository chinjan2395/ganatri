import { AnimatePresence, motion } from 'framer-motion';
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

  // Status below the avatar — priority: offline > turn > safe > waiting
  let status: { text: string; tone: string } | null = null;
  if (disconnected) status = { text: 'offline', tone: 'offline' };
  else if (isTurn) status = { text: isYou ? 'your turn' : 'next', tone: 'turn' };
  else if (isSafe) status = { text: `safe${safeRank ? ` #${safeRank}` : ''}`, tone: 'safe' };
  else status = { text: 'waiting', tone: 'waiting' };

  const avatarStyle = { '--seat-hue': hueFor(playerId) } as React.CSSProperties;

  return (
    <div className={classes.join(' ')}>
      {/* YOU badge — shown only for the local player */}
      {isYou && <div className="seat__you-tag">YOU</div>}

      {/* Name + hand count stacked */}
      <div className="seat__info">
        <span className="seat__name">{label}</span>
        <span className="seat__count-row">
          <span className="seat__count-icon">🃏</span>
          <span className="seat__count-num">{handCount}</span>
        </span>
      </div>

      {/* Circular avatar */}
      <div className="seat__avatar" style={avatarStyle}>
        <span className="seat__initials">{label.slice(0, 2).toUpperCase()}</span>

        {captureCount !== undefined && captureCount > 0 && (
          <span className="seat__cap" title="captured cards">
            {captureCount}
          </span>
        )}

        {disconnected && <div className="seat__overlay" />}
      </div>

      {/* Status badge */}
      <div className="seat__status">
        <AnimatePresence mode="wait">
          {status && (
            <motion.span
              key={status.tone}
              className={`seat__status-badge seat__status-badge--${status.tone}`}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 3 }}
              transition={{ duration: 0.15 }}
            >
              {status.text}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
