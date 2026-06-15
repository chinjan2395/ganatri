import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  cardId,
  type CardId,
  type Move,
  type PlayerView,
  type Suit,
} from '@ganatri/engine';
import { legalPart2CardIds } from '../game/legal';
import { Card } from './Card';
import './Boards.css';

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export interface Part2BoardProps {
  view: PlayerView;
  flash: { kind: 'cut' | 'won' | 'safe'; text: string } | null;
  playerNames: Readonly<Record<string, string>>;
  onMove: (move: Move) => Promise<boolean>;
  /** Called whenever hand interaction state changes so the parent can render the Hand. */
  onSelectionChange: (state: Part2SelectionState) => void;
}

export interface Part2SelectionState {
  selectedId: null;
  legalIds: ReadonlySet<CardId>;
  canAct: boolean;
  onSelect: (id: CardId) => void;
  hint: string;
  action: null;
}

function shortId(id: string): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

export function Part2Board({ view, flash, playerNames, onMove, onSelectionChange }: Part2BoardProps): React.ReactNode {
  const canAct = view.turn === view.you;
  const legalIds: ReadonlySet<CardId> = legalPart2CardIds(view);
  const [submitting, setSubmitting] = useState(false);
  const youSafe = view.safeOrder.includes(view.you);

  async function play(id: CardId): Promise<void> {
    if (!canAct || submitting || !legalIds.has(id)) return;
    setSubmitting(true);
    await onMove({ type: 'PLAY_TRICK', card: id });
    setSubmitting(false);
  }

  const hint = youSafe
    ? 'You are safe — out of the round.'
    : canAct
      ? 'Your turn — tap a highlighted card.'
      : 'Waiting for other players…';

  // Notify parent of current selection state
  useEffect(() => {
    onSelectionChange({
      selectedId: null,
      legalIds,
      canAct: canAct && !submitting,
      onSelect: play,
      hint,
      action: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct, submitting, youSafe, view.ledSuit]);

  return (
    <div className="board">
      <div className="board__led">
        {view.ledSuit ? (
          <span>
            Led suit:{' '}
            <span
              style={{
                color: view.ledSuit === 'H' || view.ledSuit === 'D' ? 'var(--red-suit)' : 'var(--text)',
              }}
            >
              {SUIT_GLYPH[view.ledSuit]}
            </span>
          </span>
        ) : (
          <span className="muted">New trick — lead any card</span>
        )}
      </div>

      <div className="board__trick board__table--felt" aria-label="Current trick">
        {view.trick.length === 0 ? (
          <div className="board__empty muted">No cards played yet</div>
        ) : (
          <AnimatePresence initial={false}>
            {view.trick.map((play) => {
              const cutAnimate = play.isCut ? {
                y: 0,
                opacity: 1,
                scale: [1, 1.18, 1],
                filter: ['brightness(1)', 'brightness(1.6)', 'brightness(1)'],
              } : {
                y: 0,
                opacity: 1,
                scale: 1,
              };
              const cutTransition = play.isCut ? {
                scale: { duration: 0.65, delay: 0.1, ease: 'easeInOut' },
                filter: { duration: 0.65, delay: 0.1, ease: 'easeInOut' },
                y: { type: 'spring', stiffness: 360, damping: 22 },
                opacity: { type: 'spring', stiffness: 360, damping: 22 },
              } : {
                type: 'spring',
                stiffness: 360,
                damping: 22,
              };
              return (
                <motion.div
                  key={`${cardId(play.card)}-${play.isCut ? 'cut' : 'normal'}`}
                  className="board__trick-play"
                  layout="position"
                  initial={{ y: -24, opacity: 0, scale: 0.85 }}
                  animate={cutAnimate}
                  exit={{ y: 16, opacity: 0 }}
                  transition={cutTransition}
                >
                  <Card card={play.card} small={false} highlighted={play.isCut} />
                  <div className="board__trick-name">
                    {playerNames[play.player] || shortId(play.player)}
                    {play.isCut && <span className="board__cut-tag">CUT</span>}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
