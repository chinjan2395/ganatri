import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import logo from '../assets/ganatri-logo.png';
import './RoomScreen.css';

function shortId(id: string): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

export function RoomScreen(): React.ReactNode {
  const { room, session, startGame, leaveRoom } = useGame();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!room || !session) return null;

  const isHost = room.hostId === session.playerId;
  const canStart = isHost && room.players.length >= 2;

  async function handleStart(): Promise<void> {
    setBusy(true);
    setErr(null);
    const ack = await startGame();
    setBusy(false);
    if (!ack.ok) {
      setErr(ack.error === 'NOT_ENOUGH_PLAYERS' ? 'Need at least 2 players.' : 'Only the host can start.');
    }
  }

  return (
    <div className="center-screen">
      <img src={logo} alt="Ganatri" className="room__logo" />
      <h1 className="neon-title room__title">ROOM {room.roomCode}</h1>
      <p className="muted">Share this code so others can join.</p>
      <motion.div
        className="card-surface room__panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        <div className="room__players">
          {room.players.map((pid, i) => (
            <motion.div
              key={pid}
              className="room__player"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <span className="room__index">{i + 1}</span>
              <span>
                {shortId(pid)}
                {pid === session.playerId && <span className="room__you"> (you)</span>}
                {pid === room.hostId && <span className="room__host"> host</span>}
              </span>
            </motion.div>
          ))}
        </div>
        <p className="muted">{room.players.length} / 4 players</p>
        {isHost ? (
          <button onClick={() => void handleStart()} disabled={!canStart || busy}>
            {room.players.length < 2 ? 'Waiting for players…' : 'Start game'}
          </button>
        ) : (
          <p className="muted">Waiting for the host to start…</p>
        )}
        {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
        <button
          className="secondary"
          onClick={() => {
            void leaveRoom();
          }}
          disabled={busy}
        >
          Leave room
        </button>
      </motion.div>
    </div>
  );
}
