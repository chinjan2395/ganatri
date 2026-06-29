import type { PlayerId } from '@ganatri/engine';
import { DsAvatar, DsButton, DsIcon, DsListRow } from '@ganatri/ds';
import type { AccountInfo } from '../state/GameProvider';
import type { MatchScoringView, PlayerProgressionView } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import './EndScreen.css';

export interface EndScreenProps {
  rankings: readonly PlayerId[] | null;
  you: PlayerId;
  isHost: boolean;
  playerNames: Readonly<Record<string, string>>;
  account?: AccountInfo | null;
  scoring?: MatchScoringView[];
  progression?: PlayerProgressionView | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}

function shortId(id: PlayerId): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

export function EndScreen({ rankings, you, isHost, playerNames, account, scoring = [], progression, onPlayAgain, onLeave }: EndScreenProps): React.ReactNode {
  const order = rankings ?? [];
  const loserIndex = order.length > 0 ? order.length - 1 : -1;
  const winner = order[0];
  const myScoring = scoring.find((entry) => entry.playerId === you);

  const nameFor = (pid: PlayerId): string => {
    if (pid === you && account?.loggedIn && account.displayName) {
      return account.displayName;
    }
    return playerNames[pid] || shortId(pid);
  };

  return (
    <div className="end">
      <img src={logo} alt="Ganatri" className="end__logo" />
      <h1 className="neon-title end__title">GAME OVER</h1>

      {winner && (
        <div className="end__spotlight">
          <DsIcon name="trophy" size={48} className="end__trophy-icon" aria-hidden />
          <DsAvatar displayName={nameFor(winner)} size={56} className="end__winner-avatar" />
          <div className="end__winner-name">
            {nameFor(winner)}
            {winner === you && <span className="end__you"> (you)</span>}
          </div>
          <div className="end__winner-label">Winner</div>
        </div>
      )}

      {myScoring && (
        <div className="end__summary">
          <p className="muted">
            Score {myScoring.matchScore} · XP +{myScoring.xpEarned} · Rating {myScoring.rankedRatingDelta >= 0 ? '+' : ''}{myScoring.rankedRatingDelta}
          </p>
          {progression && account?.loggedIn && (
            <p className="muted">
              Level {progression.level} · Rating {progression.rankedRating} · XP {progression.totalXp}
            </p>
          )}
          {!account?.loggedIn && (
            <p className="muted">Create an account to keep XP and rating.</p>
          )}
        </div>
      )}

      {order.length === 0 ? (
        <p className="muted">No loser — everyone finished safely.</p>
      ) : (
        <ol className="end__rankings">
          {order.map((pid, i) => {
            const isLoser = i === loserIndex && order.length > 1;
            const label = i === 0 ? 'Winner' : isLoser ? 'Loser' : 'Safe';
            const trailing = (
              <span className={isLoser ? 'end__place end__place--loser' : 'end__place'}>
                {i === 0 ? (
                  <DsIcon name="trophy" size={20} aria-hidden />
                ) : (
                  `#${i + 1}`
                )}
              </span>
            );
            return (
              <li
                key={pid}
                className={isLoser ? 'end__row end__row--loser' : 'end__row'}
                style={{ animationDelay: `${0.08 * i}s` }}
              >
                <DsListRow
                  title={nameFor(pid) + (pid === you ? ' (you)' : '')}
                  subtitle={label}
                  trailing={trailing}
                />
              </li>
            );
          })}
        </ol>
      )}

      <div className="end__actions">
        {isHost && (
          <DsButton tone="primary" onClick={onPlayAgain}>
            Play again
          </DsButton>
        )}
        <DsButton tone="secondary" onClick={onLeave}>
          Back to lobby
        </DsButton>
      </div>

      {!isHost && <p className="muted">Waiting for the host to start a new game…</p>}
    </div>
  );
}
