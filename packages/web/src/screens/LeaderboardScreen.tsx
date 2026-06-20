import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import type { LeaderboardEntryView } from '../protocol';
import './LeaderboardScreen.css';

type TimeWindow = 'week' | 'month' | undefined;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: 'UNAVAILABLE' }
  | { status: 'ready'; entries: LeaderboardEntryView[]; myEntry?: LeaderboardEntryView };

function formatPct(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${Math.round(rate * 100)}%`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function rankLabel(rank: number): string {
  const medal = MEDALS[rank - 1];
  if (medal) return medal;
  return `#${rank}`;
}

interface RowProps {
  entry: LeaderboardEntryView;
  isMe: boolean;
}

function LeaderboardRow({ entry, isMe }: RowProps): React.ReactNode {
  return (
    <motion.div
      layout
      className={`lb__row${isMe ? ' lb__row--me' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
    >
      <span className={`lb__rank${entry.rank <= 3 ? ' lb__rank--medal' : ''}`}>
        {rankLabel(entry.rank)}
      </span>
      {entry.avatarUrl ? (
        <img className="lb__avatar" src={entry.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="lb__avatar lb__avatar--placeholder" aria-hidden="true">
          {(entry.displayName || '?').charAt(0).toUpperCase()}
        </span>
      )}
      <span className="lb__name">{entry.displayName}</span>
      <span className="lb__stat lb__stat--wins">{entry.gamesWon}</span>
      <span className="lb__stat">{entry.gamesPlayed}</span>
      <span className="lb__stat lb__stat--rate">{formatPct(entry.winRate)}</span>
    </motion.div>
  );
}

const TAB_LABELS: { value: TimeWindow; label: string }[] = [
  { value: undefined, label: 'All Time' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

function emptyMessage(timeWindow: TimeWindow): string {
  if (timeWindow === 'week') return 'No games completed this week yet.';
  if (timeWindow === 'month') return 'No games completed this month yet.';
  return 'No ranked players yet — finish a game to get on the board!';
}

export function LeaderboardScreen(): React.ReactNode {
  const { requestLeaderboard, setScreen, session } = useGame();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(undefined);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    let cancelled = false;
    void requestLeaderboard(timeWindow).then((ack) => {
      if (cancelled) return;
      if (ack.ok) {
        setState({ status: 'ready', entries: ack.entries, myEntry: ack.myEntry });
      } else {
        setState({ status: 'error', error: ack.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [requestLeaderboard, timeWindow]);

  const myId = session?.playerId ?? null;

  return (
    <div className="center-screen lb">
      <div className="lb__header">
        <button type="button" className="secondary" onClick={() => setScreen('main')}>
          Back
        </button>
        <h1 className="lb__title">Leaderboard</h1>
        <span className="lb__header-spacer" aria-hidden="true" />
      </div>

      <div className="lb__tabs" role="tablist">
        {TAB_LABELS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={timeWindow === value}
            className={`lb__tab${timeWindow === value ? ' lb__tab--active' : ''}`}
            onClick={() => setTimeWindow(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {state.status === 'loading' && (
        <div className="lb__center">
          <div className="spinner" />
          <p className="muted">Loading leaderboard...</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="card-surface lb__message">
          <p>Leaderboard is currently unavailable. Please try again later.</p>
          <button type="button" className="secondary" onClick={() => setScreen('main')}>
            Back to lobby
          </button>
        </div>
      )}

      {state.status === 'ready' && state.entries.length === 0 && (
        <div className="card-surface lb__message">
          <p>{emptyMessage(timeWindow)}</p>
          <button type="button" className="secondary" onClick={() => setScreen('main')}>
            Back to lobby
          </button>
        </div>
      )}

      {state.status === 'ready' && state.entries.length > 0 && (
        <>
          <div className="lb__table">
            <div className="lb__row lb__row--head" aria-hidden="true">
              <span className="lb__rank">#</span>
              <span className="lb__avatar-head" />
              <span className="lb__name">Player</span>
              <span className="lb__stat lb__stat--wins">Won</span>
              <span className="lb__stat">Played</span>
              <span className="lb__stat lb__stat--rate">Win %</span>
            </div>
            {state.entries.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} isMe={entry.userId === myId} />
            ))}
          </div>
          {state.myEntry && (
            <div className="lb__my-rank">
              <p className="lb__my-rank-label">Your ranking</p>
              <LeaderboardRow entry={state.myEntry} isMe={true} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
