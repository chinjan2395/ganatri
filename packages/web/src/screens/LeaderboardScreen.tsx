// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../state/GameProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { LeaderboardEntryView } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import {
  DsTopNav,
  DsBottomNav,
  DsScreenHeader,
  DsProfileSidebar,
  DsTitleBlock,
  DsTabs,
  DsRankRow,
  DsSpinner,
  DsEmptyState,
  DsButton,
  DsIcon,
  FooterBar,
  FeltBackdrop,
  CornerDecor,
} from '@ganatri/ds';
import type { DsTopNavItem, DsBottomNavTab } from '@ganatri/ds';
import './LeaderboardScreen.css';

type TimeWindow = 'week' | 'month' | undefined;
type NavScreen = 'main' | 'history' | 'stats' | 'leaderboard';
type BottomNavTabId = 'home' | 'history' | 'stats' | 'leaderboard' | 'profile';

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

function windowToLabel(w: TimeWindow): string {
  if (w === 'week') return 'This Week';
  if (w === 'month') return 'This Month';
  return 'All Time';
}

function labelToWindow(label: string): TimeWindow {
  if (label === 'This Week') return 'week';
  if (label === 'This Month') return 'month';
  return undefined;
}

function emptyMessage(timeWindow: TimeWindow): string {
  if (timeWindow === 'week') return 'No games completed this week yet.';
  if (timeWindow === 'month') return 'No games completed this month yet.';
  return 'No ranked players yet — finish a game to get on the board!';
}

const NAV_ITEMS: DsTopNavItem[] = [
  { id: 'main', label: 'Home', icon: 'home' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
];

const BOTTOM_TABS: DsBottomNavTab[] = [
  { id: 'home', label: 'HOME', icon: 'home' },
  { id: 'history', label: 'HISTORY', icon: 'history' },
  { id: 'stats', label: 'STATS', icon: 'stats' },
  { id: 'leaderboard', label: 'BOARD', icon: 'leaderboard' },
  { id: 'profile', label: 'PROFILE', icon: 'profile' },
];

const TAB_LABELS = ['All Time', 'This Week', 'This Month'];

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

  const displayName = account?.displayName ?? (loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const avatarInitial = displayName.charAt(0).toUpperCase();

  function handleNavigate(screen: NavScreen): void {
    setScreen(screen);
  }

  function handleBottomNav(tab: BottomNavTabId): void {
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
      <FeltBackdrop />
      {isDesktop ? (
        <DsTopNav
          logo={<img src={logo} alt="Ganatri" className="lb__header-logo-sm" />}
          items={NAV_ITEMS}
          activeId="leaderboard"
          onNavigate={(id) => handleNavigate(id as NavScreen)}
          avatarUrl={avatarUrl}
          avatarInitial={avatarInitial}
          avatarLabel={`Profile: ${displayName}`}
          onAvatarClick={() => setScreen('main')}
        />
      ) : (
        <DsScreenHeader
          title="LEADERBOARD"
          onBack={() => handleNavigate('main')}
          backLabel="Back to home"
          trailing={<DsIcon name="crown" size={22} />}
        />
      )}

      <div className="lb__layout">
        {isDesktop && (
          <DsProfileSidebar
            displayName={displayName}
            avatarUrl={avatarUrl}
            playerId={myId != null ? truncateId(myId) : null}
            showCrown
            stats={[
              { label: 'Rank', value: myRank != null ? `#${myRank}` : '—' },
              { label: 'Win %', value: statsLoading ? '…' : (winPct ?? '—') },
            ]}
            navItems={[
              { label: 'Game History', onClick: () => setScreen('history') },
              { label: 'Stats', onClick: () => setScreen('stats') },
              { label: 'Leaderboard', active: true, disabled: true },
            ]}
          />
        )}

        <main className="lb__main">
          {isDesktop && (
            <DsTitleBlock
              title="LEADERBOARD"
              subtitle="See how you rank among the best players"
              showCrown
            />
          )}

          <DsTabs
            items={TAB_LABELS}
            active={windowToLabel(timeWindow)}
            onChange={(label) => setTimeWindow(labelToWindow(label))}
          />

          {state.status === 'loading' && (
            <div className="lb__center">
              <DsSpinner />
              <p className="lb__loading-text">Loading leaderboard...</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="lb__center">
              <DsEmptyState message="Leaderboard is currently unavailable. Please try again later." />
              <DsButton tone="secondary" onClick={() => setScreen('main')}>Back to lobby</DsButton>
            </div>
          )}

          {state.status === 'ready' && state.entries.length === 0 && (
            <div className="lb__center">
              <DsEmptyState message={emptyMessage(timeWindow)} />
              <DsButton tone="secondary" onClick={() => setScreen('main')}>Back to lobby</DsButton>
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
                    <DsRankRow
                      key={entry.userId}
                      rank={entry.rank}
                      displayName={entry.displayName}
                      avatarUrl={entry.avatarUrl}
                      isMe={entry.userId === myId}
                      gamesWon={entry.gamesWon}
                      gamesPlayed={entry.gamesPlayed}
                      winRate={formatPct(entry.winRate)}
                    />
                  ))}
                </div>
              </div>

              <p className="lb__update-note">ⓘ Leaderboard updates every 10 minutes</p>

              {showDesktopMyRank && state.myEntry && (
                <div className="lb__my-rank">
                  <p className="lb__my-rank-label">Your ranking</p>
                  <DsRankRow
                    rank={state.myEntry.rank}
                    displayName={state.myEntry.displayName}
                    avatarUrl={state.myEntry.avatarUrl}
                    isMe
                    gamesWon={state.myEntry.gamesWon}
                    gamesPlayed={state.myEntry.gamesPlayed}
                    winRate={formatPct(state.myEntry.winRate)}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showStickyRow && myEntryResolved && (
        <div className="lb__sticky-row" aria-label="Your ranking">
          <DsRankRow
            rank={myEntryResolved.rank}
            displayName={myEntryResolved.displayName}
            avatarUrl={myEntryResolved.avatarUrl}
            isMe
            compact
            gamesWon={myEntryResolved.gamesWon}
            gamesPlayed={myEntryResolved.gamesPlayed}
            winRate={formatPct(myEntryResolved.winRate)}
          />
        </div>
      )}

      <DsBottomNav
        tabs={BOTTOM_TABS}
        activeId="leaderboard"
        onTab={(tab) => handleBottomNav(tab as BottomNavTabId)}
      />

      <FooterBar tagline="Play smart. Play sharp. Win with Ganatri." />
      <CornerDecor />
    </div>
  );
}
