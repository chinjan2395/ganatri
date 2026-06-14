import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cardId, type CardId, type Card as CardModel, type GameEvent } from '@ganatri/engine';
import { useGame } from '../state/GameProvider';
import { OpponentSeat } from '../components/OpponentSeat';
import { Part1Board, type Part1SelectionState } from '../components/Part1Board';
import { Part2Board, type Part2SelectionState } from '../components/Part2Board';
import { Hand } from '../components/Hand';
import { CapturedPile } from '../components/CapturedPile';
import { EndScreen } from '../components/EndScreen';
import { TurnTimer } from '../components/TurnTimer';
import './GameScreen.css';

function shortId(id: string): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

/**
 * Maps an opponent index to a rim position around the vertical oval.
 *  1 opponent  → top
 *  2 opponents → top-left, top-right
 *  3 opponents → left, top, right
 */
function slotFor(index: number, total: number): string {
  if (total <= 1) return 'top';
  if (total === 2) return index === 0 ? 'left' : 'right';
  return (['left', 'top', 'right'] as const)[index] ?? 'top';
}

type Flash = { kind: 'cut' | 'won' | 'safe'; text: string };

function flashFor(event: GameEvent): Flash | null {
  switch (event.type) {
    case 'CUT':
      return { kind: 'cut', text: `CUT! ${shortId(event.pickerUpper)} picks up ${event.pickedUp.length} cards` };
    case 'TRICK_WON':
      return { kind: 'won', text: `${shortId(event.winner)} wins the trick` };
    case 'PLAYER_SAFE':
      return { kind: 'safe', text: `${shortId(event.player)} is safe` };
    default:
      return null;
  }
}

