import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import logo from '../assets/ganatri-logo.png';
import './LobbyScreen.css';

export function LobbyScreen(): React.ReactNode {
  const { createRoom, joinRoom } = useGame();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // ALREADY_IN_GAME -> offer rejoin to the existing room.
  const [rejoin, setRejoin] = useState<string | null>(null);

  async function handleCreate(): Promise<void> {
    setBusy(true);
    setLocalError(null);
    const ack = await createRoom();
    setBusy(false);
    if (ack.ok) return; // room_update will move us forward
    if (ack.error === 'ALREADY_IN_GAME' && ack.currentRoomCode) {
      setRejoin(ack.currentRoomCode);
    } else {
      setLocalError('Could not create room.');
    }
  }

  async function handleJoin(roomCode: string): Promise<void> {
    setBusy(true);
    setLocalError(null);
    const ack = await joinRoom(roomCode.trim().toUpperCase());
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
      </motion.div>
    </div>
  );
}
