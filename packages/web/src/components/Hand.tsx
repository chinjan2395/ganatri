import { cardId, type Card as CardModel, type CardId } from '@ganatri/engine';
import { Card } from './Card';
import './Hand.css';

export interface HandProps {
  hand: readonly CardModel[];
  selectedId: CardId | null;
  legalIds: ReadonlySet<CardId> | null; // null = all enabled (your turn, no constraint)
  canAct: boolean;
  onSelect: (id: CardId) => void;
}

export function Hand({ hand, selectedId, legalIds, canAct, onSelect }: HandProps): React.ReactNode {
  if (hand.length === 0) {
    return <div className="hand hand--empty muted">No cards in hand</div>;
  }
  return (
    <div className="hand" role="group" aria-label="Your hand">
      {hand.map((card) => {
        const id = cardId(card);
        const legal = legalIds === null ? canAct : legalIds.has(id);
        const disabled = !canAct || !legal;
        return (
          <Card
            key={id}
            card={card}
            selected={selectedId === id}
            legal={canAct && legal}
            disabled={disabled}
            onClick={() => onSelect(id)}
          />
        );
      })}
    </div>
  );
}
