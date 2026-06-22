import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import type { CoPlayerView, BlockedUserView, GetBlockedUsersAck } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import './LobbyScreen.css';

// Error messages for invite failure codes
const INVITE_ERROR_MESSAGES: Record<string, string> = {
  OFFLINE: 'Player went offline',
  BLOCKED: 'You are blocked',
  ALREADY_IN_ROOM: 'Player is already in a room',
  ALREADY_IN_GAME: 'Game already in progress',
  UNAVAILABLE: 'Unavailable, try again',
};

interface RecentlyPlayedProps {
  loggedIn: boolean;
  recentPlayers: CoPlayerView[];
  invitePlayer: (targetUserId: string) => Promise<import('../protocol').InvitePlayerAck>;
}

function RecentlyPlayed({ loggedIn, recentPlayers, invitePlayer }: RecentlyPlayedProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  // Per-card invite state: userId -> 'idle' | 'loading' | error string
  const [inviteState, setInviteState] = useState<Record<string, string>>({});

  async function handleInvite(userId: string): Promise<void> {
    setInviteState((prev) => ({ ...prev, [userId]: 'loading' }));
    const ack = await invitePlayer(userId);
    if (ack.ok) {
      // ROOM_UPDATE push will navigate to RoomScreen automatically via App.tsx
      setInviteState((prev) => ({ ...prev, [userId]: 'idle' }));
    } else {
      const msg = INVITE_ERROR_MESSAGES[ack.error] ?? 'Unavailable, try again';
      setInviteState((prev) => ({ ...prev, [userId]: msg }));
    }
  }

  const visiblePlayers = expanded ? recentPlayers.slice(0, 10) : recentPlayers.slice(0, 5);
  const hasMore = recentPlayers.length > 5;

  if (!loggedIn) {
    return (
      <div className="recently-played">
        <h3 className="rp__heading">Recently Played</h3>
        <div className="rp__cards">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rp__card rp__card--placeholder">
              <div className="rp__locked-overlay">
                <span className="rp__lock-icon">&#128274;</span>
                <span className="rp__lock-text">Log in to see players</span>
              </div>
              <div className="rp__avatar-wrap">
                <div className="rp__avatar rp__avatar-initials" aria-hidden="true" />
              </div>
              <div className="rp__name rp__placeholder-bar" />
              <div className="rp__games-count rp__placeholder-bar rp__placeholder-bar--short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (recentPlayers.length === 0) {
    return (
      <div className="recently-played">
        <h3 className="rp__heading">Recently Played</h3>
        <p className="rp__empty">No games played yet. Create or join a room to get started!</p>
      </div>
    );
  }

  return (
    <div className="recently-played">
      <h3 className="rp__heading">Recently Played</h3>
      <div className="rp__cards">
        {visiblePlayers.map((player) => {
          const state = inviteState[player.userId] ?? 'idle';
          const isLoading = state === 'loading';
          const errorMsg = state !== 'idle' && state !== 'loading' ? state : null;

          return (
            <div key={player.userId} className="rp__card">
              <div className="rp__avatar-wrap">
                {player.avatarUrl ? (
                  <img
                    className="rp__avatar"
                    src={player.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="rp__avatar rp__avatar-initials" aria-hidden="true">
                    {player.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {player.isOnline && <span className="rp__online-dot" aria-label="Online" />}
              </div>
              <div className="rp__name">{player.displayName}</div>
              <div className="rp__games-count">{player.gamesPlayedTogether} games together</div>
              {player.isOnline && (
                <button
                  type="button"
                  className={`rp__invite-btn${isLoading ? ' rp__invite-btn--loading' : ''}`}
                  disabled={isLoading}
                  onClick={() => void handleInvite(player.userId)}
                >
                  {isLoading ? '' : 'Invite'}
                </button>
              )}
              {errorMsg && <div className="rp__invite-error">{errorMsg}</div>}
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          className="rp__see-all-btn"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : `See all (${recentPlayers.length})`}
        </button>
      )}
    </div>
  );
}

export function LobbyScreen(): React.ReactNode {
  const { createRoom, joinRoom, account, loginWithGoogle, logout, setScreen, updateDisplayName, guestName, recentPlayers, invitePlayer, getBlockedUsers, unblockUser } = useGame();
  const loggedIn = account?.loggedIn ?? false;
  const [name, setName] = useState(() => {
    if (loggedIn) return account?.displayName ?? '';
    return guestName ?? '';
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState(false);
  // ALREADY_IN_GAME -> offer rejoin to the existing room.
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
    // Focus the input after it mounts
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
      // SESSION re-emit will update account.displayName automatically
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
    <div className="center-screen">
      <motion.img
        src={logo}
        alt="Ganatri"
        className="lobby__logo"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      />
      <motion.div
        className="card-surface lobby__panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.1 }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="Your name"
          maxLength={20}
          autoFocus
          style={{ textAlign: 'center' }}
        />
        <button onClick={() => void handleCreate()} disabled={busy}>
          Create room
        </button>
        <div className="muted lobby__or">— or join with a code —</div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void handleJoin(code);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={8}
            autoCapitalize="characters"
            style={{ flex: 1, letterSpacing: '2px' }}
          />
          <button type="submit" disabled={busy || !code.trim()}>
            Join
          </button>
        </form>
        {localError && <div className="lobby__error">{localError}</div>}
        {loginError && (
          <div className="lobby__error">Google login failed, please try again.</div>
        )}

        <div className="lobby__nav">
          <button
            type="button"
            className="secondary"
            onClick={() => setScreen('leaderboard')}
          >
            Leaderboard
          </button>
        </div>

        <div className="lobby__account">
          {loggedIn ? (
            <>
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
                      onChange={(e) => setEditNameValue(e.target.value.slice(0, 20))}
                      maxLength={20}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveName();
                        if (e.key === 'Escape') cancelEditName();
                      }}
                    />
                    <div className="lobby__name-edit-actions">
                      <button
                        type="button"
                        className="lobby__name-save-btn"
                        onClick={() => void handleSaveName()}
                        disabled={editNameBusy}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="secondary lobby__name-cancel-btn"
                        onClick={cancelEditName}
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
                      onClick={openEditName}
                      title="Edit display name"
                      aria-label="Edit display name"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div className="row lobby__account-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setScreen('history')}
                >
                  History
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setScreen('stats')}
                >
                  Stats
                </button>
                <button type="button" className="secondary" onClick={() => logout()}>
                  Log out
                </button>
              </div>

              <div className="lobby__blocked-section">
                <button
                  type="button"
                  className="lobby__blocked-toggle"
                  onClick={() => void handleBlockedToggle()}
                >
                  Blocked Users {blockedOpen ? '▴' : '▾'}
                </button>
                {blockedOpen && (
                  <div className="lobby__blocked-panel">
                    {blockedLoading && (
                      <p className="lobby__blocked-empty">Loading...</p>
                    )}
                    {blockedError && (
                      <p className="lobby__blocked-error">{blockedError}</p>
                    )}
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
                                onClick={() => void handleUnblock(u.userId)}
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
            </>
          ) : (
            <button
              type="button"
              className="secondary lobby__google-btn"
              onClick={() => loginWithGoogle()}
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

        <RecentlyPlayed
          loggedIn={loggedIn}
          recentPlayers={recentPlayers}
          invitePlayer={invitePlayer}
        />
      </motion.div>
    </div>
  );
}
