import { useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { cardId, type Card as CardModel, type CardId } from '@ganatri/engine';
import { Card } from './Card';
import './Hand.css';

export interface HandProps {
  hand: readonly CardModel[];
  selectedId: CardId | null;
  legalIds: ReadonlySet<CardId> | null;
  canAct: boolean;
  onSelect: (id: CardId) => void;
  onReorder?: (newOrder: CardId[]) => void;
  highlightedIds?: ReadonlySet<CardId>;
  /** Split into black/red suit rows with heavy overlap (Part 2 large hands) */
  suitStacked?: boolean;
}

const SUIT_SORT: Record<string, number> = { C: 0, S: 1, H: 2, D: 3 };
const RANK_SORT: Record<string, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

function sortBySuitRank(cards: readonly CardModel[]): CardModel[] {
  return [...cards].sort((a, b) => {
    const sd = (SUIT_SORT[a.suit] ?? 0) - (SUIT_SORT[b.suit] ?? 0);
    if (sd !== 0) return sd;
    return (RANK_SORT[a.rank] ?? 0) - (RANK_SORT[b.rank] ?? 0);
  });
}

function splitSuitRows(cards: readonly CardModel[]): [CardModel[], CardModel[]] {
  const black = sortBySuitRank(cards.filter((c) => c.suit === 'C' || c.suit === 'S'));
  const red = sortBySuitRank(cards.filter((c) => c.suit === 'H' || c.suit === 'D'));
  return [black, red];
}

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

/** Renders a single row of heavily-overlapping stacked cards. */
function StackRow({
  cards,
  selectedId,
  legalIds,
  canAct,
  onSelect,
  highlightedIds,
}: {
  cards: readonly CardModel[];
  selectedId: CardId | null;
  legalIds: ReadonlySet<CardId> | null;
  canAct: boolean;
  onSelect: (id: CardId) => void;
  highlightedIds?: ReadonlySet<CardId>;
}): React.ReactNode {
  return (
    <div className="hand__stack-row">
      <AnimatePresence initial={false} mode="popLayout">
        {cards.map((card) => {
          const id = cardId(card);
          const legal = legalIds === null ? canAct : legalIds.has(id);
          const disabled = !canAct || !legal;
          return (
            <motion.div
              key={id}
              className="hand__slot"
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

export function Hand({ hand, selectedId, legalIds, canAct, onSelect, onReorder, highlightedIds, suitStacked }: HandProps): React.ReactNode {
  const { ref, overlap, needsWrap } = useFanOverlap(hand.length);

  if (hand.length === 0) {
    return <div className="hand hand--empty muted">No cards in hand</div>;
  }

  // ── Part 2: suit-colour stacked rows ────────────────────────────────────────
  if (suitStacked) {
    const [row1, row2] = splitSuitRows(hand);
    return (
      <div className="hand hand--stacked" ref={ref} role="group" aria-label="Your hand">
        {row1.length > 0 && (
          <StackRow
            cards={row1}
            selectedId={selectedId}
            legalIds={legalIds}
            canAct={canAct}
            onSelect={onSelect}
            highlightedIds={highlightedIds}
          />
        )}
        {row2.length > 0 && (
          <StackRow
            cards={row2}
            selectedId={selectedId}
            legalIds={legalIds}
            canAct={canAct}
            onSelect={onSelect}
            highlightedIds={highlightedIds}
          />
        )}
      </div>
    );
  }

  // ── Part 2: drag-to-reorder grid (small hands) ──────────────────────────────
  if (onReorder) {
    const ids = hand.map((c) => cardId(c));
    return (
      <div className="hand hand--grid-wrap" ref={ref}>
        <Reorder.Group
          as="div"
          axis="x"
          values={ids}
          onReorder={onReorder}
          className="hand--grid"
          role="group"
          aria-label="Your hand — drag to rearrange"
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
      </div>
    );
  }

  // ── Stacked rows: two rows with heavy overlap (for large hands) ──────────────
  if (hand.length > 10) {
    const mid = Math.ceil(hand.length / 2);
    const row1 = hand.slice(0, mid);
    const row2 = hand.slice(mid);
    return (
      <div className="hand hand--stacked" ref={ref} role="group" aria-label="Your hand">
        <StackRow
          cards={row1}
          selectedId={selectedId}
          legalIds={legalIds}
          canAct={canAct}
          onSelect={onSelect}
          highlightedIds={highlightedIds}
        />
        {row2.length > 0 && (
          <StackRow
            cards={row2}
            selectedId={selectedId}
            legalIds={legalIds}
            canAct={canAct}
            onSelect={onSelect}
            highlightedIds={highlightedIds}
          />
        )}
      </div>
    );
  }

  // ── Part 1: single-row fan overlap ───────────────────────────────────────────
  const fanClass = needsWrap ? 'hand hand--fan hand--wrap' : 'hand hand--fan';

  return (
    <div className={fanClass} role="group" aria-label="Your hand" ref={ref}>
      <motion.div className="hand__fan-inner" layout="position">
        <AnimatePresence initial={false} mode="popLayout">
          {hand.map((card, i) => {
            const id = cardId(card);
            const legal = legalIds === null ? canAct : legalIds.has(id);
            const disabled = !canAct || !legal;
            return (
              <motion.div
                key={id}
                className="hand__slot"
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
      </motion.div>
    </div>
  );
}