function getLocalCapturedCards(eventLog: readonly { event: GameEvent }[], playerId: string): readonly CardModel[] {
  const captured: CardModel[] = [];
  for (const { event } of eventLog) {
    if (event.type === 'CAPTURED' && event.player === playerId) {
      captured.push(...event.cards);
    } else if (event.type === 'PART1_ENDED') {
      break;
    }
  }
  return captured;
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
  const { view, room, session, lastEvent, eventLog, disconnectedPlayers, turnStartedAt, turnTimeoutMs, makeMove, startGame, leaveRoom } = useGame();
  const [flash, setFlash] = useState<Flash | null>(null);
  const [handState, setHandState] = useState<HandState>(DEFAULT_HAND_STATE);
  // Local drag order for Part 2 — keeps user's custom arrangement across tricks.
  const [handOrder, setHandOrder] = useState<CardId[]>([]);

  // Sync handOrder when hand changes: preserve existing order, append new cards.
  useEffect(() => {
    if (!view) return;
    const currentIds = view.hand.map((c) => cardId(c));
    setHandOrder((prev) => {
      const stillPresent = prev.filter((id) => currentIds.includes(id));
      const newIds = currentIds.filter((id) => !stillPresent.includes(id));
      return [...stillPresent, ...newIds];
    });
  }, [view?.hand]);

  // Drive transient Part 2 feedback from the game-event stream.
  useEffect(() => {
    if (!lastEvent) return;
    const f = flashFor(lastEvent);
    if (!f) return;
    setFlash(f);
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [lastEvent]);

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
      <div className="game">
        <EndScreen
          rankings={view.rankings}
          you={view.you}
          isHost={Boolean(isHost)}
          onPlayAgain={() => {
            void startGame();
          }}
          onLeave={() => {
            void leaveRoom();
          }}
        />
      </div>
    );
  }

  const opponents = view.seating.filter((pid) => pid !== view.you);
  const turnName = view.turn ? (view.turn === view.you ? 'You' : shortId(view.turn)) : '—';

  const legalIds = handState.legalIds as ReadonlySet<CardId> | null;
  const highlightedIds = 'highlightedIds' in handState ? handState.highlightedIds : undefined;
  const onSelectCard = (id: CardId): void => {
    handState.onSelect(id as never);
  };

  // In Part 2, show cards in the user's chosen drag order.
  const handToRender: readonly CardModel[] =
    view.phase === 'PART_2' && handOrder.length > 0
      ? (handOrder
          .map((id) => view.hand.find((c) => cardId(c) === id))
          .filter(Boolean) as CardModel[])
      : view.hand;

  return (
    <div className="game">
      {/* ── Top bar ── */}
      <header className="game__topbar">
        <div className="game__phase">{view.phase === 'PART_1' ? 'Part 1 · Capture' : 'Part 2 · Cut'}</div>
        <div className="game__topbar-meta">
          <span className="game__turn">
            Turn <strong>{turnName}</strong>
          </span>
          {turnStartedAt !== null && <TurnTimer turnStartedAt={turnStartedAt} durationMs={turnTimeoutMs} />}
        </div>
        <button
          className="secondary game__leave"
          onClick={() => {
            void leaveRoom();
          }}
        >
          Leave
        </button>
      </header>

      {/* ── Vertical oval table with opponents on the rim ── */}
      <div className="game__table-stage">
        <div className="table-felt" aria-hidden="true" />

        <div className="table-seats">
          {opponents.map((pid, i) => {
            const handCount = view.handCounts[pid] ?? 0;
            const captureCount = view.phase === 'PART_1' ? view.captureCounts[pid] ?? 0 : undefined;
            const safeIndex = view.safeOrder.indexOf(pid);
            return (
              <div className="table-seat" data-pos={slotFor(i, opponents.length)} key={pid}>
                <OpponentSeat
                  playerId={pid}
                  isYou={false}
                  handCount={handCount}
                  captureCount={captureCount}
                  isTurn={view.turn === pid}
                  isSafe={safeIndex >= 0}
                  safeRank={safeIndex >= 0 ? safeIndex + 1 : undefined}
                  disconnected={disconnectedPlayers.has(pid)}
                  compact
                />
              </div>
            );
          })}
        </div>

        {/* Current player info card on the bottom rim */}
        <div className="table-seat" data-pos="bottom">
          <OpponentSeat
            playerId={view.you}
            isYou
            handCount={view.handCounts[view.you] ?? view.hand.length}
            captureCount={view.phase === 'PART_1' ? view.captureCounts[view.you] ?? 0 : undefined}
            isTurn={view.turn === view.you}
            isSafe={view.safeOrder.includes(view.you)}
            safeRank={
              view.safeOrder.indexOf(view.you) >= 0 ? view.safeOrder.indexOf(view.you) + 1 : undefined
            }
            disconnected={false}
            compact
          />
        </div>

        <div className="table-center">
          {view.phase === 'PART_1' ? (
            <Part1Board view={view} onMove={makeMove} onSelectionChange={handlePart1Change} />
          ) : (
            <Part2Board view={view} flash={flash} onMove={makeMove} onSelectionChange={handlePart2Change} />
          )}
        </div>

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

        {handState.hint && <div className="table-hint">{handState.hint}</div>}
      </div>

      {/* ── Sidebar: captured pile (Part 1 only) + hand + action bar ── */}
      <div className="game__sidebar">
        {view.phase === 'PART_1' && (() => {
          const captured = getLocalCapturedCards(eventLog, view.you);
          return captured.length > 0 ? <CapturedPile cards={captured} /> : null;
        })()}
        <div className="game__hand">
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

        {/* ── Action bar (capture confirm) — sits between hand and player info ── */}
        <AnimatePresence>
          {handState.action && (
            <motion.div
              className="game__action-bar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              {handState.action.stage === 'confirm-card' ? (
                <>
                  <span>Play this card?</span>
                  <button onClick={handState.action.onConfirm} disabled={handState.action.submitting}>
                    {handState.action.submitting ? '…' : 'Yes, lock it in'}
                  </button>
                  <button className="secondary" onClick={handState.action.onCancel} disabled={handState.action.submitting}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {handState.action.hasCapture ? (
                    <>
                      <span>
                        Capture {handState.action.captureSize} card{handState.action.captureSize === 1 ? '' : 's'}
                        {handState.action.optionLabel}
                      </span>
                      {handState.action.multipleOptions && (
                        <button className="secondary" onClick={handState.action.onCycle}>
                          Next option
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="muted">No capture — card stays on the table</span>
                  )}
                  <button onClick={handState.action.onConfirm} disabled={handState.action.submitting}>
                    {handState.action.submitting ? '…' : handState.action.hasCapture ? 'Capture' : 'Play (no capture)'}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
