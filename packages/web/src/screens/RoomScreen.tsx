import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import { useVoiceChatContext } from '../state/VoiceChatProvider';
import logo from '../assets/ganatri-logo.png';
import './RoomScreen.css';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const SUIT_COLORS = [
  'var(--text)',
  'var(--red-suit)',
  'var(--red-suit)',
  'var(--text)',
] as const;

interface SeatSlotProps {
  pid: string | null;
  seatIndex: number;
  playerId: string;
  hostId: string;
  playerNames: Record<string, string>;
  speaking: Set<string>;
}

function SeatSlot({ pid, seatIndex, playerId, hostId, playerNames, speaking }: SeatSlotProps) {
  const isSpeaking = pid ? speaking.has(pid) : false;
  return (
    <div className={`room__seat room__seat--${seatIndex}`}>
      <AnimatePresence mode="wait">
        {pid ? (
          <motion.div
            key={pid}
            className={`room__seat-card${isSpeaking ? ' room__seat-card--speaking' : ''}`}
            initial={{ x: -50, rotateZ: -6, opacity: 0 }}
            animate={{ x: 0, rotateZ: 0, opacity: 1 }}
            exit={{ x: 50, rotateZ: 6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            <span className="room__seat-suit" style={{ color: SUIT_COLORS[seatIndex] }}>
              {SUITS[seatIndex]}
            </span>
            <span className="room__seat-name">
              {playerNames[pid] ?? pid.slice(0, 6)}
            </span>
            <div className="room__seat-badges">
              {pid === playerId && <span className="room__seat-badge room__seat-you">you</span>}
              {pid === hostId && <span className="room__seat-host-crown">♛</span>}
              {isSpeaking && <span className="room__seat-mic-active" aria-label="speaking">🎙️</span>}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="room__seat-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="room__seat-pulse" />
            <span className="room__seat-waiting">Waiting…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RoomScreen(): React.ReactNode {
  const { room, session, playerNames, startGame, leaveRoom } = useGame();
  const voice = useVoiceChatContext();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!room || !session) return null;

  const isHost = room.hostId === session.playerId;
  const canStart = isHost && room.players.length >= 2;

  async function handleStart(): Promise<void> {
    setBusy(true);
    setErr(null);
    const ack = await startGame();
    setBusy(false);
    if (!ack.ok) {
      setErr(
        ack.error === 'NOT_ENOUGH_PLAYERS'
          ? 'Need at least 2 players.'
          : 'Only the host can start.',
      );
    }
  }

  function handleCopy(): void {
    void navigator.clipboard.writeText(room!.roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const seats: Array<string | null> = [
    room.players[0] ?? null,
    room.players[1] ?? null,
    room.players[2] ?? null,
    room.players[3] ?? null,
  ];

  return (
    <div className="center-screen">
      {/* Ambient floating particles */}
      <div className="room__particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="room__particle" />
        ))}
      </div>

      <img src={logo} alt="Ganatri" className="room__logo" />

      {/* Flip-tile room code */}
      <div className="room__code-row">
        <div className="room__tiles">
          {room.roomCode.split('').map((char, i) => (
            <span
              key={i}
              className="room__tile"
              style={{ '--i': i } as React.CSSProperties}
            >
              {char}
            </span>
          ))}
        </div>
        <button
          className={`secondary room__copy-btn${copied ? ' room__copy-btn--copied' : ''}`}
          onClick={handleCopy}
          title="Copy room code"
        >
          {copied ? '✓ Copied!' : 'Copy code'}
        </button>
      </div>
      <p className="muted">Share this code so others can join.</p>

      {/* Oval table with animated seats */}
      <div className="room__table-area">
        <div className="room__oval">
          <span className="room__oval-label">GANATRI</span>
        </div>
        {seats.map((pid, i) => (
          <SeatSlot
            key={i}
            pid={pid}
            seatIndex={i}
            playerId={session.playerId}
            hostId={room.hostId}
            playerNames={playerNames}
            speaking={voice.speaking}
          />
        ))}
      </div>

      {/* Progress pips */}
      <div className="room__pips">
        {Array.from({ length: 4 }, (_, i) => (
          <span
            key={i}
            className={`room__pip${i < room.players.length ? ' room__pip--filled' : ''}`}
          />
        ))}
        <span className="room__pip-label muted">{room.players.length} / 4 players</span>
      </div>

      {/* Voice chat controls */}
      {voice.permissionDenied ? (
        <div className="room__voice-denied">
          🎤 Microphone blocked — voice chat unavailable
        </div>
      ) : (
        <div className="room__voice-bar">
          <button
            className={`room__voice-btn${voice.muted && voice.mode === 'open' ? ' room__voice-btn--muted' : ''}`}
            onMouseDown={() => { if (voice.mode === 'ptt') voice.setPttActive(true); }}
            onMouseUp={() => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
            onMouseLeave={() => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
            onTouchStart={(e) => { if (voice.mode === 'ptt') { e.preventDefault(); voice.setPttActive(true); } }}
            onTouchEnd={(e) => { if (voice.mode === 'ptt') { e.preventDefault(); voice.setPttActive(false); } }}
            onTouchCancel={() => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
            onClick={() => { if (voice.mode === 'open') voice.toggleMute(); }}
            title={voice.mode === 'ptt' ? 'Hold to talk' : (voice.muted ? 'Unmute' : 'Mute')}
          >
            {voice.mode === 'ptt'
              ? (voice.pttActive ? '🎙️' : '🔇')
              : (voice.muted ? '🔇' : '🎙️')}
          </button>
          {/* Speaker / deafen */}
          <button
            className={`room__voice-btn${voice.deafened ? ' room__voice-btn--muted' : ''}`}
            onClick={voice.toggleDeafen}
            title={voice.deafened ? 'Undeafen' : 'Deafen (mute audio output)'}
          >
            {voice.deafened ? '🔈' : '🔊'}
          </button>
          <button
            className="room__voice-mode secondary"
            onClick={voice.toggleMode}
            title="Toggle push-to-talk / open mic"
          >
            {voice.mode === 'ptt' ? 'PTT' : 'MIC'}
          </button>
          {voice.mode === 'ptt' && (
            <span className="room__voice-hint muted">Hold to talk</span>
          )}
        </div>
      )}

      {isHost ? (
        <button
          className={canStart ? 'room__start--ready' : ''}
          onClick={() => void handleStart()}
          disabled={!canStart || busy}
        >
          {room.players.length < 2 ? 'Waiting for players…' : 'Start game'}
        </button>
      ) : (
        <p className="muted">Waiting for the host to start…</p>
      )}
      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
      <button
        className="secondary"
        onClick={() => { void leaveRoom(); }}
        disabled={busy}
      >
        Leave room
      </button>
    </div>
  );
}
