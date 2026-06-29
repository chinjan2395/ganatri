// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import { useState, useEffect, useRef } from 'react';
import {
  HeaderDesktop,
  HeaderMobile,
  DetailsSidebar,
  ActivityPanel,
  SocialPanel,
  VoiceChatPanel,
  OvalTable,
  StatusPanel,
  FooterBar,
  CornerDecor,
  FeltBackdrop,
  DsButton,
  DsIcon,
  DsAlert,
} from '@ganatri/ds';
import type { FriendEntry, SeatData } from '@ganatri/ds';
import { useGame } from '../state/GameProvider';
import { useVoiceChatContext, useVoiceSpeaking } from '../state/VoiceChatProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import logo from '../assets/ganatri-logo.png';
import './RoomScreen.css';

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
  const speakingSet = useVoiceSpeaking();
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
    setActivityLog([{ time: now, text: 'You joined the room' }]);
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
        text: `${playerNames[id] ?? 'A player'} joined the room`,
      })),
      ...left.map((id) => ({
        time: now,
        text: `${playerNames[id] ?? 'A player'} left the room`,
      })),
    ];
    if (entries.length > 0) setActivityLog((prev) => [...prev, ...entries]);
    prevPlayersRef.current = curr;
  }, [room?.players]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room || !session) return null;

  const isHost = room.hostId === session.playerId;
  const canStart = isHost && room.players.length >= 2;

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

  // Map seats to SeatData[]
  const seats: SeatData[] = Array.from({ length: 4 }, (_, i) => {
    const pid = room.players[i] ?? null;
    if (!pid) return { initials: '', name: '', isYou: false, isHost: false, isSpeaking: false, isEmpty: true };
    const name = pid === session.playerId && account?.loggedIn && account.displayName
      ? account.displayName
      : (playerNames[pid] ?? pid.slice(0, 6));
    const avatarUrl = pid === session.playerId ? (account?.avatarUrl ?? null) : (playerAvatarUrls[pid] ?? null);
    return {
      initials: getInitials(name),
      name,
      isYou: pid === session.playerId,
      isHost: pid === room.hostId,
      isSpeaking: speakingSet.has(pid),
      avatarUrl,
      isEmpty: false,
    };
  });

  // Map voice participants
  const voiceParticipants = room.players.map((pid) => {
    const name = pid === session.playerId ? 'You' : (playerNames[pid] ?? pid.slice(0, 6));
    const avatarUrl = pid === session.playerId ? (account?.avatarUrl ?? null) : (playerAvatarUrls[pid] ?? null);
    return {
      initials: getInitials(name),
      name,
      isSelf: pid === session.playerId,
      isSpeaking: speakingSet.has(pid),
      isMuted: pid === session.playerId && voice.mode === 'open' && voice.muted,
      avatarUrl,
    };
  });

  // Map friends panel data
  const onlineFriends: FriendEntry[] = (recentPlayers ?? [])
    .filter((p) => p.isOnline && !room.players.includes(p.userId))
    .map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl ?? null,
      gamesPlayedTogether: p.gamesPlayedTogether,
      isOnline: true,
    }));

  const recentOpponents: FriendEntry[] = (recentPlayers ?? [])
    .filter((p) => !room.players.includes(p.userId) && !onlineFriends.find((f) => f.userId === p.userId))
    .map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl ?? null,
      gamesPlayedTogether: p.gamesPlayedTogether,
      isOnline: p.isOnline,
    }));

  // Normalize activity log (strip emoji prefixes)
  const normalizedLog = activityLog.map((e) => ({
    ...e,
    text: e.text.replace(/^[👤👋]\s*/u, ''),
  }));

  // ── Desktop layout ──────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <div className="room__root room__root--desktop">
        <FeltBackdrop />
        <div className="room__particles" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="room__particle" />
          ))}
        </div>
        <HeaderDesktop
          logoSrc={logo}
          roomCode={room.roomCode}
          playerCount={room.players.length}
          maxPlayers={4}
          onExit={() => void leaveRoom()}
        />
        <div className="room__desktop-body">
          {/* LEFT: Room Details */}
          <aside className="room__left-col">
            <DetailsSidebar
              roomCode={room.roomCode}
              gameMode="Classic"
              maxPlayers={4}
              hostName={hostName}
              hostAvatarUrl={hostAvatarUrl}
              voiceEnabled={!voice.permissionDenied}
              copied={copied}
              onCopyCode={handleCopy}
              onShareLink={handleShare}
            />
          </aside>

          {/* CENTER: table only */}
          <main className="room__center-col">
            <div className="room__center-stack">
              <div className="room__table-stage">
                <OvalTable seats={seats} />
              </div>
              {isHost && canStart && (
                <DsButton
                  tone="primary"
                  className="room__start-btn room__start--ready"
                  onClick={() => void handleStart()}
                  disabled={busy}
                >
                  Start Game
                </DsButton>
              )}
              {err && <DsAlert tone="danger" title="Error" description={err} />}
            </div>
          </main>

          {/* RIGHT: Friends Online + Recent Opponents */}
          <aside className="room__right-col">
            <SocialPanel
              onlineFriends={onlineFriends}
              recentOpponents={recentOpponents}
              isLoggedIn={account?.loggedIn ?? false}
              isLoading={recentPlayers === null}
              onInvite={invitePlayer}
            />
          </aside>

          <div className="room__lower-panels">
            <ActivityPanel
              entries={normalizedLog}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <section className="room__status-panel room__status-panel--lower">
              <h3 className="room__friends-heading">PLAYERS</h3>
              <StatusPanel playerCount={room.players.length} elapsedSeconds={elapsed} />
            </section>
            <VoiceChatPanel
              participants={voiceParticipants}
              mode={voice.mode}
              muted={voice.muted}
              deafened={voice.deafened}
              pttActive={voice.pttActive}
              permissionDenied={voice.permissionDenied}
              onToggleMute={voice.toggleMute}
              onToggleDeafen={voice.toggleDeafen}
              onToggleMode={voice.toggleMode}
              onPttDown={() => voice.setPttActive(true)}
              onPttUp={() => voice.setPttActive(false)}
            />
          </div>
        </div>
        <FooterBar />
        <CornerDecor />
      </div>
    );
  }

  // ── Mobile layout ────────────────────────────────────────────────────────

  return (
    <div className="room__root">
      <FeltBackdrop />
      <div className="room__particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="room__particle" />
        ))}
      </div>
      <HeaderMobile
        roomCode={room.roomCode}
        onBack={() => void leaveRoom()}
        onCopyCode={handleCopy}
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
          <span className="room__player-badge-icon">
            <DsIcon name="people" />
          </span>
          {room.players.length} PLAYER ROOM
        </div>
        <OvalTable seats={seats} />
        <section className="room__friends-panel room__status-panel">
          <h3 className="room__friends-heading">PLAYERS</h3>
          <StatusPanel playerCount={room.players.length} elapsedSeconds={elapsed} />
        </section>
        {isHost && canStart && (
          <DsButton
            tone="primary"
            className="room__start-btn room__start--ready"
            onClick={() => void handleStart()}
            disabled={busy}
          >
            Start Game
          </DsButton>
        )}
        <VoiceChatPanel
          participants={voiceParticipants}
          mode={voice.mode}
          muted={voice.muted}
          deafened={voice.deafened}
          pttActive={voice.pttActive}
          permissionDenied={voice.permissionDenied}
          onToggleMute={voice.toggleMute}
          onToggleDeafen={voice.toggleDeafen}
          onToggleMode={voice.toggleMode}
          onPttDown={() => voice.setPttActive(true)}
          onPttUp={() => voice.setPttActive(false)}
        />
        <div className="room__action-row">
          <DsButton type="button" tone="outline" className="room__action-btn">
            <DsIcon name="people" />
            Invite Friends
          </DsButton>
          <DsButton type="button" tone="outline" className="room__action-btn" onClick={handleShare}>
            <DsIcon name="share" />
            Share Link
          </DsButton>
        </div>
        {err && <DsAlert tone="danger" title="Error" description={err} />}
        <DsButton
          tone="danger"
          className="room__leave-btn"
          onClick={() => void leaveRoom()}
          disabled={busy}
        >
          Leave Room
        </DsButton>
        {isHost && (
          <p className="room__host-footer muted">♛ You are the host</p>
        )}
        <CornerDecor />
      </div>
    </div>
  );
}
