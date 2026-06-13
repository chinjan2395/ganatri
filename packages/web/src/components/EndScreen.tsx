import { motion } from 'framer-motion';
import type { PlayerId } from '@ganatri/engine';
import logo from '../assets/ganatri-logo.png';
import './EndScreen.css';

export interface EndScreenProps {
  rankings: readonly PlayerId[] | null;
  you: PlayerId;
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

function shortId(id: PlayerId): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

export function EndScreen({ rankings, you, isHost, onPlayAgain, onLeave }: EndScreenProps): React.ReactNode {
  const order = rankings ?? [];
  const loserIndex = order.length > 0 ? order.length - 1 : -1;
  const winner = order[0];

  return (
    <div className="end">
      <img src={logo} alt="Ganatri" className="end__logo" />
      <h1 className="neon-title end__title">GAME OVER</h1>

      {winner && (
        <motion.div
          className="end__spotlight"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        >
          <div className="end__trophy">🏆</div>
          <div className="end__winner-name">
            {shortId(winner)}
            {winner === you && <span className="end__you"> (you)</span>}
          </div>
          <div className="end__winner-label">Winner</div>
        </motion.div>
      )}

      {order.length === 0 ? (
        <p className="muted">No loser — everyone finished safely.</p>
      ) : (
        <ol className="end__rankings">
          {order.map((pid, i) => {
            const isLoser = i === loserIndex && order.length > 1;
            return (
              <motion.li
                key={pid}
                className={isLoser ? 'end__row end__row--loser' : 'end__row'}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i }}
              >
                <span className="end__place">{i === 0 ? '🏆' : `#${i + 1}`}</span>
                <span className="end__player">
                  {shortId(pid)}
                  {pid === you && <span className="end__you"> (you)</span>}
                </span>
                <span className="end__label">{i === 0 ? 'winner' : isLoser ? 'loser' : 'safe'}</span>
              </motion.li>
            );
          })}
        </ol>
      )}
      <div className="row">
        {isHost && <button onClick={onPlayAgain}>Play again</button>}
        <button className="secondary" onClick={onLeave}>
          Back to lobby
        </button>
      </div>
      {!isHost && <p className="muted">Waiting for the host to start a new game…</p>}
    </div>
  );
}
