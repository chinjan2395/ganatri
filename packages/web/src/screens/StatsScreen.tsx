// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  DsTopNav,
  DsBottomNav,
  DsScreenHeader,
  DsProfileSidebar,
  DsProfileStrip,
  DsTitleBlock,
  DsStatCard,
  DsPlayTimeBar,
  DsPlaceholder,
  DsSpinner,
  DsEmptyState,
  DsButton,
  FooterBar,
  DsIcon,
} from '@ganatri/ds';
import type { DsTopNavItem, DsBottomNavTab } from '@ganatri/ds';
import { useGame } from '../state/GameProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { GameHistoryEntry, PlayerStatsView } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import './StatsScreen.css';

type NavScreen = 'main' | 'history' | 'stats' | 'leaderboard';

type StatsLoadState =
  | { status: 'loading' }
  | { status: 'error'; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' }
  | { status: 'ready'; stats: PlayerStatsView };

type HistoryLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; games: GameHistoryEntry[] };

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatPct(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${Math.round(rate * 100)}%`;
}

function formatAvgFinish(avg: number): string {
  if (!Number.isFinite(avg) || avg === 0) return '—';
  return avg.toFixed(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function rankSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

function finishLabel(entry: GameHistoryEntry): { text: string; className: string } {
  if (entry.isAbandoned) return { text: 'Abandoned', className: 'st__result--abandoned' };
  const { finalRank } = entry.you;
  if (finalRank === 1) return { text: '1st', className: 'st__result--won' };
  if (finalRank != null) return { text: rankSuffix(finalRank), className: 'st__result--lost' };
  return { text: '—', className: 'st__result--neutral' };
}

function statIconFor(name: string): ReactNode {
  const props = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const };
  switch (name) {
    case 'games':
      return (
        <svg {...props}>
          <path d="M4 6h16v12H4V6zm2 2v8h12V8H6zm2 2h2v4H8v-4zm6 0h2v4h-2v-4z" fill="currentColor" />
        </svg>
      );
    case 'winrate':
      return (
        <svg {...props}>
          <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" />
        </svg>
      );
    case 'podium':
      return (
        <svg {...props}>
          <path d="M8 21h8v-9H8v9zm-4-6H2v6h2v-6zm18 0h-2v6h2v-6zM12 3L7 10h10L12 3z" fill="currentColor" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
        </svg>
      );
    case 'x':
      return (
        <svg {...props}>
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" />
        </svg>
      );
    case 'flag':
      return (
        <svg {...props}>
          <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z" fill="currentColor" />
        </svg>
      );
    case 'cards':
      return (
        <svg {...props}>
          <path d="M4 4h16v2H4V4zm0 4h10v2H4V8zm0 4h14v2H4v-2zm0 4h8v2H4v-2z" fill="currentColor" />
        </svg>
      );
    case 'scissors':
      return (
        <svg {...props}>
          <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-3L13.64 10.36zM6 20c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm12-8c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" fill="currentColor" />
        </svg>
      );
    case 'cut':
      return (
        <svg {...props}>
          <path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5zm-11 0C5.12 13 4 14.12 4 15.5S5.12 18 6.5 18 9 16.88 9 15.5 7.88 13 6.5 13z" fill="currentColor" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.11v5.71c0 4.54-3.07 8.83-7 9.93-3.93-1.1-7-5.39-7-9.93V6.29l7-3.11z" fill="currentColor" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...props}>
          <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" fill="currentColor" />
        </svg>
      );
    case 'streak':
      return (
        <svg {...props}>
          <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

function buildStatCards(stats: PlayerStatsView): { label: string; value: string | number; icon: ReactNode; accent?: boolean }[] {
  return [
    { label: 'Games Played', value: stats.gamesPlayed, icon: statIconFor('games') },
    { label: 'Win Rate', value: formatPct(stats.winRate), icon: statIconFor('winrate') },
    { label: 'Avg Finish', value: formatAvgFinish(stats.avgFinish), icon: statIconFor('podium') },
    { label: 'Wins', value: stats.gamesWon, icon: statIconFor('check') },
    { label: 'Losses', value: stats.gamesLost, icon: statIconFor('x') },
    { label: 'Abandoned', value: stats.gamesAbandoned, icon: statIconFor('flag') },
    { label: 'Total Captures', value: stats.totalCaptures, icon: statIconFor('cards') },
    { label: 'Cuts Given', value: stats.cutsGiven, icon: statIconFor('scissors') },
    { label: 'Cuts Received', value: stats.cutsReceived, icon: statIconFor('cut') },
    { label: 'Times Safe', value: stats.timesSafe, icon: statIconFor('shield') },
    { label: 'Best Match', value: stats.highestMatchScore, icon: statIconFor('cards') },
    { label: 'Avg Match Score', value: stats.averageMatchScore.toFixed(1), icon: statIconFor('podium') },
    { label: 'Ghost Finishes', value: stats.ghostFinishes, icon: statIconFor('shield') },
    { label: 'Total Match Score', value: stats.totalMatchScore, icon: statIconFor('games') },
    { label: 'Current Streak', value: stats.currentWinStreak, icon: statIconFor('flame'), accent: true },
    { label: 'Longest Streak', value: stats.longestWinStreak, icon: statIconFor('streak') },
  ];
}

const TOP_NAV_ITEMS: DsTopNavItem[] = [
  { id: 'main', label: 'Home', icon: 'home' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
];

const BOTTOM_NAV_TABS: DsBottomNavTab[] = [
  { id: 'home', label: 'HOME', icon: 'home' },
  { id: 'history', label: 'HISTORY', icon: 'history' },
  { id: 'stats', label: 'STATS', icon: 'stats' },
  { id: 'leaderboard', label: 'BOARD', icon: 'leaderboard' },
  { id: 'profile', label: 'PROFILE', icon: 'profile' },
];

export function StatsScreen(): React.ReactNode {
  const { requestMyStats, requestHistory, setScreen, session, account } = useGame();
  const isDesktop = useIsDesktop();
  const loggedIn = account?.loggedIn ?? false;
  const playerId = session?.playerId ?? null;

  const [state, setState] = useState<StatsLoadState>({ status: 'loading' });
  const [historyState, setHistoryState] = useState<HistoryLoadState>({ status: 'idle' });

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
    return () => { cancelled = true; };
  }, [requestMyStats]);

  useEffect(() => {
    if (!loggedIn) {
      setHistoryState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setHistoryState({ status: 'loading' });
    void requestHistory().then((ack) => {
      if (cancelled) return;
      if (ack.ok) {
        setHistoryState({ status: 'ready', games: ack.games });
      } else {
        setHistoryState({ status: 'error' });
      }
    });
    return () => { cancelled = true; };
  }, [loggedIn, requestHistory]);

  function handleNavigate(screen: string): void {
    setScreen(screen as NavScreen);
  }

  function handleBottomNav(tab: string): void {
    if (tab === 'home' || tab === 'profile') setScreen('main');
    else if (tab === 'history') setScreen('history');
    else if (tab === 'leaderboard') setScreen('leaderboard');
  }

  const displayName = account?.displayName ?? (loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();
  const hasStats = state.status === 'ready' && state.stats.gamesPlayed > 0;

  return (
    <div className="st__root">
      {!isDesktop && (
        <DsScreenHeader
          title="YOUR STATS"
          onBack={() => handleNavigate('main')}
          trailing={
            <DsButton
              tone="ghost"
              onClick={() => setScreen('main')}
              aria-label="Profile"
            >
              <DsIcon name="profile" size={22} aria-hidden />
            </DsButton>
          }
          backLabel="Back to home"
        />
      )}

      {isDesktop && (
        <DsTopNav
          logo={<img src={logo} alt="Ganatri" style={{ width: 'min(140px, 28vw)', height: 'auto' }} />}
          items={TOP_NAV_ITEMS}
          activeId="stats"
          onNavigate={handleNavigate}
          avatarUrl={avatarUrl}
          avatarInitial={initial}
          avatarLabel={`Profile: ${displayName}`}
          onAvatarClick={() => setScreen('main')}
        />
      )}

      <div className="st__layout">
        {isDesktop && (
          <DsProfileSidebar
            displayName={displayName}
            avatarUrl={avatarUrl}
            playerId={playerId ? truncateId(playerId) : null}
            showCrown
            navItems={[
              { label: 'Stats', active: true, disabled: true },
              { label: 'Game History', onClick: () => handleNavigate('history') },
              { label: 'Leaderboard', onClick: () => handleNavigate('leaderboard') },
            ]}
          />
        )}

        <main className="st__main">
          {!isDesktop && loggedIn && (
            <DsProfileStrip
              displayName={displayName}
              avatarUrl={avatarUrl}
              playerId={playerId ? truncateId(playerId) : null}
            />
          )}

          {isDesktop && <DsTitleBlock title="YOUR STATS" />}

          {state.status === 'loading' && (
            <div className="st__center">
              <DsSpinner />
              <p className="st__muted">Loading your stats…</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="st__message">
              <DsEmptyState
                message={
                  state.error === 'NOT_LOGGED_IN'
                    ? 'Log in with Google to see your stats.'
                    : 'Stats are currently unavailable. Please try again later.'
                }
              />
              <DsButton tone="secondary" onClick={() => setScreen('main')}>
                Back to lobby
              </DsButton>
            </div>
          )}

          {state.status === 'ready' && state.stats.gamesPlayed === 0 && (
            <div className="st__message">
              <DsEmptyState message="No games played yet. Play a round and your stats will show up here!" />
              <DsButton tone="secondary" onClick={() => setScreen('main')}>
                Back to lobby
              </DsButton>
            </div>
          )}

          {hasStats && (
            <>
              <div className="st__grid">
                {buildStatCards(state.stats).map((card, i) => (
                  <DsStatCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    icon={card.icon}
                    accent={card.accent}
                    animationDelay={i * 0.03}
                  />
                ))}
              </div>

              <DsPlayTimeBar ms={state.stats.totalPlayTimeMs} />

              <div className="st__middle-row">
                <DsPlaceholder variant="performance" title="Performance Over Time" dropdownLabel="Last 7 Days ▾" />
                <DsPlaceholder variant="cards" title="Favorite Cards" />
              </div>

              <div className="st__bottom-row">
                <DsPlaceholder variant="modes" title="Game Modes Played" />

                <div className="st__panel--recent">
                  <h3 className="st__panel-title">Recent Results</h3>
                  {historyState.status === 'loading' && <p className="st__panel-muted">Loading…</p>}
                  {historyState.status === 'error' && <p className="st__panel-muted">History unavailable</p>}
                  {(historyState.status === 'idle' || (historyState.status === 'ready' && historyState.games.length === 0)) && (
                    <p className="st__panel-muted">No games yet</p>
                  )}
                  {historyState.status === 'ready' && historyState.games.length > 0 && (
                    <ul className="st__recent-list">
                      {historyState.games.slice(0, 4).map((game) => {
                        const finish = finishLabel(game);
                        return (
                          <li key={game.id} className="st__recent-row">
                            <span className="st__recent-date">{formatDate(game.startedAt)}</span>
                            <span className={`st__recent-finish ${finish.className}`}>{finish.text}</span>
                            <span className="st__recent-score">Score {game.matchScore ?? 0}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <DsButton tone="ghost" className="st__panel-link" onClick={() => setScreen('history')}>View All History</DsButton>
                </div>

                <DsPlaceholder variant="achievements" title="Achievements" linkLabel="View All Achievements" />
              </div>
            </>
          )}
        </main>
      </div>

      <DsBottomNav tabs={BOTTOM_NAV_TABS} activeId="stats" onTab={handleBottomNav} />

      {isDesktop && <FooterBar />}
    </div>
  );
}
