import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import type { GameHistoryEntry } from '../protocol';
import './HistoryScreen.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' }
  | { status: 'ready'; games: GameHistoryEntry[] };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

function rankSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

interface Outcome {
  label: string;
  className: string;
}

function outcomeFor(entry: GameHistoryEntry): Outcome {
  if (entry.isAbandoned) return { label: 'Abandoned', className: 'history__outcome--abandoned' };
  const { finalRank, result } = entry.you;
  if (finalRank === 1) return { label: 'WON 🥇', className: 'history__outcome--won' };
  if (finalRank != null) {
    return { label: `LOST ${rankSuffix(finalRank)}`, className: 'history__outcome--lost' };
  }
  return {
    label: result ?? 'Finished',
    className: 'history__outcome--neutral',
  };
}

function HistoryRow({ entry }: { entry: GameHistoryEntry }): React.ReactNode {
  const [open, setOpen] = useState(false);
  const outcome = outcomeFor(entry);
  const opponents = entry.players
    .filter((p) => p.seatIndex !== entry.you.seatIndex)
    .map((p) => p.displayNameSnapshot);

  return (
    <motion.div
      layout
      className="history__row"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
    >
      <button
        type="button"
        className="history__row-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="history__row-main">
          <span className="history__date">{formatDate(entry.startedAt)}</span>
          <span className="history__opponents">
            {opponents.length ? `vs ${opponents.join(', ')}` : 'Solo'}
          </span>
        </div>
        <div className="history__row-meta">
          <span className={`history__outcome ${outcome.className}`}>{outcome.label}</span>
          <span className="history__meta-line muted">
            {entry.playerCount}p · {formatDuration(entry.durationMs)} · {entry.you.captureCount} captured
          </span>
        </div>
        <span className={`history__chevron${open ? ' history__chevron--open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="history__scorecard"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="history__scorecard-inner">
              <div className="history__sc-head history__sc-grid">
                <span>Player</span>
                <span>Seat</span>
                <span>Rank</span>
                <span>Captured</span>
                <span>Cut</span>
              </div>
              {[...entry.players]
                .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99))
                .map((p) => {
                  const isYou = p.seatIndex === entry.you.seatIndex;
                  return (
                    <div
                      key={p.seatIndex}
                      className={`history__sc-row history__sc-grid${isYou ? ' history__sc-row--you' : ''}`}
                    >
                      <span className="history__sc-name">
                        {p.displayNameSnapshot}
                        {isYou && <span className="history__sc-youtag">you</span>}
                      </span>
                      <span>{p.seatIndex + 1}</span>
                      <span>{p.finalRank != null ? rankSuffix(p.finalRank) : '—'}</span>
                      <span>{p.captureCount}</span>
                      <span>{p.wasCut ? '✂️' : '—'}</span>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function HistoryScreen(): React.ReactNode {
  const { requestHistory, setScreen } = useGame();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void requestHistory().then((ack) => {
      if (cancelled) return;
      if (ack.ok) {
        setState({ status: 'ready', games: ack.games });
      } else {
        setState({ status: 'error', error: ack.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [requestHistory]);

  return (
    <div className="center-screen history">
      <div className="history__header">
        <button type="button" className="secondary" onClick={() => setScreen('main')}>
          ← Back
        </button>
        <h1 className="history__title">Game History</h1>
        <span className="history__header-spacer" aria-hidden="true" />
      </div>

      {state.status === 'loading' && (
        <div className="history__center">
          <div className="spinner" />
          <p className="muted">Loading your games…</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="card-surface history__message">
          <p>
            {state.error === 'NOT_LOGGED_IN'
              ? 'Log in with Google to see your game history.'
              : 'Game history is currently unavailable. Please try again later.'}
          </p>
          <button type="button" className="secondary" onClick={() => setScreen('main')}>
            Back to lobby
          </button>
        </div>
      )}

      {state.status === 'ready' && state.games.length === 0 && (
        <div className="card-surface history__message">
          <p>No games yet. Play a round and it’ll show up here!</p>
          <button type="button" className="secondary" onClick={() => setScreen('main')}>
            Back to lobby
          </button>
        </div>
      )}

      {state.status === 'ready' && state.games.length > 0 && (
        <div className="history__list">
          {state.games.map((g) => (
            <HistoryRow key={g.id} entry={g} />
          ))}
        </div>
      )}
    </div>
  );
}
