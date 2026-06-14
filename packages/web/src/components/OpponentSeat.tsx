import { AnimatePresence, motion } from 'framer-motion';
import type { PlayerId } from '@ganatri/engine';
import { Chip } from './Chip';
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
  /** Compact rim placement around the oval. */
  compact?: boolean;
}

function shortId(id: PlayerId): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

export function OpponentSeat(props: OpponentSeatProps): React.ReactNode {
  const { playerId, displayName, isYou, handCount, captureCount, isTurn, isSafe, safeRank, disconnected, compact } =
    props;
  const classes = ['seat'];
  if (isTurn) classes.push('seat--turn');
  if (isSafe) classes.push('seat--safe');
  if (disconnected) classes.push('seat--disconnected');
  if (compact) classes.push('seat--compact');

  const label = displayName || shortId(playerId);

  return (
    <div className={classes.join(' ')}>
      <div className="seat__avatar">
        <span>{label.slice(0, 2).toUpperCase()}</span>
        {disconnected && <div className="seat__overlay">offline</div>}
      </div>
      <div className="seat__name">
        {label}
        {isYou && <span className="seat__you"> (you)</span>}
      </div>
      <div className="seat__stats">
        <Chip count={handCount} denomination="blue" small label="cards in hand" />
        {captureCount !== undefined && (
          <Chip
            count={captureCount}
            denomination="red"
            small
            label="captured cards"
            popKey={captureCount}
          />
        )}
      </div>
      <AnimatePresence>
        {isSafe && (
          <motion.div
            className="seat__badge"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 480, damping: 20 }}
          >
            safe{safeRank ? ` #${safeRank}` : ''}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
