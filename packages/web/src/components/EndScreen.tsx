import type { PlayerId } from '@ganatri/engine';
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

  return (
    <div className="end">
      <h1>Game Over</h1>
      {order.length === 0 ? (
        <p className="muted">No loser — everyone finished safely.</p>
      ) : (
        <ol className="end__rankings">
          {order.map((pid, i) => {
            const isLoser = i === loserIndex && order.length > 1;
            return (
              <li key={pid} className={isLoser ? 'end__row end__row--loser' : 'end__row'}>
                <span className="end__place">{i === 0 ? '🏆' : `#${i + 1}`}</span>
                <span className="end__player">
                  {shortId(pid)}
                  {pid === you && <span className="end__you"> (you)</span>}
                </span>
                <span className="end__label">{i === 0 ? 'winner' : isLoser ? 'loser' : 'safe'}</span>
              </li>
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
