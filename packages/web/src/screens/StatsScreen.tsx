import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import type { PlayerStatsView } from '../protocol';
import './StatsScreen.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' }
  | { status: 'ready'; stats: PlayerStatsView };

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatPct(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${Math.round(rate * 100)}%`;
}

function formatAvgFinish(avg: number): string {
  if (!Number.isFinite(avg) || avg === 0) return '—';
  return avg.toFixed(1);
}

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: boolean;
}

function StatCard({ label, value, accent }: StatCardProps): React.ReactNode {
  return (
    <motion.div
      layout
      className={`stats__card${accent ? ' stats__card--accent' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
    >
      <span className="stats__card-value">{value}</span>
      <span className="stats__card-label">{label}</span>
    </motion.div>
  );
}

export function StatsScreen(): React.ReactNode {
  const { requestMyStats, setScreen } = useGame();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void requestMyStats().then((ack) => {
      if (cancelled) return;
      if (ack.ok) {
        setState({ status: 'ready', stats: ack.stats });
      } else {
        setState({ status: 'error', error: ack.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [requestMyStats]);

  return (
    <div className="center-screen stats">
      <div className="stats__header">
        <button type="button" className="secondary" onClick={() => setScreen('main')}>
          ← Back
        </button>
        <h1 className="stats__title">Your Stats</h1>
        <span className="stats__header-spacer" aria-hidden="true" />
      </div>

      {state.status === 'loading' && (
        <div className="stats__center">
          <div className="spinner" />
          <p className="muted">Loading your stats…</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="card-surface stats__message">
          <p>
            {state.error === 'NOT_LOGGED_IN'
              ? 'Log in with Google to see your stats.'
              : 'Stats are currently unavailable. Please try again later.'}
          </p>
          <button type="button" className="secondary" onClick={() => setScreen('main')}>
            Back to lobby
          </button>
        </div>
      )}

      {state.status === 'ready' && state.stats.gamesPlayed === 0 && (
        <div className="card-surface stats__message">
          <p>No games played yet. Play a round and your stats will show up here!</p>
          <button type="button" className="secondary" onClick={() => setScreen('main')}>
            Back to lobby
          </button>
        </div>
      )}

      {state.status === 'ready' && state.stats.gamesPlayed > 0 && (
        <div className="stats__grid">
          <StatCard label="Games played" value={state.stats.gamesPlayed} />
          <StatCard label="Win rate" value={formatPct(state.stats.winRate)} accent />
          <StatCard label="Avg finish" value={formatAvgFinish(state.stats.avgFinish)} />
          <StatCard label="Wins" value={state.stats.gamesWon} />
          <StatCard label="Losses" value={state.stats.gamesLost} />
          <StatCard label="Abandoned" value={state.stats.gamesAbandoned} />
          <StatCard label="Total captures" value={state.stats.totalCaptures} />
          <StatCard label="Cuts given" value={state.stats.cutsGiven} />
          <StatCard label="Cuts received" value={state.stats.cutsReceived} />
          <StatCard label="Times safe" value={state.stats.timesSafe} />
          <StatCard label="Current streak" value={state.stats.currentWinStreak} accent />
          <StatCard label="Longest streak" value={state.stats.longestWinStreak} />
          <StatCard label="Total play time" value={formatDuration(state.stats.totalPlayTimeMs)} />
        </div>
      )}
    </div>
  );
}
