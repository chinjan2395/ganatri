import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { GameHistoryEntry } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import './HistoryScreen.css';

type NavScreen = 'main' | 'history' | 'stats' | 'leaderboard';
type BottomNavTab = 'home' | 'history' | 'stats' | 'leaderboard' | 'profile';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' }
  | { status: 'ready'; games: GameHistoryEntry[] };

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

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
  if (entry.isAbandoned) return { label: 'Abandoned', className: 'hist__outcome--abandoned' };
  const { finalRank, result } = entry.you;
  if (finalRank === 1) return { label: 'Won', className: 'hist__outcome--won' };
  if (finalRank != null) {
    return { label: rankSuffix(finalRank), className: 'hist__outcome--lost' };
  }
  return {
    label: result ?? 'Finished',
    className: 'hist__outcome--neutral',
  };
}

function TitleFlourish(): React.ReactNode {
  return (
    <svg className="hist__flourish" viewBox="0 0 48 12" aria-hidden="true">
      <path d="M0 6c8-6 16-6 24 0M24 6c8 6 16 6 24 0" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="24" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

function CrownIcon(): React.ReactNode {
  return (
    <svg className="hist__crown" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 18h18v2H3v-2zm2.5-9L7 12l5-7 5 7 1.5-3L21 14H3l2.5-5z" fill="currentColor" />
    </svg>
  );
}

function computeSummary(games: GameHistoryEntry[]): { total: number; wins: number; winRate: string } {
  const total = games.length;
  const wins = games.filter((g) => !g.isAbandoned && g.you.finalRank === 1).length;
  const winRate = total > 0 ? `${Math.round((wins / total) * 100)}%` : '0%';
  return { total, wins, winRate };
}

interface HistoryHeaderProps {
  account: ReturnType<typeof useGame>['account'];
  isDesktop: boolean;
  onNavigate: (screen: NavScreen) => void;
  onProfile: () => void;
}

function HistoryHeader({ account, isDesktop, onNavigate, onProfile }: HistoryHeaderProps): React.ReactNode {
  const displayName = account?.displayName ?? (account?.loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  const topNav: { id: NavScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'main', label: 'Home', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" /></svg> },
    { id: 'history', label: 'History', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" /></svg> },
    { id: 'stats', label: 'Stats', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" fill="currentColor" /></svg> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" /></svg> },
  ];

  if (!isDesktop) {
    return (
      <header className="hist__header hist__header--mobile">
        <button type="button" className="hist__back-btn" onClick={() => onNavigate('main')} aria-label="Back to home">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
          </svg>
        </button>
        <div className="hist__mobile-title-wrap">
          <TitleFlourish />
          <h1 className="hist__mobile-title">GAME HISTORY</h1>
          <TitleFlourish />
        </div>
        <button type="button" className="hist__profile-icon-btn" onClick={onProfile} aria-label="Profile">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
          </svg>
        </button>
      </header>
    );
  }

  return (
    <header className="hist__header">
      <div className="hist__header-left">
        <img src={logo} alt="Ganatri" className="hist__header-logo-sm" />
      </div>
      <nav className="hist__top-nav" aria-label="Main navigation">
        {topNav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`hist__top-nav-btn${item.id === 'history' ? ' hist__top-nav-btn--active' : ''}`}
            onClick={() => (item.id === 'history' ? undefined : onNavigate(item.id))}
            aria-current={item.id === 'history' ? 'page' : undefined}
            disabled={item.id === 'history'}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" className="hist__top-nav-btn" onClick={onProfile}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
          </svg>
          <span>Profile</span>
        </button>
      </nav>
      <div className="hist__header-right">
        <button type="button" className="hist__header-avatar-btn" onClick={onProfile} aria-label={`Profile: ${displayName}`}>
          {avatarUrl ? (
            <img className="hist__header-avatar-img" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="hist__header-avatar-initials" aria-hidden="true">{initial}</span>
          )}
        </button>
      </div>
    </header>
  );
}

interface ProfileSidebarProps {
  account: ReturnType<typeof useGame>['account'];
  playerId: string | null;
  loggedIn: boolean;
  onNavigate: (screen: 'stats' | 'leaderboard') => void;
}

function HistoryProfileSidebar({ account, playerId, loggedIn, onNavigate }: ProfileSidebarProps): React.ReactNode {
  const displayName = account?.displayName ?? (loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="hist__sidebar">
      <div className="hist__profile-card">
        <div className="hist__profile-crown" aria-hidden="true"><CrownIcon /></div>
        <div className="hist__profile-avatar-wrap">
          {avatarUrl ? (
            <img className="hist__profile-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="hist__profile-avatar hist__profile-avatar--placeholder" aria-hidden="true">{initial}</span>
          )}
        </div>
        <h2 className="hist__profile-name">{displayName}</h2>
        {playerId && <p className="hist__profile-id">Player ID: {truncateId(playerId)}</p>}
      </div>
      <nav className="hist__sidebar-nav" aria-label="Account navigation">
        <button type="button" className="hist__sidebar-nav-btn hist__sidebar-nav-btn--active" disabled>Game History</button>
        <button type="button" className="hist__sidebar-nav-btn" onClick={() => onNavigate('stats')}>Stats</button>
        <button type="button" className="hist__sidebar-nav-btn" onClick={() => onNavigate('leaderboard')}>Leaderboard</button>
      </nav>
    </aside>
  );
}

function MobileProfileStrip({
  account, playerId, loggedIn,
}: { account: ReturnType<typeof useGame>['account']; playerId: string | null; loggedIn: boolean }): React.ReactNode {
  const displayName = account?.displayName ?? (loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="hist__mobile-profile">
      <div className="hist__mobile-profile-avatar-wrap">
        {avatarUrl ? (
          <img className="hist__mobile-profile-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="hist__mobile-profile-avatar hist__mobile-profile-avatar--placeholder" aria-hidden="true">{initial}</span>
        )}
      </div>
      <div className="hist__mobile-profile-info">
        <span className="hist__mobile-profile-name">{displayName}</span>
        {playerId && <span className="hist__mobile-profile-id">ID: {truncateId(playerId)}</span>}
      </div>
    </div>
  );
}

function HistoryBottomNav({ onTab }: { onTab: (tab: BottomNavTab) => void }): React.ReactNode {
  const tabs: { id: BottomNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'HOME', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" /></svg> },
    { id: 'history', label: 'HISTORY', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" /></svg> },
    { id: 'stats', label: 'STATS', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" fill="currentColor" /></svg> },
    { id: 'leaderboard', label: 'BOARD', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" /></svg> },
    { id: 'profile', label: 'PROFILE', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" /></svg> },
  ];

  return (
    <nav className="hist__bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`hist__bottom-nav-tab${tab.id === 'history' ? ' hist__bottom-nav-tab--active' : ''}`}
          onClick={() => onTab(tab.id)}
          aria-current={tab.id === 'history' ? 'page' : undefined}
        >
          {tab.icon}
          <span className="hist__bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function SummaryBar({ total, wins, winRate }: { total: number; wins: number; winRate: string }): React.ReactNode {
  return (
    <div className="hist__summary">
      <div className="hist__summary-item">
        <span className="hist__summary-value">{total}</span>
        <span className="hist__summary-label">Games</span>
      </div>
      <div className="hist__summary-divider" aria-hidden="true" />
      <div className="hist__summary-item">
        <span className="hist__summary-value hist__summary-value--accent">{wins}</span>
        <span className="hist__summary-label">Wins</span>
      </div>
      <div className="hist__summary-divider" aria-hidden="true" />
      <div className="hist__summary-item">
        <span className="hist__summary-value">{winRate}</span>
        <span className="hist__summary-label">Win Rate</span>
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: GameHistoryEntry }): React.ReactNode {
  const [open, setOpen] = useState(false);
  const outcome = outcomeFor(entry);
  const opponents = entry.players
    .filter((p) => p.seatIndex !== entry.you.seatIndex)
    .map((p) => p.displayNameSnapshot);
  const isWin = !entry.isAbandoned && entry.you.finalRank === 1;

  return (
    <motion.div
      layout
      className={`hist__row${isWin ? ' hist__row--win' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
    >
      <button
        type="button"
        className="hist__row-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`hist__outcome-badge ${outcome.className}`}>{outcome.label}</span>
        <div className="hist__row-main">
          <span className="hist__date">{formatDate(entry.startedAt)}</span>
          <span className="hist__opponents">
            {opponents.length ? `vs ${opponents.join(', ')}` : 'Solo'}
          </span>
        </div>
        <div className="hist__row-meta">
          <span className="hist__meta-line">
            {entry.playerCount}p · {formatDuration(entry.durationMs)}
          </span>
          <span className="hist__meta-line hist__meta-line--dim">
            Score {entry.matchScore ?? 0} · XP +{entry.xpEarned ?? 0} · Rating {(entry.rankedRatingDelta ?? 0) >= 0 ? '+' : ''}{entry.rankedRatingDelta ?? 0}
          </span>
        </div>
        <span className={`hist__chevron${open ? ' hist__chevron--open' : ''}`} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor" />
          </svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="hist__scorecard"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="hist__scorecard-inner">
              <div className="hist__sc-head hist__sc-grid">
                <span>Player</span>
                <span>Seat</span>
                <span>Rank</span>
                <span>Captured</span>
                <span>Cut</span>
                <span>Score</span>
              </div>
              {[...entry.players]
                .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99))
                .map((p) => {
                  const isYou = p.seatIndex === entry.you.seatIndex;
                  return (
                    <div
                      key={p.seatIndex}
                      className={`hist__sc-row hist__sc-grid${isYou ? ' hist__sc-row--you' : ''}`}
                    >
                      <span className="hist__sc-name">
                        {p.displayNameSnapshot}
                        {isYou && <span className="hist__sc-youtag">you</span>}
                      </span>
                      <span>{p.seatIndex + 1}</span>
                      <span>{p.finalRank != null ? rankSuffix(p.finalRank) : '—'}</span>
                      <span>{p.captureCount}</span>
                      <span>{p.wasCut ? 'Yes' : '—'}</span>
                      <span>{p.matchScore ?? 0}</span>
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
  const { requestHistory, setScreen, session, account } = useGame();
  const isDesktop = useIsDesktop();
  const loggedIn = account?.loggedIn ?? false;
  const playerId = session?.playerId ?? null;

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
    return () => { cancelled = true; };
  }, [requestHistory]);

  const summary = useMemo(() => {
    if (state.status !== 'ready') return null;
    return computeSummary(state.games);
  }, [state]);

  function handleNavigate(screen: NavScreen): void {
    setScreen(screen);
  }

  function handleBottomNav(tab: BottomNavTab): void {
    if (tab === 'home' || tab === 'profile') setScreen('main');
    else if (tab === 'stats') setScreen('stats');
    else if (tab === 'leaderboard') setScreen('leaderboard');
  }

  return (
    <div className="hist__root">
      <HistoryHeader
        account={account}
        isDesktop={isDesktop}
        onNavigate={handleNavigate}
        onProfile={() => setScreen('main')}
      />

      <div className="hist__layout">
        {isDesktop && (
          <HistoryProfileSidebar
            account={account}
            playerId={playerId}
            loggedIn={loggedIn}
            onNavigate={(s) => setScreen(s)}
          />
        )}

        <main className="hist__main">
          {!isDesktop && loggedIn && (
            <MobileProfileStrip account={account} playerId={playerId} loggedIn={loggedIn} />
          )}

          {isDesktop && (
            <div className="hist__title-block">
              <div className="hist__title-row">
                <TitleFlourish />
                <h1 className="hist__page-title">GAME HISTORY</h1>
                <TitleFlourish />
              </div>
              <p className="hist__subtitle">Review your past matches and scorecards</p>
            </div>
          )}

          {state.status === 'loading' && (
            <div className="hist__center">
              <div className="spinner" />
              <p className="muted">Loading your games…</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="card-surface hist__message">
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
            <div className="card-surface hist__message">
              <p>No games yet. Play a round and it&apos;ll show up here!</p>
              <button type="button" className="secondary" onClick={() => setScreen('main')}>
                Back to lobby
              </button>
            </div>
          )}

          {state.status === 'ready' && state.games.length > 0 && summary && (
            <>
              <SummaryBar total={summary.total} wins={summary.wins} winRate={summary.winRate} />

              <div className="hist__list-wrap">
                <div className="hist__list-head" aria-hidden="true">
                  <span className="hist__list-head-outcome">Result</span>
                  <span className="hist__list-head-main">Match</span>
                  <span className="hist__list-head-meta">Details</span>
                  <span className="hist__list-head-chevron" />
                </div>
                <div className="hist__list">
                  {state.games.map((g) => (
                    <HistoryRow key={g.id} entry={g} />
                  ))}
                </div>
              </div>

              <p className="hist__update-note">Showing {state.games.length} most recent games</p>
            </>
          )}
        </main>
      </div>

      <HistoryBottomNav onTab={handleBottomNav} />

      {isDesktop && (
        <footer className="hist__footer-bar">
          <span className="hist__footer-suits">♠ ♥ ♦</span>
          <span className="hist__footer-tagline">Play smart. Play sharp. Win with Ganatri.</span>
          <span className="hist__footer-suits">♣ ♥ ♠</span>
        </footer>
      )}
    </div>
  );
}
