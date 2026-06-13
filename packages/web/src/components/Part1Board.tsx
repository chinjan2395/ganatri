import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cardId, type Card as CardModel, type CardId, type Move, type PlayerView } from '@ganatri/engine';
import { captureOptionsFor } from '../game/legal';
import { Card } from './Card';
import './Boards.css';

export interface Part1BoardProps {
  view: PlayerView;
  onMove: (move: Move) => Promise<boolean>;
  /** Called whenever hand-selection state changes so the parent can render the Hand. */
  onSelectionChange: (state: Part1SelectionState) => void;
}

export interface Part1Action {
  hasCapture: boolean;
  captureSize: number;
  multipleOptions: boolean;
  optionLabel: string;
  submitting: boolean;
  onConfirm: () => void;
  onCycle: () => void;
  onCancel: () => void;
}

export interface Part1SelectionState {
  selectedId: CardId | null;
  /** null = all cards enabled */
  legalIds: null;
  canAct: boolean;
  onSelect: (id: CardId) => void;
  /** Hint text to display above the hand */
  hint: string;
  /** Non-null when a hand card is selected and the action bar should show */
  action: Part1Action | null;
}

interface Selection {
  cardId: CardId;
  options: readonly (readonly CardId[])[];
  optionIndex: number;
}

function findCard(hand: readonly CardModel[], id: CardId): CardModel | undefined {
  return hand.find((c) => cardId(c) === id);
}

export function Part1Board({ view, onMove, onSelectionChange }: Part1BoardProps): React.ReactNode {
  const canAct = view.turn === view.you;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const liveSelection =
    selection && canAct && findCard(view.hand, selection.cardId) ? selection : null;

  const chosenSet: ReadonlySet<CardId> = useMemo(() => {
    if (!liveSelection) return new Set();
    const set = liveSelection.options[liveSelection.optionIndex];
    return new Set(set ?? []);
  }, [liveSelection]);

  function selectHandCard(id: CardId): void {
    if (!canAct) return;
    const card = findCard(view.hand, id);
    if (!card) return;
    const options = captureOptionsFor(card, view.table);
    setSelection({ cardId: id, options, optionIndex: 0 });
  }

  const hasCapture = (liveSelection?.options.length ?? 0) > 0;
  const multipleOptions = (liveSelection?.options.length ?? 0) > 1;

  function cycleOption(): void {
    setSelection((sel) =>
      sel ? { ...sel, optionIndex: (sel.optionIndex + 1) % sel.options.length } : sel,
    );
  }

  function clickTableCard(id: CardId): void {
    if (!liveSelection) return;
    const idx = liveSelection.options.findIndex((set) => set.includes(id));
    if (idx >= 0) setSelection({ ...liveSelection, optionIndex: idx });
  }

  async function confirm(): Promise<void> {
    if (!liveSelection || submitting) return;
    const set = hasCapture ? liveSelection.options[liveSelection.optionIndex] : [];
    setSubmitting(true);
    const ok = await onMove({ type: 'PLAY_CAPTURE', card: liveSelection.cardId, capture: set ?? [] });
    setSubmitting(false);
    if (ok) setSelection(null);
  }

  const hint = canAct
    ? liveSelection
      ? 'Pick a capture set, then confirm.'
      : 'Your turn — tap a card to play.'
    : 'Waiting for other players…';

  // Notify parent of current selection state
  useEffect(() => {
    onSelectionChange({
      selectedId: liveSelection?.cardId ?? null,
      legalIds: null,
      canAct: canAct && !submitting,
      onSelect: selectHandCard,
      hint,
      action: liveSelection
        ? {
            hasCapture,
            captureSize: chosenSet.size,
            multipleOptions,
            optionLabel: multipleOptions
              ? ` (option ${liveSelection.optionIndex + 1}/${liveSelection.options.length})`
              : '',
            submitting,
            onConfirm: confirm,
            onCycle: cycleOption,
            onCancel: () => setSelection(null),
          }
        : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSelection?.cardId, liveSelection?.optionIndex, canAct, submitting]);

  return (
    <div className="board">
      <div className="board__table board__table--felt" aria-label="Table cards">
        {view.table.length === 0 && <div className="board__empty muted">Table is empty</div>}
        <div className="board__table-cards">
          <AnimatePresence initial={false}>
            {view.table.map((card) => {
              const id = cardId(card);
              const highlighted = chosenSet.has(id);
              const clickable = liveSelection?.options.some((s) => s.includes(id)) ?? false;
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                >
                  <Card
                    card={card}
                    highlighted={highlighted}
                    onClick={clickable ? () => clickTableCard(id) : undefined}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
