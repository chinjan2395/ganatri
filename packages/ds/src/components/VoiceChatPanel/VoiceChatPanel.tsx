import type { ReactNode } from 'react';
import './VoiceChatPanel.css';

export interface VoiceParticipant {
  initials: string;
  name: string;
  isSelf: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  avatarUrl?: string | null;
}

export interface VoiceChatPanelProps {
  participants: VoiceParticipant[];
  maxSlots?: number;
  mode: 'open' | 'ptt';
  muted: boolean;
  deafened: boolean;
  pttActive?: boolean;
  permissionDenied?: boolean;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onToggleMode?: () => void;
  onPttDown?: () => void;
  onPttUp?: () => void;
}

function MicIcon({ muted = false }: { muted?: boolean }): ReactNode {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="4" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {muted && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

function UserSilhouetteIcon(): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="3.5" fill="currentColor" opacity="0.35" />
      <path d="M6 19c0-3 2.7-5 6-5s6 2 6 5" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function VoiceChatPanel({
  participants,
  maxSlots = 4,
  mode,
  muted,
  deafened,
  pttActive = false,
  permissionDenied = false,
  onToggleMute,
  onToggleDeafen,
  onToggleMode,
  onPttDown,
  onPttUp,
}: VoiceChatPanelProps): ReactNode {
  if (permissionDenied) {
    return (
      <div className="room__voice-section">
        <div className="room__voice-denied">🎤 Microphone blocked — voice chat unavailable</div>
      </div>
    );
  }

  function handleTouchStart(e: React.TouchEvent<HTMLButtonElement>): void {
    if (mode === 'ptt') { e.preventDefault(); onPttDown?.(); }
  }
  function handleTouchEnd(e: React.TouchEvent<HTMLButtonElement>): void {
    if (mode === 'ptt') { e.preventDefault(); onPttUp?.(); }
  }

  const slots: (VoiceParticipant | null)[] = [
    ...participants,
    ...Array(maxSlots - participants.length).fill(null),
  ].slice(0, maxSlots);

  const pttBarClasses = [
    'room__voice-ptt-bar',
    pttActive ? 'room__voice-ptt-bar--active' : '',
    muted && mode === 'open' ? 'room__voice-ptt-bar--muted' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="room__voice-section">
      <div className="room__voice-header">
        <h3 className="room__voice-title">VOICE CHAT</h3>
        <div className="room__voice-meta">
          <span className="room__voice-count">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
          <span className="room__voice-status room__voice-status--enabled">
            <span className="room__voice-status-dot" />
            Enabled
          </span>
        </div>
      </div>

      <div className="room__voice-participants-wrap">
        <div className="room__voice-participants">
          {slots.map((p, idx) =>
            p ? (
              <div key={idx} className="room__voice-participant">
                <div className="room__voice-participant-avatar-wrap">
                  <div
                    className={[
                      'room__voice-participant-circle',
                      p.isSpeaking ? 'room__voice-participant-circle--speaking' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.name}
                        className="room__voice-participant-img"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="room__voice-participant-initials">{p.initials}</span>
                    )}
                  </div>
                  <span
                    className={[
                      'room__voice-mic-badge',
                      p.isSpeaking ? 'room__voice-mic-badge--live' : '',
                      p.isMuted ? 'room__voice-mic-badge--muted' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <MicIcon muted={p.isMuted} />
                  </span>
                </div>
                <span className="room__voice-participant-name">{p.name}</span>
              </div>
            ) : (
              <div key={`empty-${idx}`} className="room__voice-participant">
                <div className="room__voice-participant-avatar-wrap">
                  <div className="room__voice-participant-circle room__voice-participant-circle--empty">
                    <UserSilhouetteIcon />
                  </div>
                </div>
                <span className="room__voice-participant-name room__voice-participant-name--empty">
                  Empty
                </span>
              </div>
            )
          )}
        </div>
        <span className="room__voice-participants-scroll" aria-hidden="true">›</span>
      </div>

      <div className="room__voice-desktop-controls">
        <button
          type="button"
          className={pttBarClasses}
          onMouseDown={onPttDown}
          onMouseUp={onPttUp}
          onMouseLeave={onPttUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onClick={mode === 'open' ? onToggleMute : undefined}
        >
          <span className="room__voice-ptt-pill">
            {mode === 'ptt' ? 'PTT' : muted ? 'Unmute' : 'MIC'}
          </span>
          <span className="room__voice-ptt-hint-inline">
            {mode === 'ptt' ? 'Hold to talk' : muted ? 'Mic muted' : 'Open mic mode'}
          </span>
        </button>
        <div className="room__voice-util-row">
          <button
            type="button"
            className={`room__voice-util-btn${deafened ? ' room__voice-util-btn--active' : ''}`}
            onClick={onToggleDeafen}
          >
            {deafened ? '🔈' : '🔊'}
          </button>
          <button
            type="button"
            className="room__voice-util-btn"
            onClick={onToggleMode}
          >
            {mode === 'ptt' ? 'Open mic' : 'PTT mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
