import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CardId, GameEvent } from '@ganatri/engine';
import { useGame } from '../state/GameProvider';
import { OpponentSeat } from '../components/OpponentSeat';
import { Part1Board, type Part1SelectionState } from '../components/Part1Board';
import { Part2Board, type Part2SelectionState } from '../components/Part2Board';
import { Hand } from '../components/Hand';
import { CapturedPile } from '../components/CapturedPile';
import { EndScreen } from '../components/EndScreen';
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

type HandState = Part1SelectionState | Part2SelectionState;

const DEFAULT_HAND_STATE: HandState = {
  selectedId: null,
  legalIds: null,
  canAct: false,
  onSelect: () => undefined,
  hint: '',
  action: null,
};

export function GameScreen(): React.ReactNode {
  const { view, room, session, lastEvent, disconnectedPlayers, makeMove, startGame, leaveRoom } = useGame();
  const [flash, setFlash] = useState<Flash | null>(null);
  const [handState, setHandState] = useState<HandState>(DEFAULT_HAND_STATE);

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
  const onSelectCard = (id: CardId): void => {
    handState.onSelect(id as never);
  };

  return (
    <div className="game">
      {/* ── Top bar ── */}
      <header className="game__topbar">
        <div className="game__phase">{view.phase === 'PART_1' ? 'Part 1 · Capture' : 'Part 2 · Cut'}</div>
        <div className="game__topbar-meta">
          <span className="game__turn">
            Turn <strong>{turnName}</strong>
          </span>
          {view.phase === 'PART_1' && <span className="game__stock">Stock {view.stockCount}</span>}
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
      </div>

      {/* ── Hint + captured pile (Part 1 only) + hand ── */}
      {handState.hint && (
        <div className="game__hint">{handState.hint}</div>
      )}
      {view.phase === 'PART_1' && view.myCapturedCards.length > 0 && (
        <CapturedPile cards={view.myCapturedCards} />
      )}
      <div className="game__hand">
        <Hand
          hand={view.hand}
          selectedId={handState.selectedId}
          legalIds={legalIds}
          canAct={handState.canAct}
          onSelect={onSelectCard}
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
  );
}
