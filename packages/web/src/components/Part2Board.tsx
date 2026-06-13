import { useState } from 'react';
import {
  cardId,
  type CardId,
  type Move,
  type PlayerView,
  type Suit,
} from '@ganatri/engine';
import { legalPart2CardIds } from '../game/legal';
import { Card } from './Card';
import { Hand } from './Hand';
import './Boards.css';

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export interface Part2BoardProps {
  view: PlayerView;
  flash: { kind: 'cut' | 'won' | 'safe'; text: string } | null;
  onMove: (move: Move) => Promise<boolean>;
}

function shortId(id: string): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

export function Part2Board({ view, flash, onMove }: Part2BoardProps): React.ReactNode {
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

  return (
    <div className="board">
      <div className={`board__flash ${flash ? `board__flash--${flash.kind}` : ''}`}>
        {flash?.text}
      </div>

      <div className="board__led">
        {view.ledSuit ? (
          <span>
            Led suit:{' '}
            <span style={{ color: view.ledSuit === 'H' || view.ledSuit === 'D' ? 'var(--red-suit)' : 'var(--text)' }}>
              {SUIT_GLYPH[view.ledSuit]}
            </span>
          </span>
        ) : (
          <span className="muted">New trick — lead any card</span>
        )}
      </div>

      <div className="board__trick" aria-label="Current trick">
        {view.trick.length === 0 && <div className="board__empty muted">No cards played yet</div>}
        {view.trick.map((play) => (
          <div key={cardId(play.card)} className="board__trick-play">
            <Card card={play.card} small={false} highlighted={play.isCut} />
            <div className="board__trick-name">
              {shortId(play.player)}
              {play.isCut && <span className="board__cut-tag">CUT</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="board__hand-area">
        <div className="board__hint">
          {youSafe
            ? 'You are safe — out of the round.'
            : canAct
              ? 'Your turn — tap a highlighted card.'
              : 'Waiting for other players…'}
        </div>
        <Hand
          hand={view.hand}
          selectedId={null}
          legalIds={legalIds}
          canAct={canAct && !submitting}
          onSelect={play}
        />
      </div>
    </div>
  );
}
