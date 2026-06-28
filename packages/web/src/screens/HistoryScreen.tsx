// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../state/GameProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { GameHistoryEntry } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import {
  DsTopNav,
  DsBottomNav,
  DsScreenHeader,
  DsProfileSidebar,
  DsProfileStrip,
  DsTitleBlock,
  DsSummaryBar,
  DsHistoryRow,
  DsSpinner,
  DsEmptyState,
  DsButton,
  FooterBar,
} from '@ganatri/ds';
import type { DsTopNavItem, DsBottomNavTab, DsHistoryOutcome } from '@ganatri/ds';
import './HistoryScreen.css';

type NavScreen = 'main' | 'history' | 'stats' | 'leaderboard';
type BottomNavTabId = 'home' | 'history' | 'stats' | 'leaderboard' | 'profile';

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

function outcomeFor(entry: GameHistoryEntry): { outcome: DsHistoryOutcome; outcomeLabel: string } {
  if (entry.isAbandoned) return { outcome: 'abandoned', outcomeLabel: 'Abandoned' };
  const { finalRank } = entry.you;
  if (finalRank === 1) return { outcome: 'won', outcomeLabel: 'Won' };
  if (finalRank != null) return { outcome: 'lost', outcomeLabel: rankSuffix(finalRank) };
  return { outcome: 'neutral', outcomeLabel: entry.you.result ?? 'Finished' };
}

function computeSummary(games: GameHistoryEntry[]): { total: number; wins: number; winRate: string } {
  const total = games.length;
  const wins = games.filter((g) => !g.isAbandoned && g.you.finalRank === 1).length;
  const winRate = total > 0 ? `${Math.round((wins / total) * 100)}%` : '0%';
  return { total, wins, winRate };
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

  const displayName = account?.displayName ?? (loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const avatarInitial = displayName.charAt(0).toUpperCase();

  function handleNavigate(screen: NavScreen): void {
    setScreen(screen);
  }

  function handleBottomNav(tab: BottomNavTabId): void {
    if (tab === 'home' || tab === 'profile') setScreen('main');
    else if (tab === 'stats') setScreen('stats');
    else if (tab === 'leaderboard') setScreen('leaderboard');
  }

  return (
    <div className="hist__root">
      {isDesktop ? (
        <DsTopNav
          logo={<img src={logo} alt="Ganatri" className="hist__header-logo-sm" />}
          items={NAV_ITEMS}
          activeId="history"
          onNavigate={(id) => handleNavigate(id as NavScreen)}
          avatarUrl={avatarUrl}
          avatarInitial={avatarInitial}
          avatarLabel={`Profile: ${displayName}`}
          onAvatarClick={() => setScreen('main')}
        />
      ) : (
        <DsScreenHeader
          title="GAME HISTORY"
          onBack={() => handleNavigate('main')}
          backLabel="Back to home"
        />
      )}

      <div className="hist__layout">
        {isDesktop && (
          <DsProfileSidebar
            displayName={displayName}
            avatarUrl={avatarUrl}
            playerId={playerId != null ? truncateId(playerId) : null}
            showCrown
            navItems={[
              { label: 'Game History', active: true, disabled: true },
              { label: 'Stats', onClick: () => setScreen('stats') },
              { label: 'Leaderboard', onClick: () => setScreen('leaderboard') },
            ]}
          />
        )}

        <main className="hist__main">
          {!isDesktop && loggedIn && (
            <DsProfileStrip
              displayName={displayName}
              avatarUrl={avatarUrl}
              playerId={playerId != null ? truncateId(playerId) : null}
            />
          )}

          {isDesktop && (
            <div className="hist__title-block">
              <DsTitleBlock
                title="GAME HISTORY"
                subtitle="Review your past matches and scorecards"
                showCrown
              />
            </div>
          )}

          {state.status === 'loading' && (
            <div className="hist__center">
              <DsSpinner />
              <DsEmptyState message="Loading your games…" />
            </div>
          )}

          {state.status === 'error' && (
            <div className="hist__center">
              <DsEmptyState
                message={
                  state.error === 'NOT_LOGGED_IN'
                    ? 'Log in with Google to see your game history.'
                    : 'Game history is currently unavailable. Please try again later.'
                }
              />
              <DsButton tone="secondary" onClick={() => setScreen('main')}>Back to lobby</DsButton>
            </div>
          )}

          {state.status === 'ready' && state.games.length === 0 && (
            <div className="hist__center">
              <DsEmptyState message="No games yet. Play a round and it'll show up here!" />
              <DsButton tone="secondary" onClick={() => setScreen('main')}>Back to lobby</DsButton>
            </div>
          )}

          {state.status === 'ready' && state.games.length > 0 && summary && (
            <>
              <DsSummaryBar total={summary.total} wins={summary.wins} winRate={summary.winRate} />

              <div className="hist__list-wrap">
                <div className="hist__list-head" aria-hidden="true">
                  <span className="hist__list-head-outcome">Result</span>
                  <span className="hist__list-head-main">Match</span>
                  <span className="hist__list-head-meta">Details</span>
                  <span className="hist__list-head-chevron" />
                </div>
                <div className="hist__list">
                  {state.games.map((g) => {
                    const { outcome, outcomeLabel } = outcomeFor(g);
                    const opponents = g.players
                      .filter((p) => p.seatIndex !== g.you.seatIndex)
                      .map((p) => p.displayNameSnapshot);
                    const isWin = !g.isAbandoned && g.you.finalRank === 1;
                    return (
                      <DsHistoryRow
                        key={g.id}
                        outcome={outcome}
                        outcomeLabel={outcomeLabel}
                        date={formatDate(g.startedAt)}
                        opponents={opponents}
                        playerCount={g.playerCount}
                        duration={formatDuration(g.durationMs)}
                        matchScore={g.matchScore ?? 0}
                        xpEarned={g.xpEarned ?? 0}
                        rankedRatingDelta={g.rankedRatingDelta ?? 0}
                        isWin={isWin}
                        players={g.players.map((p) => ({
                          seatIndex: p.seatIndex,
                          displayName: p.displayNameSnapshot,
                          finalRank: p.finalRank,
                          captureCount: p.captureCount,
                          wasCut: p.wasCut,
                          matchScore: p.matchScore ?? 0,
                          isYou: p.seatIndex === g.you.seatIndex,
                        }))}
                      />
                    );
                  })}
                </div>
              </div>

              <p className="hist__update-note">Showing {state.games.length} most recent games</p>
            </>
          )}
        </main>
      </div>

      <DsBottomNav
        tabs={BOTTOM_TABS}
        activeId="history"
        onTab={(tab) => handleBottomNav(tab as BottomNavTabId)}
      />

      {isDesktop && (
        <FooterBar tagline="Play smart. Play sharp. Win with Ganatri." />
      )}
    </div>
  );
}
