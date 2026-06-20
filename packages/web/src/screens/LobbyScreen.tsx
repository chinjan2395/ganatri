import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import logo from '../assets/ganatri-logo.png';
import './LobbyScreen.css';

export function LobbyScreen(): React.ReactNode {
  const { createRoom, joinRoom, account, loginWithGoogle, logout, setScreen, updateDisplayName } = useGame();
  const loggedIn = account?.loggedIn ?? false;
  const [name, setName] = useState(() => (loggedIn ? account?.displayName ?? '' : ''));
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
              <span className="lobby__google-g" aria-hidden="true">G</span>
              Log in with Google
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
