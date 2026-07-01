import { memo, useEffect, useMemo, useState } from 'react';
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
  stage: 'confirm-card' | 'choose-capture';
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
  /** Table card IDs in the currently-selected capture option */
  highlightedIds: ReadonlySet<CardId>;
}

interface Selection {
  cardId: CardId;
  /** false = awaiting card confirmation; true = card locked, choosing capture */
  confirmed: boolean;
  options: readonly (readonly CardId[])[];
  optionIndex: number;
}

function findCard(hand: readonly CardModel[], id: CardId): CardModel | undefined {
  return hand.find((c) => cardId(c) === id);
}

export const Part1Board = memo(function Part1Board({ view, onMove, onSelectionChange }: Part1BoardProps): React.ReactNode {
  const canAct = view.turn === view.you;
  const storageKey = `ganatri_p1_sel_${view.you}`;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Restore selection from sessionStorage on mount (survives page refresh)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { cardId: CardId; confirmed: boolean; optionIndex: number };
      const card = findCard(view.hand, saved.cardId);
      if (!card) { sessionStorage.removeItem(storageKey); return; }
      if (saved.confirmed) {
        const options = captureOptionsFor(card, view.table);
        setSelection({ cardId: saved.cardId, confirmed: true, options, optionIndex: saved.optionIndex });
      } else {
        setSelection({ cardId: saved.cardId, confirmed: false, options: [], optionIndex: 0 });
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep sessionStorage in sync with selection state
  useEffect(() => {
    if (selection) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          cardId: selection.cardId,
          confirmed: selection.confirmed,
          optionIndex: selection.optionIndex,
        }));
      } catch { /* quota exceeded — ignore */ }
    } else {
      sessionStorage.removeItem(storageKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const liveSelection =
    selection && canAct && findCard(view.hand, selection.cardId) ? selection : null;

  const chosenSet: ReadonlySet<CardId> = useMemo(() => {
    if (!liveSelection?.confirmed) return new Set();
    const set = liveSelection.options[liveSelection.optionIndex];
    return new Set(set ?? []);
  }, [liveSelection]);

  function selectHandCard(id: CardId): void {
    if (!canAct) return;
    if (!findCard(view.hand, id)) return;
    // Stage 1: just select the card — no capture hints yet
    setSelection({ cardId: id, confirmed: false, options: [], optionIndex: 0 });
  }

  async function confirmCard(): Promise<void> {
    if (!liveSelection || liveSelection.confirmed) return;
    const card = findCard(view.hand, liveSelection.cardId);
    if (!card) return;
    const options = captureOptionsFor(card, view.table);
    if (options.length === 0) {
      // No captures possible — submit immediately, no second step needed
      setSubmitting(true);
      const ok = await onMove({ type: 'PLAY_CAPTURE', card: liveSelection.cardId, capture: [] });
      setSubmitting(false);
      if (ok) setSelection(null);
    } else {
      // Has capture options — move to stage 2 so player can choose
      setSelection({ cardId: liveSelection.cardId, confirmed: true, options, optionIndex: 0 });
    }
  }

  const hasCapture = liveSelection?.confirmed ? (liveSelection.options.length ?? 0) > 0 : false;
  const multipleOptions = liveSelection?.confirmed ? (liveSelection.options.length ?? 0) > 1 : false;

  function cycleOption(): void {
    setSelection((sel) =>
      sel ? { ...sel, optionIndex: (sel.optionIndex + 1) % sel.options.length } : sel,
    );
  }

  function clickTableCard(id: CardId): void {
    if (!liveSelection?.confirmed) return;
    const idx = liveSelection.options.findIndex((set) => set.includes(id));
    if (idx >= 0) setSelection({ ...liveSelection, optionIndex: idx });
  }

  async function confirm(): Promise<void> {
    if (!liveSelection?.confirmed || submitting) return;
    const set = hasCapture ? liveSelection.options[liveSelection.optionIndex] : [];
    setSubmitting(true);
    const ok = await onMove({ type: 'PLAY_CAPTURE', card: liveSelection.cardId, capture: set ?? [] });
    setSubmitting(false);
    if (ok) setSelection(null);
  }

  const hint = canAct
    ? liveSelection
      ? liveSelection.confirmed
        ? 'Choose a capture set, then confirm.'
        : 'Are you sure? This choice is final.'
      : 'Your turn — tap a card to play.'
    : 'Waiting for other players…';

  // Notify parent of current selection state
  useEffect(() => {
    onSelectionChange({
      selectedId: liveSelection?.cardId ?? null,
      legalIds: null,
      canAct: canAct && !submitting && !liveSelection?.confirmed,
      onSelect: selectHandCard,
      hint,
      highlightedIds: chosenSet,
      action: liveSelection
        ? liveSelection.confirmed
          ? {
              stage: 'choose-capture',
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
          : {
              stage: 'confirm-card',
              hasCapture: false,
              captureSize: 0,
              multipleOptions: false,
              optionLabel: '',
              submitting,
              onConfirm: () => { void confirmCard(); },
              onCycle: () => undefined,
              onCancel: () => setSelection(null),
            }
        : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSelection?.cardId, liveSelection?.confirmed, liveSelection?.optionIndex, canAct, submitting]);

  const aceTableCards = view.table.filter(card => card.rank === 'A');
  const nonAceTableCards = view.table.filter(card => card.rank !== 'A');

  return (
    <div className="board">
      <div className="board__table board__table--felt" aria-label="Table cards">
        <>
          {aceTableCards.length > 0 && (
            <div className="board__trick-aces">
              <AnimatePresence initial={false}>
                {aceTableCards.map((card) => {
                  const id = cardId(card);
                  const highlighted = chosenSet.has(id);
                  const clickable = (liveSelection?.confirmed && liveSelection.options.some((s) => s.includes(id))) ?? false;
                  return (
                    <motion.div
                      key={id}
                      className="board__trick-ace-wrapper"
                      layout="position"
                      initial={{ y: -40, opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    >
                      <div className="board__ace-badge">ACE</div>
                      <div style={{ position: 'relative' }}>
                        <Card
                          card={card}
                          highlighted={highlighted}
                          aceTable={true}
                          onClick={clickable ? () => clickTableCard(id) : undefined}
                        />
                        <div className="board__ace-sparkles">
                          <span>✦</span>
                          <span>★</span>
                          <span>✦</span>
                          <span>★</span>
                          <span>✦</span>
                          <span>★</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
          {nonAceTableCards.length > 0 && (
            <div className="board__table-cards">
              <AnimatePresence initial={false}>
                {nonAceTableCards.map((card) => {
                  const id = cardId(card);
                  const highlighted = chosenSet.has(id);
                  const clickable = (liveSelection?.confirmed && liveSelection.options.some((s) => s.includes(id))) ?? false;
                  return (
                    <motion.div
                      key={id}
                      layout="position"
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
          )}
          {aceTableCards.length === 0 && nonAceTableCards.length === 0 && (
            <div className="board__empty muted">Table is empty</div>
          )}
        </>
      </div>

    </div>
  );
});
