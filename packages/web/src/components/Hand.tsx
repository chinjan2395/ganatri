import { useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { cardId, type Card as CardModel, type CardId } from '@ganatri/engine';
import { Card } from './Card';
import './Hand.css';

export interface HandProps {
  hand: readonly CardModel[];
  selectedId: CardId | null;
  legalIds: ReadonlySet<CardId> | null; // null = all enabled (your turn, no constraint)
  canAct: boolean;
  onSelect: (id: CardId) => void;
  /** When provided, renders the hand as drag-to-reorder (Part 2). */
  onReorder?: (newOrder: CardId[]) => void;
  /** Card IDs to highlight (Part 1 capture selection). */
  highlightedIds?: ReadonlySet<CardId>;
}

/**
 * Computes negative inter-card overlap so all `count` cards fit in a single row.
 * Returns 0 when they already fit without overlap.
 * Caps overlap at 58% of card width so the rank corner stays readable.
 * Returns `needsWrap = true` if even max-overlap isn't enough (Part 1 edge case).
 */
function useFanOverlap(count: number): {
  ref: React.RefObject<HTMLDivElement>;
  overlap: number;
  needsWrap: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ overlap: 0, needsWrap: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const cardEl = el.querySelector('.card') as HTMLElement | null;
      const cardW = cardEl?.offsetWidth ?? 56;
      const styles = getComputedStyle(el);
      const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const avail = el.clientWidth - padX;
      if (count <= 1 || cardW <= 0) {
        setState({ overlap: 0, needsWrap: false });
        return;
      }
      const needed = count * cardW;
      if (needed <= avail) {
        setState({ overlap: 0, needsWrap: false });
        return;
      }
      const maxOv = cardW * 0.58;
      const ov = (needed - avail) / (count - 1);
      if (ov <= maxOv) {
        setState({ overlap: ov, needsWrap: false });
      } else {
        setState({ overlap: maxOv, needsWrap: true });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  return { ref, overlap: state.overlap, needsWrap: state.needsWrap };
}

export function Hand({ hand, selectedId, legalIds, canAct, onSelect, onReorder, highlightedIds }: HandProps): React.ReactNode {
  const { ref, overlap, needsWrap } = useFanOverlap(hand.length);

  if (hand.length === 0) {
    return <div className="hand hand--empty muted">No cards in hand</div>;
  }

  // ── Part 2: drag-to-reorder grid ────────────────────────────────────────────
  if (onReorder) {
    const ids = hand.map((c) => cardId(c));
    return (
      <Reorder.Group
        as="div"
        axis="x"
        values={ids}
        onReorder={onReorder}
        className="hand hand--grid"
        role="group"
        aria-label="Your hand — drag to rearrange"
        ref={ref}
      >
        {hand.map((card) => {
          const id = cardId(card);
          const legal = legalIds === null ? canAct : legalIds.has(id);
          const disabled = !canAct || !legal;
          return (
            <Reorder.Item
              key={id}
              value={id}
              as="div"
              className="hand__slot hand__slot--grid"
              layout="position"
              style={{ cursor: 'grab', touchAction: 'none' }}
              whileDrag={{ scale: 1.12, y: -12, zIndex: 30, cursor: 'grabbing' }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            >
              <Card
                card={card}
                selected={selectedId === id}
                legal={canAct && legal}
                disabled={disabled}
                highlighted={highlightedIds?.has(id) ?? false}
                onClick={() => onSelect(id)}
              />
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    );
  }

  // ── Part 1: fan overlap; wraps to extra rows if hand is very large ───────────
  const fanClass = needsWrap ? 'hand hand--fan hand--wrap' : 'hand hand--fan';

  return (
    <div className={fanClass} role="group" aria-label="Your hand" ref={ref}>
      <AnimatePresence initial={false}>
        {hand.map((card, i) => {
          const id = cardId(card);
          const legal = legalIds === null ? canAct : legalIds.has(id);
          const disabled = !canAct || !legal;
          return (
            <motion.div
              key={id}
              className="hand__slot"
              layout="position"
              style={needsWrap ? undefined : { marginLeft: i === 0 ? 0 : -overlap }}
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
                highlighted={highlightedIds?.has(id) ?? false}
                onClick={() => onSelect(id)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
