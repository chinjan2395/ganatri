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
              {pid === hostId && (
                <span className="room__seat-crown" aria-label="host">
                  ♛
                </span>
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
              <span className="room__seat-icon" aria-hidden="true">👤</span>
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
        <span className="room__oval-label">GANATRI</span>
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
  variant: 'mobile' | 'desktop';
}

function VoiceChatPanel({
  voice,
  players,
  playerId,
  playerNames,
  playerAvatarUrls,
  account,
  variant,
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

  return (
    <div className="room__voice-section">
      <div className="room__voice-header">
        <span className="room__voice-title">VOICE CHAT</span>
        {variant === 'desktop' && (
          <span className="room__voice-count muted">{players.length} participant{players.length !== 1 ? 's' : ''}</span>
        )}
        <span className="room__voice-status room__voice-status--enabled">● Enabled</span>
      </div>

      {variant === 'desktop' && (
        <div className="room__voice-participants">
          {slots.map((pid, idx) => {
            const name = pid
              ? (pid === playerId ? 'You' : (playerNames[pid] ?? pid.slice(0, 6)))
              : 'Empty';
            const av = pid
              ? (pid === playerId ? (account?.avatarUrl ?? null) : (playerAvatarUrls[pid] ?? null))
              : null;
            const speaking = pid ? speakingSet.has(pid) : false;
            return (
              <div key={pid ?? `empty-${idx}`} className="room__voice-participant">
                <div className={[
                  'room__voice-participant-circle',
                  speaking ? 'room__voice-participant-circle--speaking' : '',
                  !pid ? 'room__voice-participant-circle--empty' : '',
                ].filter(Boolean).join(' ')}>
                  {av ? (
                    <img src={av} alt={name} referrerPolicy="no-referrer" className="room__voice-participant-img" />
                  ) : pid ? (
                    <span className="room__voice-participant-initials">{getInitials(name)}</span>
                  ) : (
                    <span className="room__voice-participant-initials room__voice-participant-initials--empty">—</span>
                  )}
                </div>
                <span className="room__voice-participant-name">{name}</span>
              </div>
            );
          })}
        </div>
      )}

      {variant === 'mobile' && (
        <div className="room__voice-controls">
          <button
            className={`room__voice-btn${voice.muted && voice.mode === 'open' ? ' room__voice-btn--muted' : ''}`}
            onMouseDown={handlePttDown}
            onMouseUp={handlePttUp}
            onMouseLeave={handlePttUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handlePttUp}
            onClick={handleMicClick}
            title={voice.mode === 'ptt' ? 'Hold to talk' : voice.muted ? 'Unmute' : 'Mute'}
          >
            {voice.mode === 'ptt' ? (voice.pttActive ? '🎙️' : '🔇') : (voice.muted ? '🔇' : '🎙️')}
          </button>
          <button
            className={`room__voice-btn${voice.deafened ? ' room__voice-btn--muted' : ''}`}
            onClick={voice.toggleDeafen}
            title={voice.deafened ? 'Undeafen' : 'Deafen'}
          >
            {voice.deafened ? '🔈' : '🔊'}
          </button>
          <button className="room__voice-mode-btn secondary" onClick={voice.toggleMode}>
            {voice.mode === 'ptt' ? 'PTT' : 'MIC'}
          </button>
          {voice.mode === 'ptt' && <span className="room__voice-hint muted">Hold to talk</span>}
        </div>
      )}
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
  voiceEnabled: boolean;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
}

function RoomDetailsSidebar({
  roomCode,
  hostName,
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
          <span className="room__details-label">📋 Room Code</span>
          <span className="room__details-value">
            {roomCode}
            <button
              className="room__details-copy-icon"
              onClick={onCopy}
              title="Copy code"
            >
              ⧉
            </button>
          </span>
        </div>
        <div className="room__details-row">
          <span className="room__details-label">🎮 Game Mode</span>
          <span className="room__details-value">Classic</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-label">👥 Max Players</span>
          <span className="room__details-value">4 Players</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-label">💰 Entry Fee</span>
          <span className="room__details-value room__details-value--free">Free</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-label">👑 Host</span>
          <span className="room__details-value">{hostName}</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-label">🎙️ Voice Chat</span>
          <span
            className={`room__details-value ${voiceEnabled ? 'room__details-value--enabled' : 'room__details-value--disabled'}`}
          >
            ● {voiceEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
      <div className="room__details-actions">
        <button className="room__details-btn" onClick={onCopy}>
          {copied ? '✓ Copied!' : '📋 Copy Code'}
        </button>
        <button className="secondary room__details-btn" onClick={onShare}>
          🔗 Share Link
        </button>
      </div>
    </aside>
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
      <aside className="room__right-col">
        <section className="room__friends-panel">
          <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
          <p className="room__friends-empty muted">Sign in to invite friends</p>
        </section>
        <section className="room__friends-panel">
          <h3 className="room__friends-heading">RECENT OPPONENTS</h3>
          <p className="room__friends-empty muted">Sign in to see recent opponents</p>
        </section>
      </aside>
    );
  }

  if (recentPlayers === null) {
    return (
      <aside className="room__right-col">
        <section className="room__friends-panel">
          <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
          <div className="room__skeleton-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="room__invite-row room__invite-row--skeleton">
                <div className="room__skeleton room__skeleton--avatar" />
                <div style={{ flex: 1 }}>
                  <div className="room__skeleton" style={{ width: '70%' }} />
                  <div className="room__skeleton room__skeleton--short" style={{ width: '50%', marginTop: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="room__friends-panel">
          <h3 className="room__friends-heading">RECENT OPPONENTS</h3>
          <div className="room__skeleton-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="room__invite-row room__invite-row--skeleton">
                <div className="room__skeleton room__skeleton--avatar" />
                <div style={{ flex: 1 }}>
                  <div className="room__skeleton" style={{ width: '70%' }} />
                  <div className="room__skeleton room__skeleton--short" style={{ width: '60%', marginTop: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
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
          <span className="room__invite-name">{p.displayName}</span>
          {showGames && (
            <span className="room__invite-sub">
              {p.gamesPlayedTogether} game{p.gamesPlayedTogether !== 1 ? 's' : ''} together
            </span>
          )}
          {p.isOnline && !showGames && (
            <span className="room__invite-online-dot">●</span>
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
    <aside className="room__right-col">
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
    </aside>
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
        className="room__header-back secondary"
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
          className="room__header-icon-btn secondary"
          onClick={onCopy}
          aria-label="Copy room code"
        >
          📋
        </button>
        <button
          className="room__header-icon-btn secondary"
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
        <span className="room__header-room-title">ROOM {roomCode}</span>
      </div>
      <div className="room__header-center">
        <img src={logo} alt="Ganatri" className="room__header-logo" />
      </div>
      <div className="room__header-right">
        <button
          className="secondary room__header-settings-btn"
          disabled
          title="Settings coming soon"
        >
          Settings
        </button>
        <button className="danger room__header-exit-btn" onClick={onExit}>
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
        <div className="room__particles" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="room__particle" />
          ))}
        </div>
        <RoomHeaderDesktop roomCode={room.roomCode} onExit={() => void leaveRoom()} />
        <div className="room__desktop-body">
          {/* LEFT: Room Details + Activity/Chat stacked */}
          <aside className="room__left-col">
            <RoomDetailsSidebar
              roomCode={room.roomCode}
              playerCount={room.players.length}
              hostName={hostName}
              voiceEnabled={!voice.permissionDenied}
              copied={copied}
              onCopy={handleCopy}
              onShare={handleShare}
            />
            <ActivityPanel
              log={activityLog}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          </aside>

          {/* CENTER: Logo hero + table + status card + controls */}
          <main className="room__center-col">
            <div className="room__center-hero">
              <div className="room__player-badge room__player-badge--desktop">
                👥 {room.players.length} PLAYER ROOM
              </div>
            </div>
            <div className="room__table-stage">
              <OvalTable {...sharedTableProps} />
            </div>
            <section className="room__friends-panel room__status-panel">
              <h3 className="room__friends-heading">PLAYERS</h3>
              <div className="room__status-row">
                <span className="room__player-count">
                  Players {room.players.length}/4
                </span>
                <span className="room__elapsed">{formatElapsed(elapsed)}</span>
              </div>
              <div className="room__pips">
                {Array.from({ length: 4 }, (_, i) => (
                  <span
                    key={i}
                    className={`room__pip${i < room.players.length ? ' room__pip--filled' : ''}`}
                  />
                ))}
              </div>
            </section>
            {isHost && (
              <button
                className={`room__start-btn${canStart ? ' room__start--ready' : ''}`}
                onClick={() => void handleStart()}
                disabled={!canStart || busy}
              >
                {room.players.length < 2 ? 'Waiting for players…' : 'Start Game'}
              </button>
            )}
            {!isHost && (
              <p className="muted room__wait-text">Waiting for the host to start…</p>
            )}
            {err && <div className="room__error">{err}</div>}
            <VoiceChatPanel
              voice={voice}
              players={room.players}
              playerId={session.playerId}
              playerNames={playerNames}
              playerAvatarUrls={playerAvatarUrls}
              account={account}
              variant="desktop"
            />
          </main>

          {/* RIGHT: Friends Online + Recent Opponents (always shown) */}
          <FriendsOnlineSidebar
            recentPlayers={recentPlayers}
            roomPlayerIds={room.players}
            invitePlayer={invitePlayer}
            isLoggedIn={account?.loggedIn ?? false}
          />
        </div>
        <footer className="room__footer-bar">
          <span className="room__footer-suits">♠ ♥ ♦</span>
          <span className="room__footer-tagline">
            Play smart. Play sharp. Win with Ganatri.
          </span>
          <span className="room__footer-suits">♣ ♥ ♠</span>
        </footer>
      </div>
    );
  }

  // ── Mobile layout ────────────────────────────────────────────────────────

  return (
    <div className="room__root">
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
        <div className="room__player-badge">👥 {room.players.length} PLAYER ROOM</div>
        <OvalTable {...sharedTableProps} />
        <section className="room__friends-panel room__status-panel">
          <h3 className="room__friends-heading">PLAYERS</h3>
          <div className="room__status-row">
            <span className="room__player-count">Players {room.players.length}/4</span>
            <span className="room__elapsed">{formatElapsed(elapsed)}</span>
          </div>
          <div className="room__pips">
            {Array.from({ length: 4 }, (_, i) => (
              <span
                key={i}
                className={`room__pip${i < room.players.length ? ' room__pip--filled' : ''}`}
              />
            ))}
          </div>
        </section>
        <VoiceChatPanel
          voice={voice}
          players={room.players}
          playerId={session.playerId}
          playerNames={playerNames}
          playerAvatarUrls={playerAvatarUrls}
          account={account}
          variant="mobile"
        />
        <div className="room__action-row">
          <button className="secondary room__action-btn">👥 Invite Friends</button>
          <button className="secondary room__action-btn" onClick={handleShare}>
            🔗 Share Link
          </button>
        </div>
        {!canStart && (
          <div className="room__waiting-status">
            <span>⌛</span>
            <div>
              <p className="room__waiting-text">Waiting for players to join...</p>
              <p className="room__waiting-sub muted">
                Room will auto start when minimum 2 players join.
              </p>
            </div>
          </div>
        )}
        {err && <div className="room__error">{err}</div>}
        <button
          className="danger room__leave-btn"
          onClick={() => void leaveRoom()}
          disabled={busy}
        >
          Leave Room
        </button>
        <p className="room__host-footer muted">
          {isHost ? '♛ You are the host' : 'Waiting for host to start...'}
        </p>
      </div>
    </div>
  );
}
