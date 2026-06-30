// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/GameProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { CoPlayerView, BlockedUserView, GetBlockedUsersAck, LeaderboardEntryView, PlayerStatsView } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import {
  DsTopNav, DsBottomNav, DsModal, DsDivider, DsField, DsButton, DsIcon,
  DsAvatar, DsCard, DsEmptyState, FeltBackdrop, FooterBar, CornerDecor,
  DsTitleBlock, DsAlert, DsBodyText, DsRankRow, DsListRow,
} from '@ganatri/ds';
import type { DsTopNavItem, DsBottomNavTab } from '@ganatri/ds';
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
    <DsCard className="lobby__create-join-card">
      {!loggedIn && (
        <DsField
          label="Your name"
          value={name}
          placeholder="Your name"
          maxLength={20}
          autoFocus
          onChange={(e) => setName(e.target.value.slice(0, 20))}
        />
      )}

      <div className="lobby__cj-split">
        <div className="lobby__cj-col">
          <DsTitleBlock size="sm" title="CREATE ROOM" />
          <DsBodyText tone="muted">Start a new game table</DsBodyText>
          <DsButton onClick={onCreate} disabled={busy}>
            <DsIcon name="plus" size={16} aria-hidden /> CREATE ROOM
          </DsButton>
        </div>

        <DsDivider orientation="vertical" />

        <div className="lobby__cj-col">
          <DsTitleBlock size="sm" title="JOIN ROOM" />
          <DsBodyText tone="muted">Join with a room code</DsBodyText>
          <form
            className="lobby__join-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) onJoin(code);
            }}
          >
            <DsField
              value={code}
              placeholder="Enter room code"
              maxLength={8}
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
            />
            <DsButton type="submit" disabled={busy || !code.trim()}>JOIN</DsButton>
          </form>
        </div>
      </div>

      <DsDivider label="OR JOIN WITH A CODE" />

      {localError && <DsAlert tone="danger" title="Error" description={localError} />}
      {loginError && <DsAlert tone="danger" title="Error" description="Google login failed, please try again." />}

      {!loggedIn && (
        <DsButton tone="secondary" onClick={onGoogleLogin} className="lobby__google-btn">
          {/* Google G SVG — keep multi-path colored SVG inline since DsIcon doesn't have it */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Log in with Google
        </DsButton>
      )}
    </DsCard>
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
      <DsButton tone="secondary" className="lobby__qa-tile" onClick={() => setScreen('leaderboard')}>
        <DsIcon name="leaderboard" size={24} aria-hidden />
        <span className="lobby__qa-label">LEADERBOARD</span>
      </DsButton>
      <DsButton tone="secondary" className="lobby__qa-tile" onClick={onInviteFriends}>
        <DsIcon name="people" size={24} aria-hidden />
        <span className="lobby__qa-label">INVITE FRIENDS</span>
      </DsButton>
      <DsButton tone="secondary" className="lobby__qa-tile" onClick={onHowToPlay}>
        <DsIcon name="settings" size={24} aria-hidden />
        <span className="lobby__qa-label">HOW TO PLAY</span>
      </DsButton>
      {isDesktop && (
        <DsButton tone="secondary" className="lobby__qa-tile lobby__qa-tile--disabled" disabled title="Coming soon">
          <DsIcon name="gift" size={24} aria-hidden />
          <span className="lobby__qa-label">DAILY BONUS</span>
          <span className="lobby__qa-sub">Coming soon</span>
        </DsButton>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RecentlyPlayed
// ---------------------------------------------------------------------------

interface RecentlyPlayedProps {
  loggedIn: boolean;
  recentPlayers: CoPlayerView[] | null;
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

  // Loading state (null = still loading)
  if (recentPlayers === null) {
    return (
      <div className="recently-played">
        <div className="rp__header-row">
          <span className="lobby__section-heading">RECENTLY PLAYED</span>
        </div>
        <ul className="rp__rows" aria-label="Recently played players">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rp__row rp__row--placeholder">
              <DsAvatar displayName=" " size={44} />
              <div className="rp__row-info">
                <div className="rp__placeholder-bar" />
                <div className="rp__placeholder-bar rp__placeholder-bar--short" />
              </div>
            </li>
          ))}
        </ul>
        <div className="rp__desktop-cards" aria-label="Recently played players">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rp__desktop-card rp__desktop-card--placeholder">
              <DsAvatar displayName=" " size={60} />
              <div className="rp__placeholder-bar" />
              <div className="rp__placeholder-bar rp__placeholder-bar--short" />
            </div>
          ))}
        </div>
      </div>
    );
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
        <ul className="rp__rows" aria-label="Recently played players">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rp__row rp__row--placeholder">
              <DsAvatar displayName=" " size={44} />
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
        <div className="rp__desktop-cards" aria-label="Recently played players">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rp__desktop-card rp__desktop-card--placeholder">
              <div className="rp__locked-overlay">
                <span className="rp__lock-icon">&#128274;</span>
                <span className="rp__lock-text">Log in to see players</span>
              </div>
              <DsAvatar displayName=" " size={60} />
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
        <DsEmptyState message="No games played yet. Create or join a room to get started!" />
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
        <DsButton
          compact
          className={`rp__invite-btn${isLoading ? ' rp__invite-btn--loading' : ''}`}
          disabled={isLoading}
          onClick={() => void handleInvite(player.userId)}
        >
          {isLoading ? '' : 'INVITE'}
        </DsButton>
        {errorMsg && <div className="rp__invite-error">{errorMsg}</div>}
      </>
    );
  }

  return (
    <div className="recently-played">
      <div className="rp__header-row">
        <span className="lobby__section-heading">RECENTLY PLAYED</span>
        {hasMore && (
          <DsButton
            tone="secondary"
            compact
            className="rp__view-all-btn"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? 'SHOW LESS' : 'VIEW ALL'}
          </DsButton>
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
              <DsAvatar
                src={player.avatarUrl}
                displayName={player.displayName}
                size={44}
                online={player.isOnline}
              />
              <div className="rp__row-info">
                <span className="rp__name">{player.displayName}</span>
                <span className={`rp__status${player.isOnline ? ' rp__status--online' : ''}`}>
                  {statusText(player)}
                </span>
              </div>
              <div className="rp__row-actions">
                {player.isOnline && (
                  <DsButton
                    compact
                    className={`rp__invite-btn${isLoading ? ' rp__invite-btn--loading' : ''}`}
                    disabled={isLoading}
                    onClick={() => void handleInvite(player.userId)}
                  >
                    {isLoading ? '' : 'INV'}
                  </DsButton>
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
            <DsAvatar
              src={player.avatarUrl}
              displayName={player.displayName}
              size={60}
              online={player.isOnline}
            />
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

  return (
    <aside className="lobby__sidebar">
      {/* Top Players section */}
      <DsCard className="sidebar__section">
        <DsTitleBlock title="TOP PLAYERS" size="sm" />
        {leaderboard === null ? (
          <div className="sidebar__skeleton-list">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="sidebar__skeleton-row">
                <span>
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
          <DsEmptyState message="No rankings yet" />
        ) : (
          <div className="sidebar__player-list">
            {leaderboard.map((entry) => (
              <DsRankRow
                key={entry.userId}
                rank={entry.rank}
                displayName={entry.displayName}
                avatarUrl={entry.avatarUrl}
                gamesWon={entry.gamesWon}
                gamesPlayed={entry.gamesPlayed}
                winRate={`${Math.round(entry.winRate * 100)}%`}
                compact
              />
            ))}
          </div>
        )}
        <DsButton
          tone="secondary"
          className="sidebar__link-btn"
          onClick={() => setScreen('leaderboard')}
        >
          VIEW FULL LEADERBOARD
        </DsButton>
      </DsCard>

      {/* Your Stats section */}
      <DsCard className="sidebar__section">
        <DsTitleBlock title="YOUR STATS" size="sm" />
        {!loggedIn ? (
          <DsEmptyState message="Log in to see your stats" />
        ) : stats === null ? (
          <div className="sidebar__skeleton-list">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sidebar__skeleton-row">
                <div className="sidebar__skeleton" style={{ width: '50%' }} />
                <div className="sidebar__skeleton" style={{ width: 32 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="sidebar__stat-list">
            <DsListRow
              title="Games Played"
              trailing={<span className="sidebar__stat-value">{stats.gamesPlayed}</span>}
            />
            <DsListRow
              title="Games Won"
              trailing={<span className="sidebar__stat-value">{stats.gamesWon}</span>}
            />
            <DsListRow
              title="Win Rate"
              trailing={<span className="sidebar__stat-value">{(stats.winRate * 100).toFixed(0)}%</span>}
            />
            <DsListRow
              title="Best Streak"
              trailing={<span className="sidebar__stat-value">{stats.longestWinStreak}</span>}
            />
          </div>
        )}
        {loggedIn && (
          <DsButton
            tone="secondary"
            className="sidebar__link-btn"
            onClick={() => setScreen('stats')}
          >
            VIEW DETAILED STATS
          </DsButton>
        )}
      </DsCard>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main: LobbyScreen
// ---------------------------------------------------------------------------

export function LobbyScreen(): React.ReactNode {
  const {
    createRoom, joinRoom, account, loginWithGoogle, logout, setScreen,
    updateDisplayName, guestName, recentPlayers, invitePlayer,
    getBlockedUsers, unblockUser, deleteAccount, downloadMyData,
    requestMyStats, requestLeaderboard, progression,
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

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Download my data state
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Overlay state
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

  async function handleDeleteAccount(): Promise<void> {
    setDeleteLoading(true);
    setDeleteError(null);
    const ack = await deleteAccount();
    setDeleteLoading(false);
    if (ack.ok) {
      setShowDeleteConfirm(false);
    } else if (ack.error === 'NOT_LOGGED_IN') {
      setDeleteError('Already logged out.');
    } else {
      setDeleteError('Server unavailable, try again.');
    }
  }

  async function handleDownloadMyData(): Promise<void> {
    setDownloadLoading(true);
    setDownloadError(null);
    try {
      const ack = await downloadMyData();
      if (!ack.ok) {
        setDownloadError('Could not export data. Please try again.');
        return;
      }
      const blob = new Blob([JSON.stringify(ack.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ganatri-my-data.json';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch {
      setDownloadError('Export failed. Please try again.');
    } finally {
      setDownloadLoading(false);
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

  const displayName = account?.displayName ?? (account?.loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const avatarInitial = displayName.charAt(0).toUpperCase();

  // Rejoin early return
  if (rejoin) {
    return (
      <div className="center-screen">
        <img src={logo} alt="Ganatri" className="lobby__logo" />
        <DsCard className="lobby__panel">
          <p>
            You already have an active game in room <strong>{rejoin}</strong>.
          </p>
          <DsButton onClick={() => void handleJoin(rejoin)} disabled={busy}>Rejoin {rejoin}</DsButton>
          <DsButton tone="secondary" onClick={() => setRejoin(null)} disabled={busy}>Back</DsButton>
        </DsCard>
      </div>
    );
  }

  // Profile modal body (inline)
  function renderProfileBody(): React.ReactNode {
    if (!loggedIn) {
      return (
        <div className="lobby__profile-body">
          <DsBodyText tone="muted">Sign in to save your stats and history.</DsBodyText>
          <DsButton tone="secondary" onClick={() => loginWithGoogle()} className="lobby__google-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Log in with Google
          </DsButton>
        </div>
      );
    }

    const xpRange = progression ? (2 * progression.level - 1) * 25 : 0;
    const xpIntoLevel = progression ? xpRange - progression.xpToNextLevel : 0;
    const xpPercent = progression ? Math.max(0, Math.min(100, (xpIntoLevel / xpRange) * 100)) : 0;

    return (
      <div className="lobby__profile-body">
        {/* Account info + name edit */}
        <div className="lobby__account-info">
          <DsAvatar
            src={avatarUrl}
            displayName={displayName}
            size={40}
          />
          {editingName ? (
            <div className="lobby__name-edit">
              <DsField
                label="Display name"
                value={editNameValue}
                maxLength={20}
                inputRef={editInputRef}
                onChange={(e) => setEditNameValue(e.target.value.slice(0, 20))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveName();
                  if (e.key === 'Escape') cancelEditName();
                }}
              />
              <div className="lobby__name-edit-actions">
                <DsButton
                  onClick={() => void handleSaveName()}
                  disabled={editNameBusy}
                >
                  Save
                </DsButton>
                <DsButton
                  tone="secondary"
                  onClick={cancelEditName}
                  disabled={editNameBusy}
                >
                  Cancel
                </DsButton>
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
              <DsButton
                tone="secondary"
                compact
                className="lobby__name-edit-btn"
                onClick={openEditName}
                title="Edit display name"
              >
                Edit
              </DsButton>
            </div>
          )}
          {progression && (
            <div className="lobby__progression">
              <div className="lobby__progression-row">
                <div className="lobby__level-badge">
                  <span className="lobby__level-label">LEVEL</span>
                  <span className="lobby__level-num">{progression.level}</span>
                </div>
                <div className="lobby__xp-block">
                  <div className="lobby__xp-bar">
                    <div
                      className="lobby__xp-bar-fill"
                      style={{ width: `${xpPercent}%` }}
                    />
                  </div>
                  <span className="lobby__xp-label">{xpIntoLevel} / {xpRange} XP</span>
                </div>
              </div>
              <p className="lobby__rating-label">Rating: {progression.rankedRating}</p>
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className="row lobby__account-actions">
          <DsButton
            tone="secondary"
            onClick={() => { setScreen('history'); setProfileOpen(false); }}
          >
            History
          </DsButton>
          <DsButton
            tone="secondary"
            onClick={() => { setScreen('stats'); setProfileOpen(false); }}
          >
            Stats
          </DsButton>
          <DsButton
            tone="secondary"
            onClick={() => { setScreen('sessions'); setProfileOpen(false); }}
          >
            Sessions
          </DsButton>
          <DsButton tone="secondary" onClick={() => logout()}>
            Log out
          </DsButton>
        </div>

        {/* Blocked users */}
        <div className="lobby__blocked-section">
          <DsButton
            tone="secondary"
            className="lobby__blocked-toggle"
            onClick={() => void handleBlockedToggle()}
          >
            Blocked Users {blockedOpen ? '▴' : '▾'}
          </DsButton>
          {blockedOpen && (
            <div className="lobby__blocked-panel">
              {blockedLoading && <DsBodyText tone="muted">Loading...</DsBodyText>}
              {blockedError && <DsBodyText tone="error">{blockedError}</DsBodyText>}
              {!blockedLoading && !blockedError && blockedUsers !== null && (
                blockedUsers.length === 0 ? (
                  <DsEmptyState message="No blocked users." />
                ) : (
                  <div className="lobby__blocked-list">
                    {blockedUsers.map((u) => (
                      <DsListRow
                        key={u.userId}
                        title={u.displayName}
                        subtitle="Blocked"
                        trailing={
                          <DsButton
                            tone="secondary"
                            compact
                            className="lobby__unblock-btn"
                            onClick={() => void handleUnblock(u.userId)}
                          >
                            Unblock
                          </DsButton>
                        }
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Download my data */}
        <div className="lobby__data-export-section">
          <DsButton
            tone="secondary"
            className="lobby__data-export-btn"
            onClick={() => void handleDownloadMyData()}
            disabled={downloadLoading}
          >
            {downloadLoading ? 'Exporting...' : 'Download My Data'}
          </DsButton>
          {downloadError && <DsBodyText tone="error">{downloadError}</DsBodyText>}
        </div>

        {/* Delete account */}
        <div className="lobby__delete-section">
          {!showDeleteConfirm ? (
            <DsButton
              tone="danger"
              compact
              className="lobby__delete-btn"
              onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
            >
              Delete account
            </DsButton>
          ) : (
            <div className="lobby__delete-confirm">
              <DsBodyText tone="muted">
                This will permanently delete your account and all your data. This cannot be undone.
              </DsBodyText>
              {deleteError && (
                <DsBodyText tone="error">{deleteError}</DsBodyText>
              )}
              <div className="lobby__delete-confirm-actions">
                <DsButton
                  tone="danger"
                  className="lobby__confirm-yes-btn"
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Yes, delete my account'}
                </DsButton>
                <DsButton
                  tone="secondary"
                  className="lobby__confirm-cancel-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteLoading}
                >
                  Cancel
                </DsButton>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="lobby__root">
      <FeltBackdrop />
      <div className="room__particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="room__particle" />
        ))}
      </div>
      {/* Desktop sticky header */}
      {isDesktop ? (
        <DsTopNav
          logo={<img src={logo} alt="Ganatri" className="lobby__header-logo" />}
          items={NAV_ITEMS}
          activeId="main"
          onNavigate={(id) => {
            if (id === 'history') setScreen('history');
            else if (id === 'stats') setScreen('stats');
            else if (id === 'leaderboard') setScreen('leaderboard');
          }}
          avatarUrl={avatarUrl}
          avatarInitial={avatarInitial}
          avatarLabel={displayName}
          onAvatarClick={() => setProfileOpen(true)}
        />
      ) : (
        <header className="lobby__mobile-header">
          <img src={logo} alt="Ganatri" className="lobby__header-logo" />
          <DsButton
            tone="ghost"
            className="lobby__mobile-avatar-btn"
            aria-label={displayName}
            onClick={() => setProfileOpen(true)}
          >
            {avatarUrl ? (
              <img
                className="lobby__mobile-avatar-img"
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="lobby__mobile-avatar-initials" aria-hidden="true">
                {avatarInitial}
              </span>
            )}
          </DsButton>
        </header>
      )}

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
      <DsBottomNav
        tabs={BOTTOM_TABS}
        activeId={profileOpen ? 'profile' : 'home'}
        onTab={(tab) => {
          if (tab === 'home') {
            setProfileOpen(false);
          } else if (tab === 'history') {
            setScreen('history');
          } else if (tab === 'stats') {
            setScreen('stats');
          } else if (tab === 'leaderboard') {
            setScreen('leaderboard');
          } else if (tab === 'profile') {
            setProfileOpen(true);
          }
        }}
      />

      {/* Profile modal */}
      {profileOpen && (
        <DsModal title="PROFILE & SETTINGS" onClose={() => setProfileOpen(false)} maxWidth="480px">
          {renderProfileBody()}
        </DsModal>
      )}

      {/* How To Play modal */}
      {howToPlayOpen && (
        <DsModal
          title="HOW TO PLAY GANATRI"
          onClose={() => setHowToPlayOpen(false)}
          footer={<DsButton onClick={() => setHowToPlayOpen(false)}>GOT IT</DsButton>}
        >
          <h3 className="lobby__modal-phase">Part 1 — Capture Phase</h3>
          <p>Each player gets 5 cards. On your turn, play one card. If table cards sum to your card&apos;s value (up to 3 cards), you capture them. Same-rank cards on the table are always captured. Draw one card from the stock after each play. When all cards are gone, Part 1 ends — your captures become your Part 2 hand.</p>

          <h3 className="lobby__modal-phase">Part 2 — Suit / Cut Phase</h3>
          <p>The first player leads any card. You must follow suit if you can. If everyone follows, the highest card of the led suit wins the trick — those cards are cancelled. If you can&apos;t follow suit, play any card as a &quot;cut&quot; — the trick ends immediately, and the holder of the highest led-suit card picks up all table cards. The cutter leads next. The last player holding cards loses!</p>
        </DsModal>
      )}
      <FooterBar />
      <CornerDecor />
    </div>
  );
}
