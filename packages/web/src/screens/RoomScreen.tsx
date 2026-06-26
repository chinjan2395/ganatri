import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import { useVoiceChatContext, useVoiceSpeaking } from '../state/VoiceChatProvider';
import logo from '../assets/ganatri-logo.png';
import type { CoPlayerView } from '../protocol';
import type { AccountInfo } from '../state/GameProvider';
import './RoomScreen.css';

// ---------------------------------------------------------------------------
// Hook: useIsDesktop
// ---------------------------------------------------------------------------

function useIsDesktop(): boolean {
  const [v, setV] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const handler = (e: MediaQueryListEvent): void => setV(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return v;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityEntry = { time: string; text: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function DetailIcon({ name }: { name: 'code' | 'mode' | 'players' | 'fee' | 'voice' }): React.ReactNode {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const };
  switch (name) {
    case 'code':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'mode':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'players':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 19c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M16 14.5c2.2.4 4 1.8 4 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'fee':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 7.5v9M9.5 10.5h4.5a2 2 0 1 0 0-1H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'voice':
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
  }
}

function CopyIcon({ size = 14 }: { size?: number }): React.ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon({ size = 14 }: { size?: number }): React.ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.12 1.12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.12-1.12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicIcon({ muted, size = 18 }: { muted?: boolean; size?: number }): React.ReactNode {
  if (muted) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="9" y="4" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 5l14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="4" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlayerPipIcon(): React.ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="currentColor" />
      <circle cx="12" cy="12" r="5.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <path d="M12 7v10M9 10h6" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PlayerBadgeIcon(): React.ReactNode {
  return (
    <span className="room__player-badge-icon">
      <DetailIcon name="players" />
    </span>
  );
}

function UserSilhouetteIcon(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="3.5" fill="currentColor" opacity="0.35" />
      <path d="M6 19c0-3 2.7-5 6-5s6 2 6 5" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: PlayerStatusBar
// ---------------------------------------------------------------------------

interface PlayerStatusBarProps {
  playerCount: number;
  maxPlayers?: number;
  elapsedSeconds: number;
}

function PlayerStatusBar({
  playerCount,
  maxPlayers = 4,
  elapsedSeconds,
}: PlayerStatusBarProps): React.ReactNode {
  const fillPct = Math.round((playerCount / maxPlayers) * 100);
  const isReady = playerCount >= 2;
  const isFull = playerCount === maxPlayers;

  return (
    <div className="room__status-bar">
      {/* ── Seats column ── */}
      <div className="room__statusbar-col">
        <span className="room__statusbar-eyebrow">SEATS</span>
        <div className="room__statusbar-fraction" aria-label={`${playerCount} of ${maxPlayers} seats filled`}>
          <span className="room__statusbar-num">{playerCount}</span>
          <span className="room__statusbar-denom">/{maxPlayers}</span>
        </div>
        <div className="room__pips" role="list" aria-label={`${playerCount} of ${maxPlayers} players joined`}>
          {Array.from({ length: maxPlayers }, (_, i) => (
            <span key={i} role="listitem" className={`room__pip${i < playerCount ? ' room__pip--filled' : ''}`}>
              {i < playerCount ? <PlayerPipIcon /> : null}
            </span>
          ))}
        </div>
        <div className="room__statusbar-fillbar" aria-hidden="true">
          <div
            className={`room__statusbar-fill${isFull ? ' room__statusbar-fill--full' : ''}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* ── Vertical divider ── */}
      <div className="room__statusbar-vline" aria-hidden="true" />

      {/* ── Timer column ── */}
      <div className="room__statusbar-col room__statusbar-col--timer">
        <span className="room__statusbar-eyebrow">IN LOBBY</span>
        <span className="room__statusbar-clock">{formatElapsed(elapsedSeconds)}</span>
        <span className="room__statusbar-clock-label">elapsed</span>
      </div>

      {/* ── Status strip (spans full width) ── */}
      <div className={`room__statusbar-footer${isFull ? ' room__statusbar-footer--full' : isReady ? ' room__statusbar-footer--ready' : ''}`}>
        <span className="room__statusbar-footer-dot" aria-hidden="true" />
        {isFull
          ? 'ROOM FULL — READY TO START'
          : isReady
            ? 'READY TO START'
            : `WAITING FOR PLAYERS · ${playerCount}/${maxPlayers}`}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RoomFeltBackdrop (CSS felt + SVG crest watermark)
// ---------------------------------------------------------------------------

function RoomFeltBackdrop(): React.ReactNode {
  return (
    <div className="room__felt-backdrop" aria-hidden="true">
      <svg className="room__felt-crest" viewBox="0 0 240 280" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M68 178c-18-28-8-62 14-78 8-6 16-4 22 2M172 178c18-28 8-62-14-78-8-6-16-4-22 2"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M82 168c-6-18 2-36 16-46M158 168c6-18-2-36-16-46"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle cx="120" cy="158" r="54" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="120" cy="158" r="46" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        <path
          d="M120 118c-16.5 0-30 12.2-30 27.4 0 11.8 9.5 18.8 19 21.2-7.2 9.6-12 16.8-12 16.8h46s-4.8-7.2-12-16.8c9.5-2.4 19-9.4 19-21.2 0-15.2-13.5-27.4-30-27.4z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M92 76h56l-10 18-12-14-10 16-10-16-12 14z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M98 76V68h8v8M134 76V68h8v8M116 68v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path
          d="M120 52v10M108 58l4 8M132 58l-4 8"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.65"
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: SeatSlot
// ---------------------------------------------------------------------------

interface SeatSlotProps {
  pid: string | null;
  seatIndex: number;
  playerId: string;
  hostId: string;
  playerNames: Record<string, string>;
  playerAvatarUrls: Readonly<Record<string, string | null>>;
  account: AccountInfo | null;
  isMySeat: boolean;
}

function SeatSlot({
  pid,
  seatIndex,
  playerId,
  hostId,
  playerNames,
  playerAvatarUrls,
  account,
  isMySeat,
}: SeatSlotProps): React.ReactNode {
  const speaking = useVoiceSpeaking();
  const isSpeaking = pid ? speaking.has(pid) : false;

  const nameFor = (p: string): string => {
    if (p === playerId && account?.loggedIn && account.displayName) return account.displayName;
    return playerNames[p] ?? p.slice(0, 6);
  };

  const avatarUrl = pid
    ? pid === playerId
      ? (account?.avatarUrl ?? null)
      : (playerAvatarUrls[pid] ?? null)
    : null;

  return (
    <div className={`room__seat room__seat--${seatIndex}`}>
      <AnimatePresence mode="wait">
        {pid ? (
          <motion.div
            key={pid}
            className="room__seat-slot"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            {pid === hostId && (
              <span className="room__seat-crown" aria-label="host">
                ♛
              </span>
            )}
            <div
              className={`room__seat-circle room__seat-circle--occupied${isMySeat ? ' room__seat-circle--you' : ''}${isSpeaking ? ' room__seat-circle--speaking' : ''}`}
            >
              {avatarUrl ? (
                <img
                  className="room__seat-avatar-img"
                  src={avatarUrl}
                  alt={nameFor(pid)}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="room__seat-initials">{getInitials(nameFor(pid))}</span>
              )}
            </div>
            <span className="room__seat-name">{nameFor(pid)}</span>
            {isMySeat && <span className="room__seat-you-badge">YOU</span>}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="room__seat-slot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="room__seat-circle room__seat-circle--empty">
              <span className="room__seat-icon" aria-hidden="true">
                <UserSilhouetteIcon />
              </span>
            </div>
            <span className="room__seat-waiting-label">
              Waiting for
              <br />
              player...
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: OvalTable
// ---------------------------------------------------------------------------

interface OvalTableProps {
  seats: Array<string | null>;
  playerId: string;
  hostId: string;
  playerNames: Record<string, string>;
  playerAvatarUrls: Readonly<Record<string, string | null>>;
  account: AccountInfo | null;
}

function OvalTable({
  seats,
  playerId,
  hostId,
  playerNames,
  playerAvatarUrls,
  account,
}: OvalTableProps): React.ReactNode {
  return (
    <div className="room__table-area">
      <div className="room__oval">
        <div className="room__oval-rail" aria-hidden="true">
          <div className="room__oval-felt">
            <span className="room__oval-mark">♠</span>
          </div>
          <span className="room__rail-light room__rail-light--tl" />
          <span className="room__rail-light room__rail-light--tr" />
          <span className="room__rail-light room__rail-light--bl" />
          <span className="room__rail-light room__rail-light--br" />
        </div>
        <span className="room__dealer-chip" aria-label="Dealer">D</span>
        {seats.map((pid, i) => (
          <SeatSlot
            key={i}
            pid={pid}
            seatIndex={i}
            playerId={playerId}
            hostId={hostId}
            playerNames={playerNames}
            playerAvatarUrls={playerAvatarUrls}
            account={account}
            isMySeat={pid === playerId}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: VoiceChatPanel
// ---------------------------------------------------------------------------

interface VoiceState {
  muted: boolean;
  deafened: boolean;
  mode: 'open' | 'ptt';
  pttActive: boolean;
  permissionDenied: boolean;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleMode: () => void;
  setPttActive: (active: boolean) => void;
}

interface VoiceChatPanelProps {
  voice: VoiceState;
  players: string[];
  playerId: string;
  playerNames: Record<string, string>;
  playerAvatarUrls: Readonly<Record<string, string | null>>;
  account: AccountInfo | null;
}

function VoiceChatPanel({
  voice,
  players,
  playerId,
  playerNames,
  playerAvatarUrls,
  account,
}: VoiceChatPanelProps): React.ReactNode {
  const speakingSet = useVoiceSpeaking();

  if (voice.permissionDenied) {
    return (
      <div className="room__voice-section">
        <div className="room__voice-denied">🎤 Microphone blocked — voice chat unavailable</div>
      </div>
    );
  }

  function handlePttDown(): void   { if (voice.mode === 'ptt') voice.setPttActive(true); }
  function handlePttUp(): void     { if (voice.mode === 'ptt') voice.setPttActive(false); }
  function handleMicClick(): void  { if (voice.mode === 'open') voice.toggleMute(); }
  function handleTouchStart(e: React.TouchEvent<HTMLButtonElement>): void {
    if (voice.mode === 'ptt') { e.preventDefault(); voice.setPttActive(true); }
  }
  function handleTouchEnd(e: React.TouchEvent<HTMLButtonElement>): void {
    if (voice.mode === 'ptt') { e.preventDefault(); voice.setPttActive(false); }
  }

  const slots: Array<string | null> = [...players, null, null, null].slice(0, 4);
  const pttHint =
    voice.mode === 'ptt'
      ? 'Hold to talk'
      : voice.muted
        ? 'Mic muted'
        : 'Open mic mode';
  const pttLabel = voice.mode === 'ptt' ? 'PTT' : voice.muted ? 'Unmute' : 'MIC';

  return (
    <div className="room__voice-section">
      <div className="room__voice-header">
        <h3 className="room__voice-title">VOICE CHAT</h3>
        <div className="room__voice-meta">
          <span className="room__voice-count">
            {players.length} participant{players.length !== 1 ? 's' : ''}
          </span>
          <span className="room__voice-status room__voice-status--enabled">
            <span className="room__voice-status-dot" aria-hidden="true" />
            Enabled
          </span>
        </div>
      </div>

      <div className="room__voice-participants-wrap">
        <div className="room__voice-participants">
          {slots.map((pid, idx) => {
            const name = pid
              ? (pid === playerId ? 'You' : (playerNames[pid] ?? pid.slice(0, 6)))
              : 'Empty';
            const av = pid
              ? (pid === playerId ? (account?.avatarUrl ?? null) : (playerAvatarUrls[pid] ?? null))
              : null;
            const speaking = pid ? speakingSet.has(pid) : false;
            const isSelf = pid === playerId;
            const micMuted = isSelf && voice.mode === 'open' && voice.muted;
            return (
              <div key={pid ?? `empty-${idx}`} className="room__voice-participant">
                <div className="room__voice-participant-avatar-wrap">
                  <div
                    className={[
                      'room__voice-participant-circle',
                      speaking ? 'room__voice-participant-circle--speaking' : '',
                      !pid ? 'room__voice-participant-circle--empty' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {av ? (
                      <img
                        src={av}
                        alt={name}
                        referrerPolicy="no-referrer"
                        className="room__voice-participant-img"
                      />
                    ) : pid ? (
                      <span className="room__voice-participant-initials">{getInitials(name)}</span>
                    ) : (
                      <UserSilhouetteIcon />
                    )}
                  </div>
                  {pid && (
                    <span
                      className={[
                        'room__voice-mic-badge',
                        speaking ? 'room__voice-mic-badge--live' : '',
                        micMuted ? 'room__voice-mic-badge--muted' : '',
                      ].filter(Boolean).join(' ')}
                      aria-hidden="true"
                    >
                      <MicIcon muted={micMuted} size={10} />
                    </span>
                  )}
                </div>
                <span
                  className={`room__voice-participant-name${!pid ? ' room__voice-participant-name--empty' : ''}`}
                >
                  {name}
                </span>
              </div>
            );
          })}
        </div>
        <span className="room__voice-participants-scroll" aria-hidden="true">
          ›
        </span>
      </div>

      <div className="room__voice-desktop-controls">
        <button
          type="button"
          className={[
            'room__voice-ptt-bar',
            voice.mode === 'ptt' && voice.pttActive ? 'room__voice-ptt-bar--active' : '',
            voice.mode === 'open' && voice.muted ? 'room__voice-ptt-bar--muted' : '',
          ].filter(Boolean).join(' ')}
          onMouseDown={handlePttDown}
          onMouseUp={handlePttUp}
          onMouseLeave={handlePttUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handlePttUp}
          onClick={handleMicClick}
          title={voice.mode === 'ptt' ? 'Hold to talk' : voice.muted ? 'Unmute' : 'Mute'}
        >
          <span className="room__voice-ptt-pill">{pttLabel}</span>
          <span className="room__voice-ptt-hint-inline">{pttHint}</span>
        </button>
        <div className="room__voice-util-row">
          <button
            type="button"
            className={`room__voice-util-btn${voice.deafened ? ' room__voice-util-btn--active' : ''}`}
            onClick={voice.toggleDeafen}
            title={voice.deafened ? 'Undeafen' : 'Deafen'}
            aria-label={voice.deafened ? 'Undeafen' : 'Deafen'}
          >
            {voice.deafened ? '🔈' : '🔊'}
          </button>
          <button
            type="button"
            className="room__voice-util-btn"
            onClick={voice.toggleMode}
            title={voice.mode === 'ptt' ? 'Switch to open mic' : 'Switch to push-to-talk'}
          >
            {voice.mode === 'ptt' ? 'Open mic' : 'PTT mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ActivityPanel
// ---------------------------------------------------------------------------

interface ActivityPanelProps {
  log: ActivityEntry[];
  activeTab: 'activity' | 'chat';
  setActiveTab: (tab: 'activity' | 'chat') => void;
}

function ActivityPanel({ log, activeTab, setActiveTab }: ActivityPanelProps): React.ReactNode {
  return (
    <div className="room__activity-panel">
      <div className="room__activity-tabs">
        <button
          className={`room__activity-tab${activeTab === 'activity' ? ' room__activity-tab--active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          ACTIVITY
        </button>
        <button
          className={`room__activity-tab${activeTab === 'chat' ? ' room__activity-tab--active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          CHAT
        </button>
      </div>
      <div className="room__activity-content">
        {activeTab === 'activity' ? (
          <ul className="room__activity-log">
            {log.map((entry, i) => (
              <li key={i} className="room__activity-entry">
                <span className="room__activity-time">{entry.time}</span>
                <span className="room__activity-entry-icon" aria-hidden="true">👤</span>
                <span className="room__activity-text">
                  {entry.text.replace(/^[👤👋]\s*/u, '')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="room__chat-empty">
            <p className="muted">No messages yet</p>
          </div>
        )}
      </div>
      <div className="room__chat-input-row">
        <button className="room__chat-emoji-btn" disabled title="Emoji coming soon">😊</button>
        <input
          className="room__chat-input"
          placeholder="Type a message..."
          readOnly
        />
        <button className="room__chat-send-btn" disabled>➤</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RoomDetailsSidebar
// ---------------------------------------------------------------------------

interface RoomDetailsSidebarProps {
  roomCode: string;
  playerCount: number;
  hostName: string;
  hostAvatarUrl: string | null;
  voiceEnabled: boolean;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
}

function RoomDetailsSidebar({
  roomCode,
  hostName,
  hostAvatarUrl,
  voiceEnabled,
  copied,
  onCopy,
  onShare,
}: RoomDetailsSidebarProps): React.ReactNode {
  return (
    <aside className="room__details-sidebar">
      <h3 className="room__details-heading">ROOM DETAILS</h3>
      <div className="room__details-rows">
        <div className="room__details-row">
          <span className="room__details-icon" aria-hidden="true">
            <DetailIcon name="code" />
          </span>
          <span className="room__details-label">Room Code</span>
          <span className="room__details-value">
            <span className="room__details-code">{roomCode}</span>
            <button
              type="button"
              className="room__details-copy-btn"
              onClick={onCopy}
              title="Copy code"
              aria-label="Copy room code"
            >
              <CopyIcon size={12} />
            </button>
          </span>
        </div>
        <div className="room__details-row">
          <span className="room__details-icon" aria-hidden="true">
            <DetailIcon name="mode" />
          </span>
          <span className="room__details-label">Game Mode</span>
          <span className="room__details-value">Classic</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-icon" aria-hidden="true">
            <DetailIcon name="players" />
          </span>
          <span className="room__details-label">Max Players</span>
          <span className="room__details-value">4 Players</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-icon" aria-hidden="true">
            <DetailIcon name="fee" />
          </span>
          <span className="room__details-label">Entry Fee</span>
          <span className="room__details-value room__details-value--free">Free</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-icon room__details-icon--host" aria-hidden="true">
            {hostAvatarUrl ? (
              <img
                className="room__details-host-avatar"
                src={hostAvatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="room__details-host-initials">
                {getInitials(hostName)}
              </span>
            )}
          </span>
          <span className="room__details-label">Host</span>
          <span className="room__details-value">{hostName}</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-icon" aria-hidden="true">
            <DetailIcon name="voice" />
          </span>
          <span className="room__details-label">Voice Chat</span>
          <span
            className={`room__details-value ${voiceEnabled ? 'room__details-value--enabled' : 'room__details-value--disabled'}`}
          >
            {voiceEnabled ? (
              <>
                <span className="room__details-voice-dot" aria-hidden="true" />
                Enabled
              </>
            ) : (
              'Disabled'
            )}
          </span>
        </div>
      </div>
      <div className="room__details-actions">
        <button type="button" className="room__details-btn room__details-btn--primary" onClick={onCopy}>
          <CopyIcon size={15} />
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
        <button type="button" className="room__details-btn room__details-btn--share" onClick={onShare}>
          <LinkIcon size={15} />
          Share Link
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: FriendsPanelSkeleton
// ---------------------------------------------------------------------------

function FriendsPanelSkeleton({ rows = 5 }: { rows?: number }): React.ReactNode {
  return (
    <div className="room__friends-skeleton-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="room__friends-skeleton-row">
          <div className="room__skeleton room__skeleton--avatar" />
          <div style={{ flex: 1 }}>
            <div className="room__skeleton" style={{ width: '70%' }} />
          </div>
          <div className="room__skeleton room__skeleton--action" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: FriendsOnlineSidebar
// ---------------------------------------------------------------------------

interface FriendsOnlineSidebarProps {
  recentPlayers: CoPlayerView[] | null;
  roomPlayerIds: string[];
  invitePlayer: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  isLoggedIn: boolean;
}

function FriendsOnlineSidebar({
  recentPlayers,
  roomPlayerIds,
  invitePlayer,
  isLoggedIn,
}: FriendsOnlineSidebarProps): React.ReactNode {
  if (!isLoggedIn) {
    return (
      <>
        <section className="room__friends-panel">
          <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
          <p className="room__friends-empty muted">Sign in to invite friends</p>
        </section>
        <section className="room__friends-panel">
          <h3 className="room__friends-heading">RECENT OPPONENTS</h3>
          <p className="room__friends-empty muted">Sign in to see recent opponents</p>
        </section>
      </>
    );
  }

  if (recentPlayers === null) {
    return (
      <>
        <section className="room__friends-panel">
          <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
          <FriendsPanelSkeleton />
        </section>
        <section className="room__friends-panel">
          <h3 className="room__friends-heading">RECENT OPPONENTS</h3>
          <FriendsPanelSkeleton />
        </section>
      </>
    );
  }
  const [states, setStates] = useState<Record<string, 'idle' | 'loading' | 'sent' | string>>(
    {},
  );

  async function handleInvite(userId: string): Promise<void> {
    setStates((prev) => ({ ...prev, [userId]: 'loading' }));
    const ack = await invitePlayer(userId);
    if (ack.ok) {
      setStates((prev) => ({ ...prev, [userId]: 'sent' }));
    } else {
      const msg =
        ack.error === 'OFFLINE'
          ? 'Offline'
          : ack.error === 'ALREADY_IN_ROOM'
            ? 'In a room'
            : ack.error === 'ALREADY_IN_GAME'
              ? 'In a game'
              : ack.error === 'BLOCKED'
                ? 'Unavailable'
                : 'Try again';
      setStates((prev) => ({ ...prev, [userId]: msg }));
    }
  }

  const onlineFriends = recentPlayers.filter(
    (p) => p.isOnline && !roomPlayerIds.includes(p.userId),
  );
  const onlineFriendIds = new Set(onlineFriends.map((p) => p.userId));
  const opponents = recentPlayers.filter(
    (p) => !roomPlayerIds.includes(p.userId) && !onlineFriendIds.has(p.userId),
  );

  function renderRow(p: CoPlayerView, showGames: boolean): React.ReactNode {
    const st = states[p.userId] ?? 'idle';
    const loading = st === 'loading';
    const sent = st === 'sent';
    const isError = st !== 'idle' && st !== 'loading' && st !== 'sent';
    return (
      <div key={p.userId} className="room__invite-row">
        {p.avatarUrl ? (
          <img
            className="room__invite-avatar"
            src={p.avatarUrl}
            alt={p.displayName}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="room__invite-initials" aria-hidden="true">
            {getInitials(p.displayName)}
          </div>
        )}
        <div className="room__invite-info">
          <span className="room__invite-name">
            {!showGames && p.isOnline && (
              <span className="room__invite-online-dot" aria-hidden="true">●</span>
            )}
            {p.displayName}
          </span>
          {showGames && (
            <span className="room__invite-sub">
              {p.gamesPlayedTogether} game{p.gamesPlayedTogether !== 1 ? 's' : ''} together
            </span>
          )}
        </div>
        {isError ? (
          <span className="room__invite-error">{st}</span>
        ) : (
          <button
            className={`room__invite-btn${sent ? ' room__invite-btn--sent' : ''}`}
            disabled={loading || sent || (!p.isOnline && !sent)}
            onClick={() => void handleInvite(p.userId)}
          >
            {loading ? (
              <span className="room__invite-spinner" aria-hidden="true" />
            ) : sent ? (
              'Invited'
            ) : (
              'Invite'
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <section className="room__friends-panel">
        <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
        {onlineFriends.length === 0 ? (
          <p className="room__friends-empty muted">No friends online</p>
        ) : (
          <div className="room__invite-list">
            {onlineFriends.map((p) => renderRow(p, false))}
          </div>
        )}
        <button className="secondary room__friends-view-all">View All Friends ›</button>
      </section>
      <section className="room__friends-panel">
        <h3 className="room__friends-heading">RECENT OPPONENTS</h3>
        {opponents.length === 0 ? (
          <p className="room__friends-empty muted">No recent opponents</p>
        ) : (
          <div className="room__invite-list">
            {opponents.slice(0, 4).map((p) => renderRow(p, true))}
          </div>
        )}
        <button className="secondary room__friends-view-all">View All ›</button>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RoomFooterDecor
// ---------------------------------------------------------------------------

function RoomFooterDecor(): React.ReactNode {
  return (
    <div className="room__footer-decor" aria-hidden="true">
      <div className="room__footer-cards">
        <span className="room__footer-card room__footer-card--hearts">A<span>♥</span></span>
        <span className="room__footer-card room__footer-card--spades">K<span>♠</span></span>
      </div>
      <div className="room__footer-chips">
        <span className="room__footer-chip room__footer-chip--red" />
        <span className="room__footer-chip room__footer-chip--blue" />
        <span className="room__footer-chip room__footer-chip--green" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RoomHeaderMobile
// ---------------------------------------------------------------------------

interface RoomHeaderMobileProps {
  onBack: () => void;
  roomCode: string;
  onCopy: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
  isHost: boolean;
  canStart: boolean;
  busy: boolean;
  onStart: () => void;
}

function RoomHeaderMobile({
  onBack,
  roomCode,
  onCopy,
  menuOpen,
  onMenuToggle,
  isHost,
  canStart,
  busy,
  onStart,
}: RoomHeaderMobileProps): React.ReactNode {
  return (
    <header className="room__header-mobile">
      <button
        className="room__header-back"
        onClick={onBack}
        aria-label="Leave room"
      >
        ←
      </button>
      <div className="room__header-title-wrap">
        <span className="room__header-title">Room</span>
        <span className="room__header-code">{roomCode}</span>
      </div>
      <div className="room__header-actions">
        <button
          className="room__header-icon-btn"
          onClick={onCopy}
          aria-label="Copy room code"
        >
          <CopyIcon size={16} />
        </button>
        <button
          className="room__header-icon-btn"
          onClick={onMenuToggle}
          aria-label="Menu"
        >
          ⋮
        </button>
      </div>
      {menuOpen && (
        <div className="room__header-menu">
          {isHost && canStart && (
            <button className="room__start--ready" onClick={onStart} disabled={busy}>
              ▶ Start Game
            </button>
          )}
          <button className="danger" onClick={onBack} disabled={busy}>
            Leave Room
          </button>
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RoomHeaderDesktop
// ---------------------------------------------------------------------------

function RoomHeaderDesktop({
  roomCode,
  onExit,
}: {
  roomCode: string;
  onExit: () => void;
}): React.ReactNode {
  return (
    <header className="room__header-desktop">
      <div className="room__header-left">
        <img src={logo} alt="Ganatri" className="room__header-logo" />
      </div>
      <div className="room__header-center">
        <div className="room__header-title-block">
          <span className="room__header-flourish" aria-hidden="true" />
          <h1 className="room__header-room-title">ROOM {roomCode}</h1>
          <span className="room__header-flourish room__header-flourish--right" aria-hidden="true" />
        </div>
        <span className="room__player-badge room__player-badge--header">
          <PlayerBadgeIcon />
          4 PLAYER ROOM
        </span>
      </div>
      <div className="room__header-right">
        <button
          type="button"
          className="room__header-settings-btn"
          disabled
          title="Settings coming soon"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              fill="currentColor"
            />
          </svg>
          Settings
        </button>
        <button type="button" className="room__header-exit-btn" onClick={onExit}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
              fill="currentColor"
            />
          </svg>
          Exit Room
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function RoomScreen(): React.ReactNode {
  const {
    room,
    session,
    account,
    playerNames,
    playerAvatarUrls,
    startGame,
    leaveRoom,
    recentPlayers,
    invitePlayer,
  } = useGame();
  const voice = useVoiceChatContext();
  const isDesktop = useIsDesktop();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'activity' | 'chat'>('activity');
  const [menuOpen, setMenuOpen] = useState(false);
  const prevPlayersRef = useRef<string[]>([]);

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Mount: initial activity entry
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const now = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setActivityLog([{ time: now, text: '👤 You joined the room' }]);
    prevPlayersRef.current = room?.players ?? [];
  }, []); // intentionally runs once on mount

  // Watch player list for join/leave events
  useEffect(() => {
    if (!room) return;
    const prev = prevPlayersRef.current;
    const curr = room.players;
    const joined = curr.filter(
      (id) => !prev.includes(id) && id !== session?.playerId,
    );
    const left = prev.filter((id) => !curr.includes(id));
    const now = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const entries: ActivityEntry[] = [
      ...joined.map((id) => ({
        time: now,
        text: `👤 ${playerNames[id] ?? 'A player'} joined the room`,
      })),
      ...left.map((id) => ({
        time: now,
        text: `👋 ${playerNames[id] ?? 'A player'} left the room`,
      })),
    ];
    if (entries.length > 0) setActivityLog((prev) => [...prev, ...entries]);
    prevPlayersRef.current = curr;
  }, [room?.players]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room || !session) return null;

  const isHost = room.hostId === session.playerId;
  const canStart = isHost && room.players.length >= 2;
  const seats: Array<string | null> = [
    room.players[0] ?? null,
    room.players[1] ?? null,
    room.players[2] ?? null,
    room.players[3] ?? null,
  ];

  const hostName =
    room.hostId === session.playerId && account?.loggedIn && account.displayName
      ? account.displayName
      : (playerNames[room.hostId] ?? 'Unknown');

  const hostAvatarUrl =
    room.hostId === session.playerId
      ? (account?.avatarUrl ?? null)
      : (playerAvatarUrls[room.hostId] ?? null);

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

  function handleShare(): void {
    const url = `${window.location.origin}?join=${room!.roomCode}`;
    if (navigator.share) {
      void navigator.share({ url }).catch(() => undefined);
    } else {
      void navigator.clipboard.writeText(url);
    }
  }

  const sharedTableProps = {
    seats,
    playerId: session.playerId,
    hostId: room.hostId,
    playerNames,
    playerAvatarUrls,
    account,
  };

  // ── Desktop layout ──────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <div className="room__root room__root--desktop">
        <RoomFeltBackdrop />
        <div className="room__particles" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="room__particle" />
          ))}
        </div>
        <RoomHeaderDesktop roomCode={room.roomCode} onExit={() => void leaveRoom()} />
        <div className="room__desktop-body">
          {/* LEFT: Room Details */}
          <aside className="room__left-col">
            <RoomDetailsSidebar
              roomCode={room.roomCode}
              playerCount={room.players.length}
              hostName={hostName}
              hostAvatarUrl={hostAvatarUrl}
              voiceEnabled={!voice.permissionDenied}
              copied={copied}
              onCopy={handleCopy}
              onShare={handleShare}
            />
          </aside>

          {/* CENTER: table only */}
          <main className="room__center-col">
            <div className="room__center-stack">
              <div className="room__table-stage">
                <OvalTable {...sharedTableProps} />
              </div>
              {isHost && canStart && (
                <button
                  className="room__start-btn room__start--ready"
                  onClick={() => void handleStart()}
                  disabled={busy}
                >
                  Start Game
                </button>
              )}
              {err && <div className="room__error">{err}</div>}
            </div>
          </main>

          {/* RIGHT: Friends Online + Recent Opponents (always shown) */}
          <aside className="room__right-col">
            <FriendsOnlineSidebar
              recentPlayers={recentPlayers}
              roomPlayerIds={room.players}
              invitePlayer={invitePlayer}
              isLoggedIn={account?.loggedIn ?? false}
            />
          </aside>

          <div className="room__lower-panels">
            <ActivityPanel
              log={activityLog}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
            <section className="room__status-panel room__status-panel--lower">
              <h3 className="room__friends-heading">PLAYERS</h3>
              <PlayerStatusBar playerCount={room.players.length} elapsedSeconds={elapsed} />
            </section>
            <VoiceChatPanel
              voice={voice}
              players={room.players}
              playerId={session.playerId}
              playerNames={playerNames}
              playerAvatarUrls={playerAvatarUrls}
              account={account}
            />
          </div>
        </div>
        <footer className="room__footer-bar">
          <span className="room__footer-suits room__footer-suits--red">♥ ♦</span>
          <span className="room__footer-tagline">
            Play smart. Play sharp. Win with Ganatri.
          </span>
          <span className="room__footer-suits">♠ ♣</span>
          <RoomFooterDecor />
        </footer>
      </div>
    );
  }

  // ── Mobile layout ────────────────────────────────────────────────────────

  return (
    <div className="room__root">
      <RoomFeltBackdrop />
      <div className="room__particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="room__particle" />
        ))}
      </div>
      <RoomHeaderMobile
        onBack={() => void leaveRoom()}
        roomCode={room.roomCode}
        onCopy={handleCopy}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((o) => !o)}
        isHost={isHost}
        canStart={canStart}
        busy={busy}
        onStart={() => void handleStart()}
      />
      <div className="room__mobile-body">
        <img src={logo} alt="Ganatri" className="room__logo-mobile" />
        <div className="room__player-badge">
          <PlayerBadgeIcon />
          {room.players.length} PLAYER ROOM
        </div>
        <OvalTable {...sharedTableProps} />
        <section className="room__friends-panel room__status-panel">
          <h3 className="room__friends-heading">PLAYERS</h3>
          <PlayerStatusBar playerCount={room.players.length} elapsedSeconds={elapsed} />
        </section>
        {isHost && canStart && (
          <button
            className="room__start-btn room__start--ready"
            onClick={() => void handleStart()}
            disabled={busy}
          >
            Start Game
          </button>
        )}
        <VoiceChatPanel
          voice={voice}
          players={room.players}
          playerId={session.playerId}
          playerNames={playerNames}
          playerAvatarUrls={playerAvatarUrls}
          account={account}
        />
        <div className="room__action-row">
          <button type="button" className="room__action-btn">
            <DetailIcon name="players" />
            Invite Friends
          </button>
          <button type="button" className="room__action-btn" onClick={handleShare}>
            <LinkIcon size={14} />
            Share Link
          </button>
        </div>
        {err && <div className="room__error">{err}</div>}
        <button
          className="danger room__leave-btn"
          onClick={() => void leaveRoom()}
          disabled={busy}
        >
          Leave Room
        </button>
        {isHost && (
          <p className="room__host-footer muted">♛ You are the host</p>
        )}
      </div>
    </div>
  );
}
