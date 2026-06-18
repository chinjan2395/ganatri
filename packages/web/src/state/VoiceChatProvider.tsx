import { createContext, memo, useContext, useMemo } from 'react';
import { useGame } from './GameProvider';
import { useVoiceChat, type VoiceChatActions, type VoiceChatState } from '../hooks/useVoiceChat';
import '../components/VoicePttFab.css';

// ── Two separate contexts ──────────────────────────────────────────────────
//
// VoiceChatContext  — stable (actions + muted/deafened/mode/pttActive).
//   Only changes when the user interacts with voice controls. GameScreen and
//   other heavy consumers subscribe here and are NOT re-rendered by speaking.
//
// VoiceSpeakingContext — fast-updating (the speaking Set).
//   Updates up to ~5× per second as players start/stop talking. Only tiny
//   per-player wrapper components subscribe here.

const VoiceChatContext = createContext<VoiceChatActions | null>(null);
const VoiceSpeakingContext = createContext<ReadonlySet<string>>(new Set());

// Stable empty array avoids creating a new reference on every render when room
// is null, which would otherwise cause the peer-setup effect to re-run.
const EMPTY_PLAYERS: readonly string[] = [];

// ── VoicePttFab ─────────────────────────────────────────────────────────────

interface VoicePttFabProps {
  pttActive: boolean;
  setPttActive: (active: boolean) => void;
}

const VoicePttFab = memo(function VoicePttFab({ pttActive, setPttActive }: VoicePttFabProps) {
  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    setPttActive(true);
  }
  function onTouchEnd(e: React.TouchEvent) {
    e.preventDefault();
    setPttActive(false);
  }

  return (
    <button
      className={`voice-ptt-fab${pttActive ? ' voice-ptt-fab--active' : ''}`}
      onMouseDown={() => setPttActive(true)}
      onMouseUp={() => setPttActive(false)}
      onMouseLeave={() => setPttActive(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => setPttActive(false)}
      aria-label={pttActive ? 'Talking' : 'Hold to talk'}
    >
      <span className="voice-ptt-fab__icon">{pttActive ? '🎙️' : '🔇'}</span>
      <span className="voice-ptt-fab__label">{pttActive ? 'talking' : 'hold to talk'}</span>
    </button>
  );
});

// ── VoiceChatProvider ────────────────────────────────────────────────────────

export function VoiceChatProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const { session, room } = useGame();

  // Stable array reference — prevents the peer-setup effect from re-running
  // every render just because `room?.players ?? []` would create a new array.
  const roomPlayers = room?.players;
  const players = useMemo(() => roomPlayers ?? EMPTY_PLAYERS, [roomPlayers]);

  const myId = session?.playerId ?? null;
  // Voice is only active while the user is in a room. When `room` is null
  // (lobby / disconnected) the hook never acquires the mic or starts an
  // AudioContext, and tears everything down if the user leaves a room.
  const enabled = !!room;
  const state: VoiceChatState = useVoiceChat(myId, players, enabled);

  // Memoize the stable (action) slice of voice state. This value only changes
  // when the user actually interacts with voice controls, not on every speaking
  // update — so GameScreen (a consumer of this context) won't re-render during
  // normal voice activity.
  const stableCtx = useMemo<VoiceChatActions>(() => ({
    muted: state.muted,
    deafened: state.deafened,
    mode: state.mode,
    pttActive: state.pttActive,
    permissionDenied: state.permissionDenied,
    toggleMute: state.toggleMute,
    toggleDeafen: state.toggleDeafen,
    toggleMode: state.toggleMode,
    setPttActive: state.setPttActive,
  }), [
    state.muted, state.deafened, state.mode, state.pttActive, state.permissionDenied,
    state.toggleMute, state.toggleDeafen, state.toggleMode, state.setPttActive,
  ]);

  const showFab = !!room && !state.permissionDenied && state.mode === 'ptt';

  return (
    <VoiceChatContext.Provider value={stableCtx}>
      <VoiceSpeakingContext.Provider value={state.speaking}>
        {children}
        {showFab && (
          <VoicePttFab pttActive={state.pttActive} setPttActive={state.setPttActive} />
        )}
      </VoiceSpeakingContext.Provider>
    </VoiceChatContext.Provider>
  );
}

/** Returns the stable voice actions (muted/deafened/mode/pttActive + callbacks).
 *  Does NOT include the speaking set — use useVoiceSpeaking() for that. */
export function useVoiceChatContext(): VoiceChatActions {
  const ctx = useContext(VoiceChatContext);
  if (!ctx) throw new Error('useVoiceChatContext must be used inside VoiceChatProvider');
  return ctx;
}

/** Returns the fast-updating speaking Set. Subscribe here (not via useVoiceChatContext)
 *  to avoid re-rendering large components on every speaking-state change. */
export function useVoiceSpeaking(): ReadonlySet<string> {
  return useContext(VoiceSpeakingContext);
}
