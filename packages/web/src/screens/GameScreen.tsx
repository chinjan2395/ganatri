import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cardId, type CardId, type Card as CardModel, type GameEvent, type Phase } from '@ganatri/engine';
import { useGame } from '../state/GameProvider';
import { useVoiceChatContext, useVoiceSpeaking } from '../state/VoiceChatProvider';
import { OpponentSeat } from '../components/OpponentSeat';
import { Part1Board, type Part1SelectionState } from '../components/Part1Board';
import { Part2Board, type Part2SelectionState } from '../components/Part2Board';
import { Hand } from '../components/Hand';
import { CapturedPile } from '../components/CapturedPile';
import { EndScreen } from '../components/EndScreen';
import { TurnTimer } from '../components/TurnTimer';
import { CutAnimation } from '../components/CutAnimation';
import { TopBar } from '../components/TopBar';
import { GameTable } from '../components/GameTable';
import { MobileLeftPanel } from '../components/MobileLeftPanel';
import { MobileRightPanel } from '../components/MobileRightPanel';
import { RightSidebar } from '../components/RightSidebar';
import { DesktopPlayerBar } from '../components/DesktopPlayerBar';
import { LeftSidebar } from '../components/LeftSidebar';
import { BottomNav } from '../components/BottomNav';
import './GameScreen.css';

const SUIT_ORDER: Record<string, number> = { C: 0, S: 1, H: 2, D: 3 };
const RANK_ORDER: Record<string, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

