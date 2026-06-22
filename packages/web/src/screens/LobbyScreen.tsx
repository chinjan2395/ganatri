import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import logo from '../assets/ganatri-logo.png';
import './LobbyScreen.css';

export function LobbyScreen(): React.ReactNode {
  const { createRoom, joinRoom, account, loginWithGoogle, logout, setScreen, updateDisplayName, guestName } = useGame();
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
      </motion.div>
    </div>
  );
}
