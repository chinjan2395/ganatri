// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cardId, type CardId, type Card as CardModel, type GameEvent, type Phase } from '@ganatri/engine';
import { DsSpinner, DsBadge, DsButton, GameTable, DsCard, VoiceChatPanel, DsEmptyState } from '@ganatri/ds';
import type { VoiceParticipant } from '@ganatri/ds';
import { useGame, useGameView, useGameRoom, useGameSession } from '../state/GameProvider';
import { useVoiceChatContext, useVoiceSpeaking } from '../state/VoiceChatProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { OpponentSeat } from '../components/OpponentSeat';
import { Part1Board, type Part1SelectionState } from '../components/Part1Board';
import { Part2Board, type Part2SelectionState } from '../components/Part2Board';
import { Hand } from '../components/Hand';
import { CapturedPile } from '../components/CapturedPile';
import { EndScreen } from '../components/EndScreen';
import { TurnTimer } from '../components/TurnTimer';
import { CutAnimation } from '../components/CutAnimation';
import './GameScreen.css';

function shortId(id: string): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Stable per-player hue so each avatar gets its own colour (mirrors OpponentSeat's hueFor). */
function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/**
 * Returns ALL players in turn order, cyclically rotated so that `you` lands at
 * the centre index (`Math.floor(n/2)`) while preserving the seating order
 * around them. Renders left→right as a single floating-avatar row.
 */
function orderedPlayers(seating: readonly string[], you: string): string[] {
  const n = seating.length;
  if (n === 0) return [];
  const yi = seating.indexOf(you);
  if (yi < 0) return [...seating];
  const center = Math.floor(n / 2);
  const result: string[] = [];
  for (let k = 0; k < n; k++) {
    const pid = seating[(yi - center + k + n) % n];
    if (pid !== undefined) result.push(pid);
  }
  return result;
}

type Flash = { kind: 'cut' | 'won' | 'safe'; text: string };

function flashFor(event: GameEvent, nameFor: (pid: string) => string): Flash | null {
  switch (event.type) {
    case 'TRICK_WON':
      return { kind: 'won', text: `${nameFor(event.winner)} wins the trick` };
    case 'PLAYER_SAFE':
      return { kind: 'safe', text: `${nameFor(event.player)} is safe` };
    default:
      return null;
  }
}

type CutAnimData = {
  pickerName: string;
  pickedUpCount: number;
  playerIndex: number;
  isYou: boolean;
};

// Tiny wrapper that subscribes ONLY to the fast-updating speaking context so
// GameScreen itself doesn't re-render whenever a player starts or stops talking.
function PlayerWrap({ pid, children }: { pid: string; children: React.ReactNode }): React.ReactNode {
  const speaking = useVoiceSpeaking();
  return (
    <div className={`game__player-wrap${speaking.has(pid) ? ' game__player-wrap--speaking' : ''}`}>
      {children}
    </div>
  );
}

interface GameVoicePanelProps {
  seating: readonly string[];
  you: string;
  playerNames: Readonly<Record<string, string>>;
  playerAvatarUrls: Readonly<Record<string, string | null>>;
  account: { loggedIn: boolean; displayName?: string; avatarUrl?: string } | null;
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

// Isolated so subscribing to fast-updating speaking state doesn't re-render
// all of GameScreen — mirrors the PlayerWrap isolation pattern above.
function GameVoicePanel({
  seating,
  you,
  playerNames,
  playerAvatarUrls,
  account,
  mode,
  muted,
  deafened,
  pttActive,
  permissionDenied,
  onToggleMute,
  onToggleDeafen,
  onToggleMode,
  onPttDown,
  onPttUp,
}: GameVoicePanelProps): React.ReactNode {
  const speakingSet = useVoiceSpeaking();

  const voiceParticipants: VoiceParticipant[] = seating.map((pid) => {
    const isSelf = pid === you;
    const name = isSelf && account?.loggedIn && account.displayName ? account.displayName : (playerNames[pid] ?? pid.slice(0, 6));
    const avatarUrl = isSelf ? (account?.avatarUrl ?? null) : (playerAvatarUrls[pid] ?? null);
    return {
      initials: getInitials(name),
      name: isSelf ? 'You' : name,
      isSelf,
      isSpeaking: speakingSet.has(pid),
      isMuted: isSelf && mode === 'open' && muted,
      avatarUrl,
    };
  });

  return (
    <VoiceChatPanel
      participants={voiceParticipants}
      mode={mode}
      muted={muted}
      deafened={deafened}
      pttActive={pttActive}
      permissionDenied={permissionDenied}
      onToggleMute={onToggleMute}
      onToggleDeafen={onToggleDeafen}
      onToggleMode={onToggleMode}
      onPttDown={onPttDown}
      onPttUp={onPttUp}
    />
  );
}

type HandState = Part1SelectionState | Part2SelectionState;

const DEFAULT_HAND_STATE: HandState = {
  selectedId: null,
  legalIds: null,
  canAct: false,
  onSelect: () => undefined,
  hint: '',
  action: null,
  highlightedIds: new Set(),
};

export function GameScreen(): React.ReactNode {
  const { view, turnStartedAt, turnTimeoutMs, lastEvent, latestMatchScoring } = useGameView();
  const { room, disconnectedPlayers, playerNames, playerAvatarUrls } = useGameRoom();
  const { session, account } = useGameSession();
  const { makeMove, startGame, leaveRoom, progression } = useGame();
  const voice = useVoiceChatContext();
  const isDesktop = useIsDesktop();
  const [flash, setFlash] = useState<Flash | null>(null);
  const [cutAnimData, setCutAnimData] = useState<CutAnimData | null>(null);
  const [timerFreezeUntil, setTimerFreezeUntil] = useState<number | undefined>();
  const [handState, setHandState] = useState<HandState>(DEFAULT_HAND_STATE);
  const [handOrder, setHandOrder] = useState<CardId[]>([]);
  const prevPhase = useRef<Phase | undefined>();
  const gameRef = useRef<HTMLDivElement>(null);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  // Stable ref so the lastEvent effect can read the current view without depending on it.
  const viewRef = useRef(view);
  viewRef.current = view;

  // Patch the local player's entry so all display-name consumers use one consistent value.
  const resolvedPlayerNames = useMemo(() => {
    if (session?.playerId && account?.loggedIn && account.displayName) {
      return { ...playerNames, [session.playerId]: account.displayName };
    }
    return playerNames;
  }, [playerNames, session?.playerId, account]);

  // Memoize per-player seat data so OpponentSeat (wrapped with React.memo) can
  // bail out when only unrelated state (e.g. voice, hand state) changes.
  const playerSeatData = useMemo(() => {
    if (!view) return [];
    const ordered = orderedPlayers(view.seating, view.you);
    return ordered.map((pid) => {
      const safeIndex = view.safeOrder?.indexOf(pid) ?? -1;
      const isYou = pid === view.you;
      return {
        pid,
        isYou,
        handCount: isYou ? (view.handCounts[pid] ?? view.hand.length) : (view.handCounts[pid] ?? 0),
        captureCount: view.phase === 'PART_1' ? (view.captureCounts[pid] ?? 0) : undefined,
        isTurn: view.turn === pid,
        isSafe: safeIndex >= 0,
        safeOrder: safeIndex >= 0 ? safeIndex + 1 : undefined,
        displayName: resolvedPlayerNames[pid] ?? pid,
        avatarUrl: isYou ? (account?.avatarUrl ?? null) : (playerAvatarUrls[pid] ?? null),
        isDisconnected: isYou ? false : disconnectedPlayers.has(pid),
      };
    });
  }, [view, resolvedPlayerNames, playerAvatarUrls, disconnectedPlayers, account?.avatarUrl]);

  // Combined desktop PLAYERS panel — identity (avatar/host/online) + live score
  // in one row. Score = captures (Part 1, higher is better) or safe rank (Part 2,
  // safeOrder is 1-indexed by finish order — 1 = first out = winner, so lower is
  // better; still-playing players sort last). Leader highlight only when there's
  // a clear, unambiguous top score.
  const playersPanelData = useMemo(() => {
    if (!view) return [];
    const isPart1 = view.phase === 'PART_1';
    const sorted = [...playerSeatData]
      .map((seat) => ({
        ...seat,
        score: isPart1 ? (seat.captureCount ?? 0) : (seat.safeOrder ?? 0),
      }))
      .sort((a, b) => {
        if (isPart1) return b.score - a.score;
        const aRank = a.score > 0 ? a.score : Infinity;
        const bRank = b.score > 0 ? b.score : Infinity;
        return aRank - bRank;
      });
    const top = sorted[0];
    const second = sorted[1];
    const hasLeader = top !== undefined && top.score > 0 && (second === undefined || second.score !== top.score);
    return sorted.map((entry, i) => ({ ...entry, isLeader: i === 0 && hasLeader }));
  }, [view, playerSeatData]);

  useLayoutEffect(() => {
    const el = gameRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const cap = isDesktop ? 92 : 64;
    const tableW = Math.round(Math.min(cap, Math.max(48, vw * 0.13)));
    const handW = Math.round(tableW * 1.12);
    el.style.setProperty('--card-table-w', `${tableW}px`);
    el.style.setProperty('--card-hand-w', `${handW}px`);
  }, [isDesktop]);

  useEffect(() => {
    if (!view?.phase) return;
    if (prevPhase.current !== view.phase && prevPhase.current === 'PART_1' && view.phase === 'PART_2') {
      setShowPhaseTransition(true);
      const timer = setTimeout(() => setShowPhaseTransition(false), 2500);
      return () => clearTimeout(timer);
    }
    prevPhase.current = view.phase;
  }, [view?.phase]);

  useEffect(() => {
    if (!view) return;
    const currentIds = view.hand.map((c) => cardId(c));
    setHandOrder((prev) => {
      const stillPresent = prev.filter((id) => currentIds.includes(id));
      const newIds = currentIds.filter((id) => !stillPresent.includes(id));
      return [...stillPresent, ...newIds];
    });
  }, [view]);

  useEffect(() => {
    if (!lastEvent) return;
    const name = (pid: string): string => resolvedPlayerNames[pid] || shortId(pid);

    if (lastEvent.type === 'CUT') {
      const currentView = viewRef.current;
      if (currentView) {
        const ordered = orderedPlayers(currentView.seating, currentView.you);
        setCutAnimData({
          pickerName: name(lastEvent.pickerUpper),
          pickedUpCount: lastEvent.pickedUp.length,
          playerIndex: Math.max(0, ordered.indexOf(lastEvent.pickerUpper)),
          isYou: lastEvent.pickerUpper === currentView.you,
        });
        setTimerFreezeUntil(Date.now() + 2700);
      }
      return;
    }

    const f = flashFor(lastEvent, name);
    if (!f) return;
    setFlash(f);
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [lastEvent, resolvedPlayerNames]);

  const handlePart1Change = useCallback((state: Part1SelectionState) => {
    setHandState(state);
  }, []);

  const handlePart2Change = useCallback((state: Part2SelectionState) => {
    setHandState(state);
  }, []);

  if (!view || !session) {
    return (
      <div className="center-screen">
        <DsSpinner size={40} />
        <p className="muted">Loading game…</p>
      </div>
    );
  }

  const isHost = room?.hostId === session.playerId;

  if (view.phase === 'GAME_OVER') {
    return (
      <div className="game" ref={gameRef}>
        <EndScreen
          rankings={view.rankings}
          you={view.you}
          isHost={Boolean(isHost)}
          playerNames={resolvedPlayerNames}
          account={account}
          scoring={latestMatchScoring}
          progression={progression}
          onPlayAgain={() => { void startGame(); }}
          onLeave={() => { void leaveRoom(); }}
        />
      </div>
    );
  }

  const nameFor = (pid: string): string => resolvedPlayerNames[pid] || shortId(pid);
  const legalIds = handState.legalIds as ReadonlySet<CardId> | null;
  const highlightedIds = 'highlightedIds' in handState ? handState.highlightedIds : undefined;
  const onSelectCard = (id: CardId): void => { handState.onSelect(id as never); };

  const handToRender: readonly CardModel[] = (() => {
    if (view.phase !== 'PART_2' || handOrder.length === 0) return view.hand;
    const orderedCards = handOrder
      .map((id) => view.hand.find((c) => cardId(c) === id))
      .filter(Boolean) as CardModel[];
    const orderedIds = new Set(handOrder);
    const newCards = view.hand.filter((c) => !orderedIds.has(cardId(c)));
    return [...orderedCards, ...newCards];
  })();

  if (isDesktop) {
    return (
      <div className="game game--desktop" ref={gameRef}>
        <div className="game__particles" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="game__particle" />
          ))}
        </div>

        <header className="game__hud-desktop">
          <DsBadge label={view.phase === 'PART_1' ? 'PART 1' : 'PART 2'} tone="default" />
          {turnStartedAt !== null && (
            <TurnTimer turnStartedAt={turnStartedAt} durationMs={turnTimeoutMs} freezeUntilMs={timerFreezeUntil} />
          )}
          <DsButton tone="secondary" onClick={() => { void leaveRoom(); }}>
            Leave
          </DsButton>
        </header>

        <div className="game__desktop-body">
          <aside className="game__left-col">
            <DsCard className="game__info-card" title="GAME INFO">
              <div className="game__info-rows">
                <div className="game__info-row">
                  <span className="game__info-icon" aria-hidden="true">#</span>
                  <span className="game__info-label">Room ID</span>
                  <span className="game__info-value">{room?.roomCode ?? '—'}</span>
                </div>
                <div className="game__info-row">
                  <span className="game__info-icon" aria-hidden="true">&#9656;</span>
                  <span className="game__info-label">Round</span>
                  <span className="game__info-value">
                    {view.phase === 'PART_1' ? 'Part 1 — Capture' : 'Part 2 — Cut'}
                  </span>
                </div>
              </div>
              {latestMatchScoring.length > 0 && (
                <div className="game__scoreboard game__scoreboard--desktop">
                  {latestMatchScoring.map((entry) => (
                    <DsBadge
                      key={entry.playerId}
                      label={`${entry.playerId === view.you ? 'You' : nameFor(entry.playerId)}: ${entry.matchScore}`}
                      tone="default"
                    />
                  ))}
                </div>
              )}
            </DsCard>

            <DsCard
              className="game__players-card"
              title={`PLAYERS (${playerSeatData.length}/4)`}
              subtitle={view.phase === 'PART_1' ? 'Captures' : 'Safe rank'}
            >
              <div className="game__players-list">
                {playersPanelData.map((seat, i) => (
                  <div
                    key={seat.pid}
                    className={`game__players-row${seat.isTurn ? ' game__players-row--turn' : ''}${seat.isLeader ? ' game__players-row--leader' : ''}${seat.isDisconnected ? ' game__players-row--offline' : ''}`}
                    style={{ '--player-hue': hueFor(seat.pid) } as React.CSSProperties}
                  >
                    <span className="game__players-rank">{seat.isLeader ? '👑' : i + 1}</span>
                    <span className="game__players-avatar">
                      {seat.avatarUrl ? (
                        <img src={seat.avatarUrl} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span aria-hidden="true">{getInitials(seat.displayName)}</span>
                      )}
                      {seat.isTurn && <span className="game__players-turn-dot" aria-label="Current turn" />}
                    </span>
                    <span className="game__players-info">
                      <span className="game__players-name">
                        {seat.isYou ? `${seat.displayName} (You)` : seat.displayName}
                        {room?.hostId === seat.pid && (
                          <span className="game__players-crown" aria-label="Host">&#9819;</span>
                        )}
                      </span>
                      <span
                        className={`game__players-online${seat.isDisconnected ? ' game__players-online--offline' : ''}`}
                      >
                        {seat.isDisconnected ? 'Offline' : 'Online'}
                      </span>
                    </span>
                    <span className="game__players-score">
                      {view.phase === 'PART_2' && seat.safeOrder === undefined ? '–' : seat.score}
                    </span>
                  </div>
                ))}
              </div>
            </DsCard>

            <DsCard className="game__chat-card" title="CHAT">
              <DsEmptyState className="game__chat-placeholder" message="Chat is coming soon" />
            </DsCard>
          </aside>

          <main className="game__center-col">
            <div className="game__players game__players--desktop">
              {playerSeatData.map((seat) => (
                <PlayerWrap key={seat.pid} pid={seat.pid}>
                  <OpponentSeat
                    playerId={seat.pid}
                    displayName={seat.displayName}
                    avatarUrl={seat.avatarUrl}
                    isYou={seat.isYou}
                    handCount={seat.handCount}
                    captureCount={seat.captureCount}
                    isTurn={seat.isTurn}
                    isSafe={seat.isSafe}
                    safeRank={seat.safeOrder}
                    disconnected={seat.isDisconnected}
                    compact
                  />
                </PlayerWrap>
              ))}
            </div>

            <GameTable seats={[]}>
              {view.phase === 'PART_1' ? (
                <Part1Board view={view} onMove={makeMove} onSelectionChange={handlePart1Change} />
              ) : (
                <Part2Board view={view} flash={flash} playerNames={resolvedPlayerNames} onMove={makeMove} onSelectionChange={handlePart2Change} />
              )}

              <AnimatePresence>
                {flash && (
                  <motion.div
                    key={flash.text}
                    className={`table-flash table-flash--${flash.kind}`}
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  >
                    {flash.text}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showPhaseTransition && (
                  <motion.div
                    key="phase-transition"
                    className="game__phase-transition"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  >
                    <div className="phase-transition__text">PART 2 — THE CUT</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GameTable>

            <div className="game__hand-section-desktop">
              <Hand
                hand={handToRender}
                selectedId={handState.selectedId}
                legalIds={legalIds}
                canAct={handState.canAct}
                onSelect={onSelectCard}
                onReorder={view.phase === 'PART_2' ? setHandOrder : undefined}
                highlightedIds={highlightedIds}
              />
            </div>
          </main>

          <aside className="game__right-col">
            {view.phase === 'PART_1' && (
              <DsCard className="game__deck-card" title="DECK">
                <div className="game__deck-card-body">
                  <div className="table-stock__stack" />
                  <span className="game__deck-card-count">{view.stockCount}</span>
                </div>
              </DsCard>
            )}

            {!voice.permissionDenied && (
              <GameVoicePanel
                seating={view.seating}
                you={view.you}
                playerNames={resolvedPlayerNames}
                playerAvatarUrls={playerAvatarUrls}
                account={account}
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
            )}

            <DsCard className="game__actions-card" title="ACTIONS">
              {handState.action ? (
                handState.action.stage === 'confirm-card' ? (
                  <>
                    <div className="action-bar__info">
                      <span>Play this card?</span>
                    </div>
                    <div className="action-bar__buttons">
                      <DsButton tone="secondary" onClick={handState.action.onCancel} disabled={handState.action.submitting}>
                        Cancel
                      </DsButton>
                      <DsButton onClick={handState.action.onConfirm} disabled={handState.action.submitting}>
                        {handState.action.submitting ? '…' : 'Yes, lock it in'}
                      </DsButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="action-bar__info">
                      {handState.action.hasCapture ? (
                        <>
                          <span>
                            Capture {handState.action.captureSize} card{handState.action.captureSize === 1 ? '' : 's'}
                            {handState.action.optionLabel}
                          </span>
                          {handState.action.multipleOptions && (
                            <DsButton tone="secondary" className="action-bar__cycle" onClick={handState.action.onCycle}>
                              Next option
                            </DsButton>
                          )}
                        </>
                      ) : (
                        <span className="muted">No capture — card stays on the table</span>
                      )}
                    </div>
                    <div className="action-bar__buttons">
                      <DsButton tone="secondary" onClick={handState.action.onCancel} disabled={handState.action.submitting}>
                        Cancel
                      </DsButton>
                      <DsButton onClick={handState.action.onConfirm} disabled={handState.action.submitting}>
                        {handState.action.submitting ? '…' : handState.action.hasCapture ? 'Capture' : 'Play'}
                      </DsButton>
                    </div>
                  </>
                )
              ) : (
                <div className="game__actions-card-idle">
                  <span className="muted">{handState.hint || 'Select a card to play'}</span>
                </div>
              )}
            </DsCard>
          </aside>
        </div>

        {view.phase === 'PART_1' && view.myCapturedCards.length > 0 && (
          <CapturedPile cards={view.myCapturedCards} />
        )}

        <AnimatePresence>
          {cutAnimData && (
            <CutAnimation
              key="cut-anim"
              pickerName={cutAnimData.pickerName}
              pickedUpCount={cutAnimData.pickedUpCount}
              playerIndex={cutAnimData.playerIndex}
              totalPlayers={playerSeatData.length}
              isYou={cutAnimData.isYou}
              onDone={() => setCutAnimData(null)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="game" ref={gameRef}>

      {/* ── HUD: independent floating pills ── */}
      <header className="game__hud">
        {/* Phase pill */}
        <div className="hud__phase">
          <DsBadge label={view.phase === 'PART_1' ? 'PART 1' : 'PART 2'} tone="default" />
          <span className="hud__phase-name">{view.phase === 'PART_1' ? 'Capture' : 'Cut'}</span>
        </div>

        {/* Timer pill */}
        {turnStartedAt !== null && (
          <TurnTimer turnStartedAt={turnStartedAt} durationMs={turnTimeoutMs} freezeUntilMs={timerFreezeUntil} />
        )}

        {latestMatchScoring.length > 0 && (
          <div className="game__scoreboard">
            {latestMatchScoring.map((entry) => (
              <DsBadge
                key={entry.playerId}
                label={`${entry.playerId === view.you ? 'You' : nameFor(entry.playerId)}: ${entry.matchScore}`}
                tone="default"
              />
            ))}
          </div>
        )}

        {/* Voice controls */}
        {!voice.permissionDenied && (
          <div className="game__voice-bar">
            {/* Mic button: hold for PTT, click for open-mic mute toggle */}
            <DsButton
              tone="ghost"
              className={`game__voice-icon${voice.mode === 'open' && voice.muted ? ' game__voice-icon--off' : ''}${voice.mode === 'ptt' && voice.pttActive ? ' game__voice-icon--active' : ''}`}
              onMouseDown={() => { if (voice.mode === 'ptt') voice.setPttActive(true); }}
              onMouseUp={() => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
              onMouseLeave={() => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
              onTouchStart={(e) => { if (voice.mode === 'ptt') { e.preventDefault(); voice.setPttActive(true); } }}
              onTouchEnd={(e) => { if (voice.mode === 'ptt') { e.preventDefault(); voice.setPttActive(false); } }}
              onTouchCancel={(_e) => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
              onClick={() => { if (voice.mode === 'open') voice.toggleMute(); }}
              title={voice.mode === 'ptt' ? 'Hold to talk (Space)' : (voice.muted ? 'Unmute mic' : 'Mute mic')}
            >
              {voice.mode === 'ptt' ? (voice.pttActive ? '🎙️' : '🔇') : (voice.muted ? '🔇' : '🎙️')}
            </DsButton>
            {/* Speaker / deafen */}
            <DsButton
              tone="ghost"
              className={`game__voice-icon${voice.deafened ? ' game__voice-icon--off' : ''}`}
              onClick={voice.toggleDeafen}
              title={voice.deafened ? 'Undeafen' : 'Deafen (mute audio output)'}
            >
              {voice.deafened ? '🔈' : '🔊'}
            </DsButton>
            {/* Mode toggle */}
            <DsButton
              tone="ghost"
              className="game__voice-mode"
              onClick={voice.toggleMode}
              title="Toggle push-to-talk / open mic"
            >
              {voice.mode === 'ptt' ? 'PTT' : 'MIC'}
            </DsButton>
          </div>
        )}

        <DsButton tone="secondary" className="game__leave" onClick={() => { void leaveRoom(); }}>
          Leave
        </DsButton>
      </header>

      {/* ── Players row — all players (you centred) as floating avatars ── */}
      <div className="game__players">
        {playerSeatData.map((seat) => (
          <PlayerWrap key={seat.pid} pid={seat.pid}>
            <OpponentSeat
              playerId={seat.pid}
              displayName={seat.displayName}
              avatarUrl={seat.avatarUrl}
              isYou={seat.isYou}
              handCount={seat.handCount}
              captureCount={seat.captureCount}
              isTurn={seat.isTurn}
              isSafe={seat.isSafe}
              safeRank={seat.safeOrder}
              disconnected={seat.isDisconnected}
              compact
            />
          </PlayerWrap>
        ))}
      </div>

      {/* ── Flat playable table area ── */}
      <div className="game__board">
        {view.phase === 'PART_1' ? (
          <Part1Board view={view} onMove={makeMove} onSelectionChange={handlePart1Change} />
        ) : (
          <Part2Board view={view} flash={flash} playerNames={resolvedPlayerNames} onMove={makeMove} onSelectionChange={handlePart2Change} />
        )}

        {view.phase === 'PART_1' && view.stockCount > 0 && (
          <div className="table-stock">
            <div className="table-stock__stack" />
            <span className="table-stock__count">{view.stockCount}</span>
          </div>
        )}

        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.text}
              className={`table-flash table-flash--${flash.kind}`}
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            >
              {flash.text}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPhaseTransition && (
            <motion.div
              key="phase-transition"
              className="game__phase-transition"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            >
              <div className="phase-transition__text">PART 2 — THE CUT</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Hand section ── */}
      <div className="game__hand-section">

        <div className={`game__hand-area${view.phase === 'PART_2' ? ' game__hand-area--reorder' : ''}`}>
          <Hand
            hand={handToRender}
            selectedId={handState.selectedId}
            legalIds={legalIds}
            canAct={handState.canAct}
            onSelect={onSelectCard}
            onReorder={view.phase === 'PART_2' ? setHandOrder : undefined}
            highlightedIds={highlightedIds}
          />
        </div>
      </div>

      {/* ── Captured pile FAB (Part 1) — portaled, floats above hand ── */}
      {view.phase === 'PART_1' && view.myCapturedCards.length > 0 && (
        <CapturedPile cards={view.myCapturedCards} />
      )}

      {/* ── Full-screen CUT animation ── */}
      <AnimatePresence>
        {cutAnimData && (
          <CutAnimation
            key="cut-anim"
            pickerName={cutAnimData.pickerName}
            pickedUpCount={cutAnimData.pickedUpCount}
            playerIndex={cutAnimData.playerIndex}
            totalPlayers={playerSeatData.length}
            isYou={cutAnimData.isYou}
            onDone={() => setCutAnimData(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Action bar — fixed bottom sheet, doesn't disturb layout ── */}
      <AnimatePresence>
        {handState.action && (
          <motion.div
            className="game__action-bar"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            {handState.action.stage === 'confirm-card' ? (
              <>
                <div className="action-bar__info">
                  <span>Play this card?</span>
                </div>
                <div className="action-bar__buttons">
                  <DsButton tone="secondary" onClick={handState.action.onCancel} disabled={handState.action.submitting}>
                    Cancel
                  </DsButton>
                  <DsButton onClick={handState.action.onConfirm} disabled={handState.action.submitting}>
                    {handState.action.submitting ? '…' : 'Yes, lock it in'}
                  </DsButton>
                </div>
              </>
            ) : (
              <>
                <div className="action-bar__info">
                  {handState.action.hasCapture ? (
                    <>
                      <span>
                        Capture {handState.action.captureSize} card{handState.action.captureSize === 1 ? '' : 's'}
                        {handState.action.optionLabel}
                      </span>
                      {handState.action.multipleOptions && (
                        <DsButton tone="secondary" className="action-bar__cycle" onClick={handState.action.onCycle}>
                          Next option
                        </DsButton>
                      )}
                    </>
                  ) : (
                    <span className="muted">No capture — card stays on the table</span>
                  )}
                </div>
                <div className="action-bar__buttons">
                  <DsButton tone="secondary" onClick={handState.action.onCancel} disabled={handState.action.submitting}>
                    Cancel
                  </DsButton>
                  <DsButton onClick={handState.action.onConfirm} disabled={handState.action.submitting}>
                    {handState.action.submitting ? '…' : handState.action.hasCapture ? 'Capture' : 'Play'}
                  </DsButton>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
