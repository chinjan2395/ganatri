import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import type { CoPlayerView, BlockedUserView, GetBlockedUsersAck, LeaderboardEntryView, PlayerStatsView } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import './LobbyScreen.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVITE_ERROR_MESSAGES: Record<string, string> = {
  OFFLINE: 'Player went offline',
  BLOCKED: 'You are blocked',
  ALREADY_IN_ROOM: 'Player is already in a room',
  ALREADY_IN_GAME: 'Game already in progress',
  UNAVAILABLE: 'Unavailable, try again',
};

// ---------------------------------------------------------------------------
// Hook: useIsDesktop
// ---------------------------------------------------------------------------

function useIsDesktop(): boolean {
  const [v, setV] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const handler = (e: MediaQueryListEvent): void => setV(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return v;
}

// ---------------------------------------------------------------------------
// Sub-component: LobbyHeader
// ---------------------------------------------------------------------------

interface LobbyHeaderProps {
  account: ReturnType<typeof useGame>['account'];
  onSettingsClick: () => void;
}

function LobbyHeader({ account, onSettingsClick }: LobbyHeaderProps): React.ReactNode {
  const isDesktop = useIsDesktop();
  const displayName = account?.displayName ?? (account?.loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="lobby__header">
      <div className="lobby__header-left">
        <div className="lobby__header-avatar">
          {avatarUrl ? (
            <img
              className="lobby__header-avatar-img"
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="lobby__header-avatar-initials" aria-hidden="true">
              {initial}
            </span>
          )}
        </div>
        <span className="lobby__header-name">{displayName}</span>
      </div>
      <div className="lobby__header-center">
        <img src={logo} alt="Ganatri" className="lobby__header-logo" />
      </div>
      <div className="lobby__header-right">
        {isDesktop && (
          <button
            type="button"
            className="lobby__header-rewards-btn"
            disabled
            title="Coming soon"
          >
            Rewards
          </button>
        )}
        <button
          type="button"
          className="lobby__header-icon-btn"
          aria-label="Notifications"
          title="Notifications"
        >
          {/* Bell icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.93 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
          </svg>
        </button>
        {isDesktop && (
          <button
            type="button"
            className="lobby__header-icon-btn"
            aria-label="Settings"
            title="Settings"
            onClick={onSettingsClick}
          >
            {/* Gear icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: CreateJoinPanel
// ---------------------------------------------------------------------------

interface CreateJoinPanelProps {
  name: string;
  setName: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  busy: boolean;
  localError: string | null;
  loginError: boolean;
  loggedIn: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onGoogleLogin: () => void;
}

function CreateJoinPanel({
  name, setName, code, setCode, busy, localError, loginError, loggedIn,
  onCreate, onJoin, onGoogleLogin,
}: CreateJoinPanelProps): React.ReactNode {
  return (
    <div className="lobby__create-join-card">
      {/* Guest name input */}
      {!loggedIn && (
        <input
          className="lobby__name-input-top"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="Your name"
          maxLength={20}
          autoFocus
        />
      )}

      {/* Desktop two-column layout */}
      <div className="lobby__cj-split">
        {/* Create Room */}
        <div className="lobby__cj-col">
          <div className="lobby__cj-heading">CREATE ROOM</div>
          <div className="lobby__cj-sub">Start a new game table</div>
          <button
            type="button"
            className="lobby__create-btn"
            onClick={onCreate}
            disabled={busy}
          >
            <span className="lobby__create-btn-plus">+</span> CREATE ROOM
          </button>
        </div>

        {/* Vertical divider (desktop only) */}
        <div className="lobby__cj-divider" aria-hidden="true" />

        {/* Join Room */}
        <div className="lobby__cj-col">
          <div className="lobby__cj-heading">JOIN ROOM</div>
          <div className="lobby__cj-sub">Join with a room code</div>
          <form
            className="lobby__join-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) onJoin(code);
            }}
          >
            <input
              className="lobby__code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
              placeholder="Enter room code"
              maxLength={8}
              autoCapitalize="characters"
            />
            <button type="submit" className="lobby__join-btn" disabled={busy || !code.trim()}>
              JOIN
            </button>
          </form>
        </div>
      </div>

      {/* Mobile: show "— OR JOIN WITH A CODE —" divider between two stacked sections */}
      <div className="lobby__or-divider">
        <span className="lobby__or-text">— OR JOIN WITH A CODE —</span>
      </div>

      {/* Errors */}
      {localError && <div className="lobby__error">{localError}</div>}
      {loginError && <div className="lobby__error">Google login failed, please try again.</div>}

      {/* Google login for guests */}
      {!loggedIn && (
        <button
          type="button"
          className="secondary lobby__google-btn"
          onClick={onGoogleLogin}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Log in with Google
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: QuickActions
// ---------------------------------------------------------------------------

interface QuickActionsProps {
  setScreen: (s: 'leaderboard' | 'history' | 'stats') => void;
  onInviteFriends: () => void;
  onHowToPlay: () => void;
  isDesktop: boolean;
}

function QuickActions({ setScreen, onInviteFriends, onHowToPlay, isDesktop }: QuickActionsProps): React.ReactNode {
  return (
    <div className={`lobby__quick-actions${isDesktop ? ' lobby__quick-actions--desktop' : ''}`}>
      <button
        type="button"
        className="lobby__qa-tile"
        onClick={() => setScreen('leaderboard')}
      >
        {/* Trophy icon */}
        <svg className="lobby__qa-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" fill="currentColor"/>
        </svg>
        <span className="lobby__qa-label">LEADERBOARD</span>
      </button>

      <button
        type="button"
        className="lobby__qa-tile"
        onClick={onInviteFriends}
      >
        {/* People icon */}
        <svg className="lobby__qa-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/>
        </svg>
        <span className="lobby__qa-label">INVITE FRIENDS</span>
      </button>

      <button
        type="button"
        className="lobby__qa-tile"
        onClick={onHowToPlay}
      >
        {/* Question mark icon */}
        <svg className="lobby__qa-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" fill="currentColor"/>
        </svg>
        <span className="lobby__qa-label">HOW TO PLAY</span>
      </button>

      {isDesktop && (
        <button
          type="button"
          className="lobby__qa-tile lobby__qa-tile--disabled"
          disabled
          title="Coming soon"
        >
          {/* Gift icon */}
          <svg className="lobby__qa-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6h-2.18c.07-.24.18-.46.18-.71C18 3.47 16.53 2 14.71 2c-.79 0-1.41.3-2.07.93L12 3.56l-.64-.63C10.72 2.3 10.1 2 9.29 2 7.47 2 6 3.47 6 5.29c0 .25.11.47.18.71H4c-1.1 0-2 .9-2 2v3h1v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-8h1V8c0-1.1-.9-2-2-2zm-5.29-2c.48 0 .29.29.29.29S15 5.48 15 5c0 .35-.23.64-.57.74C14.09 5.82 14 5.64 14 5.46V5c0-.15.3-.29.71-.29zM8 5.29C8 4.53 8.53 4 9.29 4c.35 0 .64.14.85.36L11 5.41V5c0 .46-.3.9-.71.74C9.93 5.64 9.71 5.35 9.71 5c0 .35-.23.64-.57.74.06.08.86.26.86.55v.71H10C9.12 7 8.71 6.52 8 5.86V5.29zM11 19H5v-8h6v8zm0-10H3V8h8v1zm2 10v-8h6v8h-6zm3-10h-8V8h8v1z" fill="currentColor"/>
          </svg>
          <span className="lobby__qa-label">DAILY BONUS</span>
          <span className="lobby__qa-sub">Coming soon</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RecentlyPlayed
// ---------------------------------------------------------------------------

interface RecentlyPlayedProps {
  loggedIn: boolean;
  recentPlayers: CoPlayerView[];
  invitePlayer: (targetUserId: string) => Promise<import('../protocol').InvitePlayerAck>;
}

function RecentlyPlayed({ loggedIn, recentPlayers, invitePlayer }: RecentlyPlayedProps): React.ReactNode {
  const isDesktop = useIsDesktop();
  const [expanded, setExpanded] = useState(false);
  const [inviteState, setInviteState] = useState<Record<string, string>>({});

  async function handleInvite(userId: string): Promise<void> {
    setInviteState((prev) => ({ ...prev, [userId]: 'loading' }));
    const ack = await invitePlayer(userId);
    if (ack.ok) {
      setInviteState((prev) => ({ ...prev, [userId]: 'idle' }));
    } else {
      const msg = INVITE_ERROR_MESSAGES[ack.error] ?? 'Unavailable, try again';
      setInviteState((prev) => ({ ...prev, [userId]: msg }));
    }
  }

  const mobileVisible = expanded ? recentPlayers.slice(0, 10) : recentPlayers.slice(0, 4);
  const desktopVisible = expanded ? recentPlayers.slice(0, 10) : recentPlayers.slice(0, 5);
  const hasMore = recentPlayers.length > (isDesktop ? 5 : 4);

  // Logged-out placeholder state
  if (!loggedIn) {
    return (
      <div className="recently-played">
        <div className="rp__header-row">
          <span className="lobby__section-heading">RECENTLY PLAYED</span>
        </div>
        {/* Mobile rows */}
        <ul className="rp__rows" aria-label="Recently played players">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rp__row rp__row--placeholder">
              <div className="rp__avatar-wrap">
                <div className="rp__avatar rp__avatar-initials" aria-hidden="true" />
              </div>
              <div className="rp__row-info">
                <div className="rp__placeholder-bar" />
                <div className="rp__placeholder-bar rp__placeholder-bar--short" />
              </div>
              <div className="rp__locked-overlay">
                <span className="rp__lock-icon">&#128274;</span>
                <span className="rp__lock-text">Log in</span>
              </div>
            </li>
          ))}
        </ul>
        {/* Desktop cards */}
        <div className="rp__desktop-cards" aria-label="Recently played players">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rp__desktop-card rp__desktop-card--placeholder">
              <div className="rp__locked-overlay">
                <span className="rp__lock-icon">&#128274;</span>
                <span className="rp__lock-text">Log in to see players</span>
              </div>
              <div className="rp__avatar-wrap">
                <div className="rp__avatar rp__avatar-initials" aria-hidden="true" />
              </div>
              <div className="rp__placeholder-bar" />
              <div className="rp__placeholder-bar rp__placeholder-bar--short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (recentPlayers.length === 0) {
    return (
      <div className="recently-played">
        <div className="rp__header-row">
          <span className="lobby__section-heading">RECENTLY PLAYED</span>
        </div>
        <p className="rp__empty">No games played yet. Create or join a room to get started!</p>
      </div>
    );
  }

  function renderAvatar(player: CoPlayerView, size: 'small' | 'large'): React.ReactNode {
    const cls = size === 'large' ? 'rp__avatar rp__avatar--large' : 'rp__avatar';
    return (
      <div className="rp__avatar-wrap">
        {player.avatarUrl ? (
          <img
            className={cls}
            src={player.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`${cls} rp__avatar-initials`} aria-hidden="true">
            {player.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        {player.isOnline && <span className="rp__online-dot" aria-label="Online" />}
      </div>
    );
  }

  function statusText(player: CoPlayerView): string {
    if (player.isOnline) return 'online';
    if (player.gamesPlayedTogether > 0) return `${player.gamesPlayedTogether} games together`;
    return 'offline';
  }

  function renderInviteBtn(player: CoPlayerView): React.ReactNode {
    const state = inviteState[player.userId] ?? 'idle';
    const isLoading = state === 'loading';
    const errorMsg = state !== 'idle' && state !== 'loading' ? state : null;

    if (!player.isOnline) return null;

    return (
      <>
        <button
          type="button"
          className={`rp__invite-btn${isLoading ? ' rp__invite-btn--loading' : ''}`}
          disabled={isLoading}
          onClick={() => void handleInvite(player.userId)}
        >
          {isLoading ? '' : 'INVITE'}
        </button>
        {errorMsg && <div className="rp__invite-error">{errorMsg}</div>}
      </>
    );
  }

  return (
    <div className="recently-played">
      <div className="rp__header-row">
        <span className="lobby__section-heading">RECENTLY PLAYED</span>
        {hasMore && (
          <button
            type="button"
            className="rp__view-all-btn"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? 'SHOW LESS' : 'VIEW ALL'}
          </button>
        )}
      </div>

      {/* Mobile rows */}
      <ul className="rp__rows" aria-label="Recently played players">
        {mobileVisible.map((player) => {
          const state = inviteState[player.userId] ?? 'idle';
          const isLoading = state === 'loading';
          const errorMsg = state !== 'idle' && state !== 'loading' ? state : null;

          return (
            <li key={player.userId} className="rp__row">
              {renderAvatar(player, 'small')}
              <div className="rp__row-info">
                <span className="rp__name">{player.displayName}</span>
                <span className={`rp__status${player.isOnline ? ' rp__status--online' : ''}`}>
                  {statusText(player)}
                </span>
              </div>
              <div className="rp__row-actions">
                {player.isOnline && (
                  <button
                    type="button"
                    className={`rp__invite-btn${isLoading ? ' rp__invite-btn--loading' : ''}`}
                    disabled={isLoading}
                    onClick={() => void handleInvite(player.userId)}
                  >
                    {isLoading ? '' : 'INV'}
                  </button>
                )}
                {errorMsg && <div className="rp__invite-error">{errorMsg}</div>}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop horizontal card row */}
      <div className="rp__desktop-cards" aria-label="Recently played players">
        {desktopVisible.map((player) => (
          <div key={player.userId} className="rp__desktop-card">
            {renderAvatar(player, 'large')}
            <div className="rp__name">{player.displayName}</div>
            <div className={`rp__status${player.isOnline ? ' rp__status--online' : ''}`}>
              {statusText(player)}
            </div>
            {renderInviteBtn(player)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: DesktopSidebar
// ---------------------------------------------------------------------------

interface DesktopSidebarProps {
  requestLeaderboard: (timeWindow?: 'week' | 'month') => Promise<import('../protocol').GetLeaderboardAck>;
  requestMyStats: () => Promise<import('../protocol').GetMyStatsAck>;
  loggedIn: boolean;
  setScreen: (s: 'leaderboard' | 'history' | 'stats') => void;
}

function DesktopSidebar({ requestLeaderboard, requestMyStats, loggedIn, setScreen }: DesktopSidebarProps): React.ReactNode {
  const isDesktop = useIsDesktop();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryView[] | null>(null);
  const [stats, setStats] = useState<PlayerStatsView | null>(null);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    requestLeaderboard().then((ack) => {
      if (cancelled) return;
      if (ack.ok) setLeaderboard(ack.entries.slice(0, 5));
    }).catch(() => undefined);
    if (loggedIn) {
      requestMyStats().then((ack) => {
        if (cancelled) return;
        if (ack.ok) setStats(ack.stats);
      }).catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, [isDesktop, loggedIn, requestLeaderboard, requestMyStats]);

  function renderAvatarSmall(entry: LeaderboardEntryView): React.ReactNode {
    if (entry.avatarUrl) {
      return (
        <img
          className="sidebar__player-avatar"
          src={entry.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
        />
      );
    }
    return (
      <div className="sidebar__player-avatar sidebar__player-avatar--initials" aria-hidden="true">
        {entry.displayName.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <aside className="lobby__sidebar">
      {/* Top Players section */}
      <div className="sidebar__section">
        <h2 className="sidebar__heading">TOP PLAYERS</h2>
        {leaderboard === null ? (
          <div className="sidebar__skeleton-list">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="sidebar__player-row">
                <span className="sidebar__rank">
                  <div className="sidebar__skeleton" style={{ width: 14 }} />
                </span>
                <div className="sidebar__skeleton sidebar__skeleton--avatar" />
                <div style={{ flex: 1 }}>
                  <div className="sidebar__skeleton" style={{ width: '70%' }} />
                </div>
                <div className="sidebar__skeleton" style={{ width: 28 }} />
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="sidebar__empty">No rankings yet</p>
        ) : (
          <ul className="sidebar__player-list">
            {leaderboard.map((entry) => (
              <li key={entry.userId} className="sidebar__player-row">
                <span className="sidebar__rank">{entry.rank}</span>
                {renderAvatarSmall(entry)}
                <span className="sidebar__player-name">{entry.displayName}</span>
                <span className="sidebar__player-wins">{entry.gamesWon}W</span>
              </li>
            ))}
          </ul>
        )}
        <button
          key={tab.id}
          type="button"
          className="secondary sidebar__link-btn"
          onClick={() => setScreen('leaderboard')}
        >
          VIEW FULL LEADERBOARD
        </button>
      </div>

      {/* Your Stats section */}
      <div className="sidebar__section">
        <h2 className="sidebar__heading">YOUR STATS</h2>
        {!loggedIn ? (
          <p className="sidebar__empty">Log in to see your stats</p>
        ) : stats === null ? (
          <div className="sidebar__skeleton-list">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sidebar__stat-row">
                <div className="sidebar__skeleton" style={{ width: '50%' }} />
                <div className="sidebar__skeleton" style={{ width: 32 }} />
              </div>
            ))}
          </div>
        ) : (
          <ul className="sidebar__stat-list">
            <li className="sidebar__stat-row">
              <span className="sidebar__stat-label">Games Played</span>
              <span className="sidebar__stat-value">{stats.gamesPlayed}</span>
            </li>
            <li className="sidebar__stat-row">
              <span className="sidebar__stat-label">Games Won</span>
              <span className="sidebar__stat-value">{stats.gamesWon}</span>
            </li>
            <li className="sidebar__stat-row">
              <span className="sidebar__stat-label">Win Rate</span>
              <span className="sidebar__stat-value">{(stats.winRate * 100).toFixed(0)}%</span>
            </li>
            <li className="sidebar__stat-row">
              <span className="sidebar__stat-label">Best Streak</span>
              <span className="sidebar__stat-value">{stats.longestWinStreak}</span>
            </li>
          </ul>
        )}
        {loggedIn && (
          <button
            type="button"
            className="secondary sidebar__link-btn"
            onClick={() => setScreen('stats')}
          >
            VIEW DETAILED STATS
          </button>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: MobileBottomNav
// ---------------------------------------------------------------------------

type BottomNavTab = 'home' | 'history' | 'stats' | 'profile';

interface MobileBottomNavProps {
  activeTab: BottomNavTab;
  onTab: (t: BottomNavTab) => void;
}

function MobileBottomNav({ activeTab, onTab }: MobileBottomNavProps): React.ReactNode {
  const tabs: { id: BottomNavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'HOME',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor"/>
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'HISTORY',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor"/>
        </svg>
      ),
    },
    {
      id: 'stats',
      label: 'STATS',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z" fill="currentColor"/>
          <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" fill="currentColor"/>
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'PROFILE',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
        </svg>
      ),
    },
  ];

  return (
    <nav className="lobby__bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`lobby__bottom-nav-tab${activeTab === tab.id ? ' lobby__bottom-nav-tab--active' : ''}`}
          onClick={() => onTab(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          {tab.icon}
          <span className="lobby__bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ProfilePanel
// ---------------------------------------------------------------------------

interface ProfilePanelProps {
  account: ReturnType<typeof useGame>['account'];
  loggedIn: boolean;
  editingName: boolean;
  editNameValue: string;
  editNameBusy: boolean;
  editNameError: string | null;
  editInputRef: React.RefObject<HTMLInputElement>;
  blockedOpen: boolean;
  blockedUsers: BlockedUserView[] | null;
  blockedLoading: boolean;
  blockedError: string | null;
  onSaveName: () => void;
  onCancelEdit: () => void;
  onOpenEdit: () => void;
  onEditNameChange: (v: string) => void;
  onEditNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlockedToggle: () => void;
  onUnblock: (userId: string) => void;
  onLogout: () => void;
  onGoogleLogin: () => void;
  onSetScreen: (s: 'history' | 'stats') => void;
  onClose: () => void;
}

function ProfilePanel({
  account, loggedIn, editingName, editNameValue, editNameBusy, editNameError, editInputRef,
  blockedOpen, blockedUsers, blockedLoading, blockedError,
  onSaveName, onCancelEdit, onOpenEdit, onEditNameChange, onEditNameKeyDown,
  onBlockedToggle, onUnblock, onLogout, onGoogleLogin, onSetScreen, onClose,
}: ProfilePanelProps): React.ReactNode {
  return (
    <div className="lobby__profile-overlay" role="dialog" aria-modal="true" aria-label="Profile & Settings">
      <div className="lobby__profile-panel">
        <div className="lobby__profile-header">
          <h2 className="lobby__profile-title">PROFILE & SETTINGS</h2>
          <button
            type="button"
            className="lobby__profile-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {loggedIn ? (
          <div className="lobby__profile-body">
            {/* Account info + name edit */}
            <div className="lobby__account-info">
              {account?.avatarUrl ? (
                <img
                  className="lobby__avatar"
                  src={account.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="lobby__avatar lobby__avatar--placeholder" aria-hidden="true">
                  {(account?.displayName ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
              {editingName ? (
                <div className="lobby__name-edit">
                  <input
                    ref={editInputRef}
                    className="lobby__name-input"
                    aria-label="Display name"
                    value={editNameValue}
                    onChange={(e) => onEditNameChange(e.target.value.slice(0, 20))}
                    maxLength={20}
                    onKeyDown={onEditNameKeyDown}
                  />
                  <div className="lobby__name-edit-actions">
                    <button
                      type="button"
                      className="lobby__name-save-btn"
                      onClick={onSaveName}
                      disabled={editNameBusy}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="secondary lobby__name-cancel-btn"
                      onClick={onCancelEdit}
                      disabled={editNameBusy}
                    >
                      Cancel
                    </button>
                  </div>
                  {editNameError && (
                    <div className="lobby__name-edit-error">{editNameError}</div>
                  )}
                </div>
              ) : (
                <div className="lobby__name-row">
                  <span className="lobby__account-name">
                    {account?.displayName ?? 'Signed in'}
                  </span>
                  <button
                    type="button"
                    className="lobby__name-edit-btn"
                    onClick={onOpenEdit}
                    title="Edit display name"
                    aria-label="Edit display name"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Nav links */}
            <div className="row lobby__account-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => { onSetScreen('history'); onClose(); }}
              >
                History
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => { onSetScreen('stats'); onClose(); }}
              >
                Stats
              </button>
              <button type="button" className="secondary" onClick={onLogout}>
                Log out
              </button>
            </div>

            {/* Blocked users */}
            <div className="lobby__blocked-section">
              <button
                type="button"
                className="lobby__blocked-toggle"
                onClick={onBlockedToggle}
              >
                Blocked Users {blockedOpen ? '▴' : '▾'}
              </button>
              {blockedOpen && (
                <div className="lobby__blocked-panel">
                  {blockedLoading && <p className="lobby__blocked-empty">Loading...</p>}
                  {blockedError && <p className="lobby__blocked-error">{blockedError}</p>}
                  {!blockedLoading && !blockedError && blockedUsers !== null && (
                    blockedUsers.length === 0 ? (
                      <p className="lobby__blocked-empty">No blocked users.</p>
                    ) : (
                      <ul className="lobby__blocked-list">
                        {blockedUsers.map((u) => (
                          <li key={u.userId} className="lobby__blocked-row">
                            <span className="lobby__blocked-name">{u.displayName}</span>
                            <button
                              type="button"
                              className="lobby__unblock-btn"
                              onClick={() => onUnblock(u.userId)}
                            >
                              Unblock
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lobby__profile-body">
            <p className="lobby__profile-guest-msg">Sign in to save your stats and history.</p>
            <button
              type="button"
              className="secondary lobby__google-btn"
              onClick={onGoogleLogin}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Log in with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: HowToPlayModal
// ---------------------------------------------------------------------------

interface HowToPlayModalProps {
  onClose: () => void;
}

function HowToPlayModal({ onClose }: HowToPlayModalProps): React.ReactNode {
  return (
    <div className="lobby__modal-overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="lobby__modal-panel">
        <div className="lobby__modal-header">
          <h2 className="lobby__modal-title">HOW TO PLAY GANATRI</h2>
          <button
            type="button"
            className="lobby__profile-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="lobby__modal-body">
          <h3 className="lobby__modal-phase">Part 1 — Capture Phase</h3>
          <p>Each player gets 5 cards. On your turn, play one card. If table cards sum to your card's value (up to 3 cards), you capture them. Same-rank cards on the table are always captured. Draw one card from the stock after each play. When all cards are gone, Part 1 ends — your captures become your Part 2 hand.</p>

          <h3 className="lobby__modal-phase">Part 2 — Suit / Cut Phase</h3>
          <p>The first player leads any card. You must follow suit if you can. If everyone follows, the highest card of the led suit wins the trick — those cards are cancelled. If you can't follow suit, play any card as a "cut" — the trick ends immediately, and the holder of the highest led-suit card picks up all table cards. The cutter leads next. The last player holding cards loses!</p>
        </div>
        <button type="button" className="lobby__modal-close-btn" onClick={onClose}>
          GOT IT
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: LobbyScreen
// ---------------------------------------------------------------------------

export function LobbyScreen(): React.ReactNode {
  const {
    createRoom, joinRoom, account, loginWithGoogle, logout, setScreen,
    updateDisplayName, guestName, recentPlayers, invitePlayer,
    getBlockedUsers, unblockUser,
    requestMyStats, requestLeaderboard,
  } = useGame();
  const loggedIn = account?.loggedIn ?? false;
  const isDesktop = useIsDesktop();

  const [name, setName] = useState(() => {
    if (loggedIn) return account?.displayName ?? '';
    return guestName ?? '';
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState(false);
  const [rejoin, setRejoin] = useState<string | null>(null);

  // Display-name edit state
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editNameBusy, setEditNameBusy] = useState(false);
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Blocked users panel state
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserView[] | null>(null);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);

  // New overlay state
  const [profileOpen, setProfileOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  // Prefill the name field with the account display name once login resolves.
  useEffect(() => {
    if (loggedIn && account?.displayName) {
      setName((prev) => (prev.trim() ? prev : account.displayName!));
    }
  }, [loggedIn, account?.displayName]);

  // Prefill the name field with the guest name once the SESSION payload arrives.
  useEffect(() => {
    if (!loggedIn && guestName) {
      setName((prev) => (prev.trim() ? prev : guestName));
    }
  }, [loggedIn, guestName]);

  // Surface OAuth failures redirected back as ?login=error, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'error') {
      setLoginError(true);
      params.delete('login');
      const query = params.toString();
      const url = window.location.pathname + (query ? `?${query}` : '');
      window.history.replaceState(null, '', url);
    }
  }, []);

  function openEditName(): void {
    setEditNameValue(account?.displayName ?? '');
    setEditNameError(null);
    setEditingName(true);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  function cancelEditName(): void {
    setEditingName(false);
    setEditNameError(null);
  }

  async function handleSaveName(): Promise<void> {
    const newName = editNameValue.trim();
    if (newName === (account?.displayName ?? '')) {
      cancelEditName();
      return;
    }
    setEditNameBusy(true);
    setEditNameError(null);
    const ack = await updateDisplayName(newName);
    setEditNameBusy(false);
    if (ack.ok) {
      setEditingName(false);
    } else {
      if (ack.error === 'INVALID_NAME') {
        setEditNameError('Name cannot be empty.');
      } else {
        setEditNameError('Unavailable, try again.');
      }
    }
  }

  async function handleBlockedToggle(): Promise<void> {
    const next = !blockedOpen;
    setBlockedOpen(next);
    if (next && blockedUsers === null) {
      setBlockedLoading(true);
      setBlockedError(null);
      const ack: GetBlockedUsersAck = await getBlockedUsers();
      setBlockedLoading(false);
      if (ack.ok) {
        setBlockedUsers(ack.users);
      } else {
        setBlockedError('Unavailable');
      }
    }
  }

  async function handleUnblock(userId: string): Promise<void> {
    const ack = await unblockUser(userId);
    if (ack.ok) {
      setBlockedUsers((prev) => prev?.filter((u) => u.userId !== userId) ?? prev);
    }
  }

  function validateName(): boolean {
    if (!name.trim()) {
      setLocalError('Please enter your name.');
      return false;
    }
    return true;
  }

  async function handleCreate(): Promise<void> {
    if (!validateName()) return;
    setBusy(true);
    setLocalError(null);
    const ack = await createRoom(name.trim());
    setBusy(false);
    if (ack.ok) return;
    if (ack.error === 'ALREADY_IN_GAME' && ack.currentRoomCode) {
      setRejoin(ack.currentRoomCode);
    } else {
      setLocalError('Could not create room.');
    }
  }

  async function handleJoin(roomCode: string): Promise<void> {
    if (!validateName()) return;
    setBusy(true);
    setLocalError(null);
    const ack = await joinRoom(roomCode.trim().toUpperCase(), name.trim());
    setBusy(false);
    if (ack.ok) return;
    switch (ack.error) {
      case 'NOT_FOUND':
        setLocalError('No room with that code.');
        break;
      case 'FULL':
        setLocalError('That room is full.');
        break;
      case 'ALREADY_STARTED':
        setLocalError('That game has already started.');
        break;
      case 'ALREADY_IN_GAME':
        if (ack.currentRoomCode) setRejoin(ack.currentRoomCode);
        break;
      default:
        setLocalError('Could not join room.');
    }
  }

  function handleInviteFriends(): void {
    const shareData = { title: 'Play Ganatri', text: 'Join me for a game of Ganatri!', url: window.location.href };
    if (navigator.share && navigator.canShare?.(shareData)) {
      void navigator.share(shareData).catch(() => undefined);
    } else {
      void navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    }
  }

  // Rejoin early return
  if (rejoin) {
    return (
      <div className="center-screen">
        <img src={logo} alt="Ganatri" className="lobby__logo" />
        <motion.div
          className="card-surface lobby__panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        >
          <p>
            You already have an active game in room <strong>{rejoin}</strong>.
          </p>
          <button onClick={() => void handleJoin(rejoin)} disabled={busy}>
            Rejoin {rejoin}
          </button>
          <button className="secondary" onClick={() => setRejoin(null)} disabled={busy}>
            Back
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="lobby__root">
      <LobbyHeader account={account} onSettingsClick={() => setProfileOpen(true)} />

      <div className="lobby__desktop-layout">
        {/* Main content column */}
        <main className="lobby__main">
          <CreateJoinPanel
            name={name}
            setName={setName}
            code={code}
            setCode={setCode}
            busy={busy}
            localError={localError}
            loginError={loginError}
            loggedIn={loggedIn}
            onCreate={() => void handleCreate()}
            onJoin={(c) => void handleJoin(c)}
            onGoogleLogin={() => loginWithGoogle()}
          />

          <QuickActions
            setScreen={setScreen}
            onInviteFriends={handleInviteFriends}
            onHowToPlay={() => setHowToPlayOpen(true)}
            isDesktop={isDesktop}
          />

          <RecentlyPlayed
            loggedIn={loggedIn}
            recentPlayers={recentPlayers}
            invitePlayer={invitePlayer}
          />
        </main>

        {/* Right sidebar — CSS hides on mobile */}
        <DesktopSidebar
          requestLeaderboard={requestLeaderboard}
          requestMyStats={requestMyStats}
          loggedIn={loggedIn}
          setScreen={setScreen}
        />
      </div>

      {/* Fixed mobile bottom nav */}
      <MobileBottomNav
        activeTab={profileOpen ? 'profile' : 'home'}
        onTab={(tab) => {
          if (tab === 'home') {
            setProfileOpen(false);
          } else if (tab === 'history') {
            setScreen('history');
          } else if (tab === 'stats') {
            setScreen('stats');
          } else if (tab === 'profile') {
            setProfileOpen(true);
          }
        }}
      />

      {/* Overlays */}
      {profileOpen && (
        <ProfilePanel
          account={account}
          loggedIn={loggedIn}
          editingName={editingName}
          editNameValue={editNameValue}
          editNameBusy={editNameBusy}
          editNameError={editNameError}
          editInputRef={editInputRef}
          blockedOpen={blockedOpen}
          blockedUsers={blockedUsers}
          blockedLoading={blockedLoading}
          blockedError={blockedError}
          onSaveName={() => void handleSaveName()}
          onCancelEdit={cancelEditName}
          onOpenEdit={openEditName}
          onEditNameChange={setEditNameValue}
          onEditNameKeyDown={(e) => {
            if (e.key === 'Enter') void handleSaveName();
            if (e.key === 'Escape') cancelEditName();
          }}
          onBlockedToggle={() => void handleBlockedToggle()}
          onUnblock={(uid) => void handleUnblock(uid)}
          onLogout={() => logout()}
          onGoogleLogin={() => loginWithGoogle()}
          onSetScreen={setScreen}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {howToPlayOpen && <HowToPlayModal onClose={() => setHowToPlayOpen(false)} />}
    </div>
  );
}
