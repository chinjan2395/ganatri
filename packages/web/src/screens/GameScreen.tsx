// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
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
import './GameScreen.css';

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
  const { view, room, session, account, progression, latestMatchScoring, lastEvent, disconnectedPlayers, playerNames, playerAvatarUrls, turnStartedAt, turnTimeoutMs, makeMove, startGame, leaveRoom } = useGame();
  const voice = useVoiceChatContext();
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

  useLayoutEffect(() => {
    const el = gameRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const tableW = Math.round(Math.min(64, Math.max(48, vw * 0.13)));
    const handW = Math.round(tableW * 1.12);
    el.style.setProperty('--card-table-w', `${tableW}px`);
    el.style.setProperty('--card-hand-w', `${handW}px`);
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

  const handToRender: readonly CardModel[] = (() => {
    if (view.phase !== 'PART_2' || handOrder.length === 0) return view.hand;
    const orderedCards = handOrder
      .map((id) => view.hand.find((c) => cardId(c) === id))
      .filter(Boolean) as CardModel[];
    const orderedIds = new Set(handOrder);
    const newCards = view.hand.filter((c) => !orderedIds.has(cardId(c)));
    return [...orderedCards, ...newCards];
  })();

  return (
    <div className="game" ref={gameRef}>

      {/* ── HUD: independent floating pills ── */}
      <header className="game__hud">
        {/* Phase pill */}
        <div className="hud__phase">
          <span className="hud__phase-number">{view.phase === 'PART_1' ? 'PART 1' : 'PART 2'}</span>
          <span className="hud__phase-name">{view.phase === 'PART_1' ? 'Capture' : 'Cut'}</span>
        </div>

        {/* Timer pill */}
        {turnStartedAt !== null && (
          <TurnTimer turnStartedAt={turnStartedAt} durationMs={turnTimeoutMs} freezeUntilMs={timerFreezeUntil} />
        )}

        {latestMatchScoring.length > 0 && (
          <div className="game__scoreboard">
            {latestMatchScoring.map((entry) => (
              <span key={entry.playerId} className="game__score-pill">
                {(entry.playerId === view.you ? 'You' : nameFor(entry.playerId))}: {entry.matchScore}
              </span>
            ))}
          </div>
        )}

        {/* Voice controls */}
        {!voice.permissionDenied && (
          <div className="game__voice-bar">
            {/* Mic button: hold for PTT, click for open-mic mute toggle */}
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
            {/* Speaker / deafen */}
            <button
              className={`game__voice-icon${voice.deafened ? ' game__voice-icon--off' : ''}`}
              onClick={voice.toggleDeafen}
              title={voice.deafened ? 'Undeafen' : 'Deafen (mute audio output)'}
            >
              {voice.deafened ? '🔈' : '🔊'}
            </button>
            {/* Mode toggle */}
            <button
              className="game__voice-mode"
              onClick={voice.toggleMode}
              title="Toggle push-to-talk / open mic"
            >
              {voice.mode === 'ptt' ? 'PTT' : 'MIC'}
            </button>
          </div>
        )}

        <button className="secondary game__leave" onClick={() => { void leaveRoom(); }}>
          Leave
        </button>
      </header>

      {/* ── Players row — all players (you centred) as floating avatars ── */}
      <div className="game__players">
        {players.map((pid) => {
          const isYou = pid === view.you;
          const handCount = isYou
            ? view.handCounts[pid] ?? view.hand.length
            : view.handCounts[pid] ?? 0;
          const captureCount = view.phase === 'PART_1' ? view.captureCounts[pid] ?? 0 : undefined;
          const safeIndex = view.safeOrder.indexOf(pid);
          return (
            <PlayerWrap key={pid} pid={pid}>
              <OpponentSeat
                playerId={pid}
                displayName={nameFor(pid)}
                avatarUrl={isYou ? account?.avatarUrl : playerAvatarUrls[pid]}
                isYou={isYou}
                handCount={handCount}
                captureCount={captureCount}
                isTurn={view.turn === pid}
                isSafe={safeIndex >= 0}
                safeRank={safeIndex >= 0 ? safeIndex + 1 : undefined}
                disconnected={isYou ? false : disconnectedPlayers.has(pid)}
                compact
              />
            </PlayerWrap>
          );
        })}
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
            totalPlayers={players.length}
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