function shortId(id: string): string {
  return id.length <= 6 ? id : id.slice(0, 6);
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

function opponentSlots(count: number): Array<'top' | 'left' | 'right'> {
  if (count <= 0) return [];
  if (count === 1) return ['top'];
  if (count === 2) return ['left', 'right'];
  return ['left', 'top', 'right'];
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
  const { view, room, session, account, progression, latestMatchScoring, lastEvent, eventLog, disconnectedPlayers, playerNames, playerAvatarUrls, turnStartedAt, turnTimeoutMs, makeMove, startGame, leaveRoom } = useGame();
  const voice = useVoiceChatContext();
  const [flash, setFlash] = useState<Flash | null>(null);
  const [cutAnimData, setCutAnimData] = useState<CutAnimData | null>(null);
  const [timerFreezeUntil, setTimerFreezeUntil] = useState<number | undefined>();
  const [handState, setHandState] = useState<HandState>(DEFAULT_HAND_STATE);
  const [handOrder, setHandOrder] = useState<CardId[]>([]);
  const [autoArrange, setAutoArrange] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const sortCards = useCallback((cards: readonly CardModel[]): readonly CardModel[] => {
    return [...cards].sort((a, b) => {
      const sd = (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
      if (sd !== 0) return sd;
      return (RANK_ORDER[a.rank] ?? 0) - (RANK_ORDER[b.rank] ?? 0);
    });
  }, []);

  const handleSort = useCallback((): void => {
    if (!view) return;
    const sorted = sortCards(view.hand);
    setHandOrder(sorted.map(c => cardId(c)));
  }, [view, sortCards]);

  useLayoutEffect(() => {
    const el = gameRef.current;
    if (!el) return;
    const update = (): void => {
      const vw = window.innerWidth;
      const isDesktop = vw >= 768;
      const tableW = isDesktop
        ? Math.round(Math.min(78, Math.max(58, vw * 0.042)))
        : Math.round(Math.min(64, Math.max(48, vw * 0.13)));
      const handW = isDesktop
        ? Math.round(tableW * 1.28)
        : Math.round(tableW * 1.12);
      el.style.setProperty('--card-table-w', `${tableW}px`);
      el.style.setProperty('--card-hand-w', `${handW}px`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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
  }, [view?.hand]);

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

  const handToRender: readonly CardModel[] = useMemo(() => {
    if (!view) return [];
    if (view.phase !== 'PART_2' || handOrder.length === 0) return view.hand;
    const orderedCards = handOrder
      .map((id) => view.hand.find((c) => cardId(c) === id))
      .filter(Boolean) as CardModel[];
    const orderedIds = new Set(handOrder);
    const newCards = view.hand.filter((c) => !orderedIds.has(cardId(c)));
    return [...orderedCards, ...newCards];
  }, [view, handOrder]);

  const finalHand = useMemo((): readonly CardModel[] => {
    return autoArrange ? sortCards(handToRender) : handToRender;
  }, [autoArrange, handToRender, sortCards]);

  const useSuitStackedHand = Boolean(view && (view.phase === 'PART_2' || finalHand.length > 10));

  if (!view || !session) {
    return (
      <div className="center-screen">
        <div className="spinner" />
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

  const players = orderedPlayers(view.seating, view.you);
  const nameFor = (pid: string): string => resolvedPlayerNames[pid] || shortId(pid);
  const isYourTurn = view.turn === view.you;
  const turnName = view.turn ? (isYourTurn ? 'You' : nameFor(view.turn)) : '—';

  const legalIds = handState.legalIds as ReadonlySet<CardId> | null;
  const highlightedIds = 'highlightedIds' in handState ? handState.highlightedIds : undefined;
  const onSelectCard = (id: CardId): void => { handState.onSelect(id as never); };

  // Opponents: all players except you
  const opponents = players.filter(pid => pid !== view.you);
  const slots = opponentSlots(opponents.length);

  const sidebarPlayers = view.seating.map((pid) => ({
    id: pid,
    name: nameFor(pid),
    avatarUrl: pid === view.you ? (account?.avatarUrl ?? null) : (playerAvatarUrls[pid] ?? null),
    isYou: pid === view.you,
    isHost: room?.hostId === pid,
    captureCount: view.captureCounts[pid] ?? 0,
    connected: !disconnectedPlayers.has(pid),
  }));

  const historyEvents = eventLog.slice(-10).map((e) => {
    const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${t} ${e.event.type}`;
  });

  // Voice bar JSX — used in TopBar (mobile) and RightSidebar (desktop)
  const voiceBarJsx = !voice.permissionDenied ? (
    <div className="game__voice-bar">
      <button
        className={`game__voice-icon${voice.mode === 'open' && voice.muted ? ' game__voice-icon--off' : ''}${voice.mode === 'ptt' && voice.pttActive ? ' game__voice-icon--active' : ''}`}
        onMouseDown={() => { if (voice.mode === 'ptt') voice.setPttActive(true); }}
        onMouseUp={() => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
        onMouseLeave={() => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
        onTouchStart={(e) => { if (voice.mode === 'ptt') { e.preventDefault(); voice.setPttActive(true); } }}
        onTouchEnd={(e) => { if (voice.mode === 'ptt') { e.preventDefault(); voice.setPttActive(false); } }}
        onTouchCancel={() => { if (voice.mode === 'ptt') voice.setPttActive(false); }}
        onClick={() => { if (voice.mode === 'open') voice.toggleMute(); }}
        title={voice.mode === 'ptt' ? 'Hold to talk (Space)' : (voice.muted ? 'Unmute mic' : 'Mute mic')}
      >
        {voice.mode === 'ptt' ? (voice.pttActive ? '🎙️' : '🔇') : (voice.muted ? '🔇' : '🎙️')}
      </button>
      <button
        className={`game__voice-icon${voice.deafened ? ' game__voice-icon--off' : ''}`}
        onClick={voice.toggleDeafen}
        title={voice.deafened ? 'Undeafen' : 'Deafen'}
      >
        {voice.deafened ? '🔈' : '🔊'}
      </button>
      <button
        className="game__voice-mode"
        onClick={voice.toggleMode}
        title="Toggle push-to-talk / open mic"
      >
        {voice.mode === 'ptt' ? 'PTT' : 'MIC'}
      </button>
    </div>
  ) : null;

  const timerEl = turnStartedAt !== null ? (
    <TurnTimer turnStartedAt={turnStartedAt} durationMs={turnTimeoutMs} freezeUntilMs={timerFreezeUntil} />
  ) : null;

  const scoreData = Object.entries(view.captureCounts).map(([pid, count]) => ({
    name: nameFor(pid),
    count,
  }));

  const turnAvatarUrl = view.turn
    ? (view.turn === view.you ? (account?.avatarUrl ?? null) : (playerAvatarUrls[view.turn] ?? null))
    : null;

  const currentTurnSlot = (
    <div className="topbar__turn-card">
      <div className="topbar__turn-avatar">
        {turnAvatarUrl
          ? <img src={turnAvatarUrl} alt="" referrerPolicy="no-referrer" />
          : <span>{turnName.slice(0, 2).toUpperCase()}</span>}
      </div>
      <div>
        <span className="topbar__turn-label">CURRENT TURN</span>
        <span className="topbar__turn-name">
          {isYourTurn ? `${nameFor(view.you)}` : turnName}
          {isYourTurn && <span className="topbar__turn-you"> (You)</span>}
        </span>
      </div>
    </div>
  );

  const desktopBarPlayers = players.map((pid) => ({
    playerId: pid,
    displayName: nameFor(pid),
    avatarUrl: pid === view.you ? (account?.avatarUrl ?? null) : (playerAvatarUrls[pid] ?? null),
    isYou: pid === view.you,
    isTurn: view.turn === pid,
    captureCount: view.captureCounts[pid] ?? 0,
    disconnected: disconnectedPlayers.has(pid),
  }));

  const renderOpponentSeat = (pid: string): React.ReactNode => {
    const handCount = view.handCounts[pid] ?? 0;
    const captureCount = view.phase === 'PART_1' ? view.captureCounts[pid] ?? 0 : undefined;
    const safeIndex = view.safeOrder.indexOf(pid);
    return (
      <PlayerWrap pid={pid}>
        <OpponentSeat
          playerId={pid}
          displayName={nameFor(pid)}
          avatarUrl={playerAvatarUrls[pid] ?? null}
          isYou={false}
          handCount={handCount}
          captureCount={captureCount}
          isTurn={view.turn === pid}
          isSafe={safeIndex >= 0}
          safeRank={safeIndex >= 0 ? safeIndex + 1 : undefined}
          disconnected={disconnectedPlayers.has(pid)}
          compact
          showFan
        />
      </PlayerWrap>
    );
  };

  return (
    <div className="game" ref={gameRef}>

      <TopBar
        partNumber={view.phase === 'PART_1' ? 1 : 2}
        phaseName={view.phase === 'PART_1' ? 'Capture' : 'Cut'}
        onLeave={() => { void leaveRoom(); }}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        timerSlot={timerEl}
        voiceSlot={voiceBarJsx}
        currentTurnSlot={currentTurnSlot}
        onSettings={() => setMenuOpen(true)}
      />

      <div className="game__body">
        <LeftSidebar
          roomCode={room?.roomCode ?? '—'}
          playerCount={view.seating.length}
          partLabel={view.phase === 'PART_1' ? 'Part 1' : 'Part 2'}
          players={sidebarPlayers}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onCopyRoomCode={() => {
            if (room?.roomCode) void navigator.clipboard.writeText(room.roomCode);
          }}
        />

        <div className="game__main">
          <div className="game__area">
            <MobileLeftPanel
              stockCount={view.stockCount}
              autoArrange={autoArrange}
              onAutoArrange={() => setAutoArrange(v => !v)}
              onSort={handleSort}
            />

            <div className="game__center">
              <DesktopPlayerBar players={desktopBarPlayers} />

              <div className="game__stage">
                <div className="game__ring">
                {opponents.map((pid, i) => {
                  const slot = slots[i];
                  if (!slot) return null;
                  return (
                    <div key={pid} className={`game__opponent game__opponent--${slot}`}>
                      {renderOpponentSeat(pid)}
                    </div>
                  );
                })}

                <div className="game__table-wrap">
                  <GameTable
                    statusText={view.turn ? (isYourTurn ? 'Your turn — tap a card to play' : `${turnName}'s turn`) : undefined}
                    isYourTurn={isYourTurn}
                  >
                    <div className="game__board-inner">
                      {view.phase === 'PART_1' ? (
                        <Part1Board view={view} onMove={makeMove} onSelectionChange={handlePart1Change} />
                      ) : (
                        <Part2Board view={view} flash={flash} playerNames={resolvedPlayerNames} onMove={makeMove} onSelectionChange={handlePart2Change} />
                      )}
                    </div>
                  </GameTable>

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
                </div>
                </div>

                <div className="game__hand-float">
                  <div className={`game__hand-area${useSuitStackedHand ? ' game__hand-area--stacked' : ''}`}>
                    <Hand
                      hand={finalHand}
                      selectedId={handState.selectedId}
                      legalIds={legalIds}
                      canAct={handState.canAct}
                      onSelect={onSelectCard}
                      suitStacked={useSuitStackedHand}
                      highlightedIds={highlightedIds}
                    />
                  </div>
                </div>
              </div>
            </div>

            <MobileRightPanel
              cuts={0}
              maxCuts={3}
              canClaimCapture={false}
              onClaimCapture={() => { /* noop */ }}
            />
          </div>

          <div className="game__hand-section game__hand-section--mobile">
            <div className="game__you-avatar">
              <div className="game__arc game__arc--left">
                <div className="game__arc-card" />
                <div className="game__arc-card" />
                <div className="game__arc-card" />
              </div>
              <PlayerWrap pid={view.you}>
                <OpponentSeat
                  playerId={view.you}
                  displayName={nameFor(view.you)}
                  avatarUrl={account?.avatarUrl ?? null}
                  isYou
                  handCount={view.handCounts[view.you] ?? view.hand.length}
                  captureCount={view.phase === 'PART_1' ? (view.captureCounts[view.you] ?? 0) : undefined}
                  isTurn={isYourTurn}
                  isSafe={view.safeOrder.indexOf(view.you) >= 0}
                  safeRank={view.safeOrder.indexOf(view.you) >= 0 ? view.safeOrder.indexOf(view.you) + 1 : undefined}
                  disconnected={false}
                  compact
                  showFan
                />
              </PlayerWrap>
              <div className="game__arc game__arc--right">
                <div className="game__arc-card" />
                <div className="game__arc-card" />
                <div className="game__arc-card" />
              </div>
            </div>

            <div className={`game__hand-area${useSuitStackedHand ? ' game__hand-area--stacked' : ''}`}>
              <Hand
                hand={finalHand}
                selectedId={handState.selectedId}
                legalIds={legalIds}
                canAct={handState.canAct}
                onSelect={onSelectCard}
                suitStacked={useSuitStackedHand}
                highlightedIds={highlightedIds}
              />
            </div>
          </div>
        </div>

        <RightSidebar
          currentTurnName={isYourTurn ? `${nameFor(view.you)} (You)` : turnName}
          currentTurnAvatarUrl={turnAvatarUrl}
          isCurrentTurnYou={isYourTurn}
          stockCount={view.stockCount}
          autoArrange={autoArrange}
          onAutoArrange={() => setAutoArrange(v => !v)}
          onSort={handleSort}
          cuts={0}
          maxCuts={3}
          canClaimCapture={false}
          onClaimCapture={() => { /* noop */ }}
          phase={view.phase === 'PART_1' ? 'part1' : 'part2'}
          voiceSlot={voiceBarJsx}
          events={historyEvents}
        />
      </div>

      <BottomNav
        onLeave={() => { void leaveRoom(); }}
        scores={scoreData}
        events={historyEvents}
      />

      {/* Captured pile FAB (Part 1) — portaled, floats above hand */}
      {view.phase === 'PART_1' && view.myCapturedCards.length > 0 && (
        <CapturedPile cards={view.myCapturedCards} />
      )}

      {/* Full-screen CUT animation */}
      <AnimatePresence>
        {cutAnimData && (
          <CutAnimation
            key="cut-anim"
            pickerName={cutAnimData.pickerName}
            pickedUpCount={cutAnimData.pickedUpCount}
            playerIndex={cutAnimData.playerIndex}
            totalPlayers={players.length}
            isYou={cutAnimData.isYou}
            onDone={() => setCutAnimData(null)}
          />
        )}
      </AnimatePresence>

      {/* Phase transition overlay */}
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

      {/* Action bar — fixed bottom sheet */}
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
                  <button className="secondary" onClick={handState.action.onCancel} disabled={handState.action.submitting}>
                    Cancel
                  </button>
                  <button onClick={handState.action.onConfirm} disabled={handState.action.submitting}>
                    {handState.action.submitting ? '…' : 'Yes, lock it in'}
                  </button>
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
                        <button className="secondary action-bar__cycle" onClick={handState.action.onCycle}>
                          Next option
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="muted">No capture — card stays on the table</span>
                  )}
                </div>
                <div className="action-bar__buttons">
                  <button className="secondary" onClick={handState.action.onCancel} disabled={handState.action.submitting}>
                    Cancel
                  </button>
                  <button onClick={handState.action.onConfirm} disabled={handState.action.submitting}>
                    {handState.action.submitting ? '…' : handState.action.hasCapture ? 'Capture' : 'Play'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
