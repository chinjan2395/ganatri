import { createContext, useContext } from 'react';
import { useGame } from './GameProvider';
import { useVoiceChat, type VoiceChatState } from '../hooks/useVoiceChat';
import '../components/VoicePttFab.css';

const VoiceChatContext = createContext<VoiceChatState | null>(null);

function VoicePttFab({ state }: { state: VoiceChatState }) {
  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    state.setPttActive(true);
  }
  function onTouchEnd(e: React.TouchEvent) {
    e.preventDefault();
    state.setPttActive(false);
  }

  return (
    <button
      className={`voice-ptt-fab${state.pttActive ? ' voice-ptt-fab--active' : ''}`}
      onMouseDown={() => state.setPttActive(true)}
      onMouseUp={() => state.setPttActive(false)}
      onMouseLeave={() => state.setPttActive(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => state.setPttActive(false)}
      aria-label={state.pttActive ? 'Talking' : 'Hold to talk'}
    >
      <span className="voice-ptt-fab__icon">{state.pttActive ? '🎙️' : '🔇'}</span>
      <span className="voice-ptt-fab__label">{state.pttActive ? 'talking' : 'hold to talk'}</span>
    </button>
  );
}

export function VoiceChatProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const { session, room } = useGame();

  const players = room?.players ?? [];
  const myId = session?.playerId ?? null;

  const state = useVoiceChat(myId, players);

  // Show the FAB only when in a room and using PTT mode.
  const showFab = !!room && !state.permissionDenied && state.mode === 'ptt';

  return (
    <VoiceChatContext.Provider value={state}>
      {children}
      {showFab && <VoicePttFab state={state} />}
    </VoiceChatContext.Provider>
  );
}

export function useVoiceChatContext(): VoiceChatState {
  const ctx = useContext(VoiceChatContext);
  if (!ctx) throw new Error('useVoiceChatContext must be used inside VoiceChatProvider');
  return ctx;
}
