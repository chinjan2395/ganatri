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
    case 'CUT':
      return { kind: 'cut', text: `CUT! ${nameFor(event.pickerUpper)} picks up ${event.pickedUp.length} cards` };
    case 'TRICK_WON':
      return { kind: 'won', text: `${nameFor(event.winner)} wins the trick` };
    case 'PLAYER_SAFE':
      return { kind: 'safe', text: `${nameFor(event.player)} is safe` };
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
  const { view, room, session, lastEvent, eventLog, disconnectedPlayers, playerNames, turnStartedAt, turnTimeoutMs, makeMove, startGame, leaveRoom } = useGame();
  const [flash, setFlash] = useState<Flash | null>(null);
  const [handState, setHandState] = useState<HandState>(DEFAULT_HAND_STATE);
  const [handOrder, setHandOrder] = useState<CardId[]>([]);

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
    const name = (pid: string): string => playerNames[pid] || shortId(pid);
    const f = flashFor(lastEvent, name);
    if (!f) return;
    setFlash(f);
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [lastEvent, playerNames]);

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
          onPlayAgain={() => { void startGame(); }}
          onLeave={() => { void leaveRoom(); }}
        />
      </div>
    );
  }

  const players = orderedPlayers(view.seating, view.you);
  const nameFor = (pid: string): string => playerNames[pid] || shortId(pid);
  const isYourTurn = view.turn === view.you;
  const turnName = view.turn ? (isYourTurn ? 'You' : nameFor(view.turn)) : '—';

  const legalIds = handState.legalIds as ReadonlySet<CardId> | null;
  const highlightedIds = 'highlightedIds' in handState ? handState.highlightedIds : undefined;
  const onSelectCard = (id: CardId): void => { handState.onSelect(id as never); };

  const handToRender: readonly CardModel[] =
    view.phase === 'PART_2' && handOrder.length > 0
      ? (handOrder.map((id) => view.hand.find((c) => cardId(c) === id)).filter(Boolean) as CardModel[])
      : view.hand;

  return (
    <div className="game">

      {/* ── HUD: independent floating pills ── */}
      <header className="game__hud">
        {/* Phase pill */}
        <div className="hud__phase">
          <span className="hud__phase-number">{view.phase === 'PART_1' ? 'PART 1' : 'PART 2'}</span>
          <span className="hud__phase-name">{view.phase === 'PART_1' ? 'Capture' : 'Cut'}</span>
        </div>

        {/* Turn pill */}
        <div className={`hud__turn${isYourTurn ? ' hud__turn--yours' : ''}`}>
          <span className="hud__turn-dot" aria-hidden="true" />
          <span className="hud__turn-label">Turn</span>
          <span className="hud__turn-name">{turnName}</span>
        </div>

        {/* Timer pill */}
        {turnStartedAt !== null && (
          <TurnTimer turnStartedAt={turnStartedAt} durationMs={turnTimeoutMs} />
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
            <OpponentSeat
              key={pid}
              playerId={pid}
              displayName={nameFor(pid)}
              isYou={isYou}
              handCount={handCount}
              captureCount={captureCount}
              isTurn={view.turn === pid}
              isSafe={safeIndex >= 0}
              safeRank={safeIndex >= 0 ? safeIndex + 1 : undefined}
              disconnected={isYou ? false : disconnectedPlayers.has(pid)}
              compact
            />
          );
        })}
      </div>

      {/* ── Flat playable table area ── */}
      <div className="game__board">
        {view.phase === 'PART_1' ? (
          <Part1Board view={view} onMove={makeMove} onSelectionChange={handlePart1Change} />
        ) : (
          <Part2Board view={view} flash={flash} onMove={makeMove} onSelectionChange={handlePart2Change} />
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
      </div>

      {/* ── Hand section: hint + hand + captures ── */}
      <div className="game__hand-section">
        {handState.hint && <div className="game__hint">{handState.hint}</div>}

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

        {view.phase === 'PART_1' && (() => {
          const captured = getLocalCapturedCards(eventLog, view.you);
          return captured.length > 0 ? (
            <div className="game__captures">
              <CapturedPile cards={captured} />
            </div>
          ) : null;
        })()}
      </div>

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
