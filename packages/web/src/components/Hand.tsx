import { AnimatePresence, motion } from 'framer-motion';
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
      <AnimatePresence initial={false}>
        {hand.map((card) => {
          const id = cardId(card);
          const legal = legalIds === null ? canAct : legalIds.has(id);
          const disabled = !canAct || !legal;
          return (
            <motion.div
              key={id}
              className="hand__slot"
              layout
              initial={{ opacity: 0, y: 18, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -28, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            >
              <Card
                card={card}
                selected={selectedId === id}
                legal={canAct && legal}
                disabled={disabled}
                onClick={() => onSelect(id)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
