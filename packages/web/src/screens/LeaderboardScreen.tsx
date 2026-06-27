// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { LeaderboardEntryView } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import './LeaderboardScreen.css';

type TimeWindow = 'week' | 'month' | undefined;
type NavScreen = 'main' | 'history' | 'stats' | 'leaderboard';
type BottomNavTab = 'home' | 'history' | 'stats' | 'leaderboard' | 'profile';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: 'UNAVAILABLE' }
  | { status: 'ready'; entries: LeaderboardEntryView[]; myEntry?: LeaderboardEntryView };

function formatPct(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${Math.round(rate * 100)}%`;
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function MedalIcon({ rank }: { rank: number }): React.ReactNode {
  if (rank === 1) {
    return (
      <svg className="lb__medal lb__medal--gold" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="10" r="7" fill="currentColor" />
        <path d="M8 17l-1 5 5-2 5 2-1-5" fill="currentColor" opacity="0.85" />
        <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1a1200">1</text>
      </svg>
    );
  }
  if (rank === 2) {
    return (
      <svg className="lb__medal lb__medal--silver" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="10" r="7" fill="currentColor" />
        <path d="M8 17l-1 5 5-2 5 2-1-5" fill="currentColor" opacity="0.85" />
        <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1a1a1a">2</text>
      </svg>
    );
  }
  if (rank === 3) {
    return (
      <svg className="lb__medal lb__medal--bronze" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="10" r="7" fill="currentColor" />
        <path d="M8 17l-1 5 5-2 5 2-1-5" fill="currentColor" opacity="0.85" />
        <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="700" fill="#2a1400">3</text>
      </svg>
    );
  }
  return <span className="lb__rank-num">#{rank}</span>;
}

function TitleFlourish(): React.ReactNode {
  return (
    <svg className="lb__flourish" viewBox="0 0 48 12" aria-hidden="true">
      <path d="M0 6c8-6 16-6 24 0M24 6c8 6 16 6 24 0" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="24" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

function CrownIcon(): React.ReactNode {
  return (
    <svg className="lb__crown" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 18h18v2H3v-2zm2.5-9L7 12l5-7 5 7 1.5-3L21 14H3l2.5-5z"
        fill="currentColor"
      />
    </svg>
  );
}

interface RowProps {
  entry: LeaderboardEntryView;
  isMe: boolean;
  compact?: boolean;
}

function LeaderboardRow({ entry, isMe, compact }: RowProps): React.ReactNode {
  const displayName = isMe ? `${entry.displayName} (You)` : entry.displayName;

  return (
    <motion.div
      layout={!compact}
      className={`lb__row${isMe ? ' lb__row--me' : ''}${compact ? ' lb__row--compact' : ''}`}
      initial={compact ? false : { opacity: 0, y: 12 }}
      animate={compact ? undefined : { opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
    >
      <span className={`lb__rank${entry.rank <= 3 ? ' lb__rank--medal' : ''}`}>
        <MedalIcon rank={entry.rank} />
      </span>
      {entry.avatarUrl ? (
        <img className="lb__avatar" src={entry.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="lb__avatar lb__avatar--placeholder" aria-hidden="true">
          {(entry.displayName || '?').charAt(0).toUpperCase()}
        </span>
      )}
      <span className="lb__name">{displayName}</span>
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

interface LeaderboardHeaderProps {
  account: ReturnType<typeof useGame>['account'];
  isDesktop: boolean;
  onNavigate: (screen: NavScreen) => void;
  onProfile: () => void;
}

function LeaderboardHeader({ account, isDesktop, onNavigate, onProfile }: LeaderboardHeaderProps): React.ReactNode {
  const displayName = account?.displayName ?? (account?.loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  const topNav: { id: NavScreen; label: string; icon: React.ReactNode }[] = [
    {
      id: 'main',
      label: 'Home',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'stats',
      label: 'Stats',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" />
        </svg>
      ),
    },
  ];

  if (!isDesktop) {
    return (
      <header className="lb__header lb__header--mobile">
        <button
          type="button"
          className="lb__back-btn"
          onClick={() => onNavigate('main')}
          aria-label="Back to home"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
          </svg>
        </button>
        <div className="lb__mobile-title-wrap">
          <TitleFlourish />
          <h1 className="lb__mobile-title">LEADERBOARD</h1>
          <TitleFlourish />
        </div>
        <span className="lb__crown-wrap" aria-hidden="true">
          <CrownIcon />
        </span>
      </header>
    );
  }

  return (
    <header className="lb__header">
      <div className="lb__header-left">
        <img src={logo} alt="Ganatri" className="lb__header-logo-sm" />
      </div>
      <nav className="lb__top-nav" aria-label="Main navigation">
        {topNav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`lb__top-nav-btn${item.id === 'leaderboard' ? ' lb__top-nav-btn--active' : ''}`}
            onClick={() => (item.id === 'leaderboard' ? undefined : onNavigate(item.id))}
            aria-current={item.id === 'leaderboard' ? 'page' : undefined}
            disabled={item.id === 'leaderboard'}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" className="lb__top-nav-btn" onClick={onProfile}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
          </svg>
          <span>Profile</span>
        </button>
      </nav>
      <div className="lb__header-right">
        <button type="button" className="lb__header-avatar-btn" onClick={onProfile} aria-label={`Profile: ${displayName}`}>
          {avatarUrl ? (
            <img className="lb__header-avatar-img" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="lb__header-avatar-initials" aria-hidden="true">{initial}</span>
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
  myRank: number | null;
  winPct: string | null;
  statsLoading: boolean;
  onNavigate: (screen: 'history' | 'stats') => void;
}

function LeaderboardProfileSidebar({
  account, playerId, loggedIn, myRank, winPct, statsLoading, onNavigate,
}: ProfileSidebarProps): React.ReactNode {
  const displayName = account?.displayName ?? (loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="lb__sidebar">
      <div className="lb__profile-card">
        <div className="lb__profile-crown" aria-hidden="true">
          <CrownIcon />
        </div>
        <div className="lb__profile-avatar-wrap">
          {avatarUrl ? (
            <img className="lb__profile-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="lb__profile-avatar lb__profile-avatar--placeholder" aria-hidden="true">
              {initial}
            </span>
          )}
        </div>
        <h2 className="lb__profile-name">{displayName}</h2>
        {playerId && (
          <p className="lb__profile-id">Player ID: {truncateId(playerId)}</p>
        )}
        <div className="lb__profile-stats">
          <div className="lb__profile-stat">
            <span className="lb__profile-stat-label">Rank</span>
            <span className="lb__profile-stat-value">
              {myRank != null ? `#${myRank}` : '—'}
            </span>
          </div>
          <div className="lb__profile-stat">
            <span className="lb__profile-stat-label">Win %</span>
            <span className="lb__profile-stat-value">
              {statsLoading ? '…' : (winPct ?? '—')}
            </span>
          </div>
        </div>
      </div>

      <nav className="lb__sidebar-nav" aria-label="Account navigation">
        <button type="button" className="lb__sidebar-nav-btn" onClick={() => onNavigate('history')}>
          Game History
        </button>
        <button type="button" className="lb__sidebar-nav-btn" onClick={() => onNavigate('stats')}>
          Stats
        </button>
        <button type="button" className="lb__sidebar-nav-btn lb__sidebar-nav-btn--active" disabled>
          Leaderboard
        </button>
      </nav>
    </aside>
  );
}

interface BottomNavProps {
  onTab: (tab: BottomNavTab) => void;
}

function LeaderboardBottomNav({ onTab }: BottomNavProps): React.ReactNode {
  const tabs: { id: BottomNavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'HOME',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'HISTORY',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'stats',
      label: 'STATS',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'leaderboard',
      label: 'BOARD',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'PROFILE',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="lb__bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`lb__bottom-nav-tab${tab.id === 'leaderboard' ? ' lb__bottom-nav-tab--active' : ''}`}
          onClick={() => onTab(tab.id)}
          aria-current={tab.id === 'leaderboard' ? 'page' : undefined}
        >
          {tab.icon}
          <span className="lb__bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function LeaderboardScreen(): React.ReactNode {
  const { requestLeaderboard, requestMyStats, setScreen, session, account } = useGame();
  const isDesktop = useIsDesktop();
  const loggedIn = account?.loggedIn ?? false;

  const [timeWindow, setTimeWindow] = useState<TimeWindow>(undefined);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [winPct, setWinPct] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

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

  useEffect(() => {
    if (!loggedIn) {
      setWinPct(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    void requestMyStats().then((ack) => {
      if (cancelled) return;
      setStatsLoading(false);
      if (ack.ok) {
        setWinPct(formatPct(ack.stats.winRate));
      } else {
        setWinPct(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, requestMyStats]);

  const myId = session?.playerId ?? null;

  const myEntryResolved = useMemo((): LeaderboardEntryView | undefined => {
    if (state.status !== 'ready') return undefined;
    if (state.myEntry) return state.myEntry;
    if (!myId) return undefined;
    return state.entries.find((e) => e.userId === myId);
  }, [state, myId]);

  const myRank = myEntryResolved?.rank ?? null;
  const showStickyRow = !isDesktop && myEntryResolved != null;
  const showDesktopMyRank =
    isDesktop &&
    state.status === 'ready' &&
    state.myEntry != null &&
    !state.entries.some((e) => e.userId === state.myEntry?.userId);

  function handleNavigate(screen: NavScreen): void {
    setScreen(screen);
  }

  function handleBottomNav(tab: BottomNavTab): void {
    if (tab === 'home' || tab === 'profile') {
      setScreen('main');
    } else if (tab === 'history') {
      setScreen('history');
    } else if (tab === 'stats') {
      setScreen('stats');
    }
  }

  return (
    <div className={`lb__root${showStickyRow ? ' lb__root--sticky' : ''}`}>
      <LeaderboardHeader
        account={account}
        isDesktop={isDesktop}
        onNavigate={handleNavigate}
        onProfile={() => setScreen('main')}
      />

      <div className="lb__layout">
        {isDesktop && (
          <LeaderboardProfileSidebar
            account={account}
            playerId={myId}
            loggedIn={loggedIn}
            myRank={myRank}
            winPct={winPct}
            statsLoading={statsLoading}
            onNavigate={(s) => setScreen(s)}
          />
        )}

        <main className="lb__main">
          {isDesktop && (
            <div className="lb__title-block">
              <div className="lb__title-row">
                <TitleFlourish />
                <h1 className="lb__page-title">LEADERBOARD</h1>
                <TitleFlourish />
              </div>
              <p className="lb__subtitle">See how you rank among the best players</p>
            </div>
          )}

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
              <div className="lb__table-wrap">
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
                    <LeaderboardRow
                      key={entry.userId}
                      entry={entry}
                      isMe={entry.userId === myId}
                    />
                  ))}
                </div>
              </div>

              <p className="lb__update-note">ⓘ Leaderboard updates every 10 minutes</p>

              {showDesktopMyRank && state.myEntry && (
                <div className="lb__my-rank">
                  <p className="lb__my-rank-label">Your ranking</p>
                  <LeaderboardRow entry={state.myEntry} isMe={true} />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showStickyRow && myEntryResolved && (
        <div className="lb__sticky-row" aria-label="Your ranking">
          <LeaderboardRow entry={myEntryResolved} isMe={true} compact />
        </div>
      )}

      <LeaderboardBottomNav onTab={handleBottomNav} />

      {isDesktop && (
        <footer className="lb__footer-bar">
          <span className="lb__footer-suits">♠ ♥ ♦</span>
          <span className="lb__footer-tagline">Play smart. Play sharp. Win with Ganatri.</span>
          <span className="lb__footer-suits">♣ ♥ ♠</span>
        </footer>
      )}
    </div>
  );
}
