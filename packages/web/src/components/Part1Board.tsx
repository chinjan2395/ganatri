import { useMemo, useState } from 'react';
import { cardId, type Card as CardModel, type CardId, type Move, type PlayerView } from '@ganatri/engine';
import { captureOptionsFor } from '../game/legal';
import { Card } from './Card';
import { Hand } from './Hand';
import './Boards.css';

export interface Part1BoardProps {
  view: PlayerView;
  onMove: (move: Move) => Promise<boolean>;
}

interface Selection {
  cardId: CardId;
  options: readonly (readonly CardId[])[];
  optionIndex: number; // which capture set is chosen
}

function findCard(hand: readonly CardModel[], id: CardId): CardModel | undefined {
  return hand.find((c) => cardId(c) === id);
}

export function Part1Board({ view, onMove }: Part1BoardProps): React.ReactNode {
  const canAct = view.turn === view.you;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Drop stale selection if the card is no longer in hand or it isn't our turn.
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

  /** Clicking a table card jumps to an offered set that contains it. */
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

  return (
    <div className="board">
      <div className="board__table" aria-label="Table cards">
        {view.table.length === 0 && <div className="board__empty muted">Table is empty</div>}
        <div className="board__table-cards">
          {view.table.map((card) => {
            const id = cardId(card);
            const highlighted = chosenSet.has(id);
            const clickable = liveSelection?.options.some((s) => s.includes(id)) ?? false;
            return (
              <Card
                key={id}
                card={card}
                highlighted={highlighted}
                onClick={clickable ? () => clickTableCard(id) : undefined}
              />
            );
          })}
        </div>
      </div>

      {liveSelection && (
        <div className="board__capture-panel">
          {hasCapture ? (
            <>
              <span>
                Capture {chosenSet.size} card{chosenSet.size === 1 ? '' : 's'}
                {multipleOptions ? ` (option ${liveSelection.optionIndex + 1}/${liveSelection.options.length})` : ''}
              </span>
              {multipleOptions && (
                <button className="secondary" onClick={cycleOption}>
                  Next option
                </button>
              )}
            </>
          ) : (
            <span className="muted">No capture — card stays on the table</span>
          )}
          <button onClick={confirm} disabled={submitting}>
            {submitting ? '…' : hasCapture ? 'Capture' : 'Play (no capture)'}
          </button>
          <button className="secondary" onClick={() => setSelection(null)} disabled={submitting}>
            Cancel
          </button>
        </div>
      )}

      <div className="board__hand-area">
        <div className="board__hint">
          {canAct
            ? liveSelection
              ? 'Pick a capture set, then confirm.'
              : 'Your turn — tap a card to play.'
            : 'Waiting for other players…'}
        </div>
        <Hand
          hand={view.hand}
          selectedId={liveSelection?.cardId ?? null}
          legalIds={null}
          canAct={canAct && !submitting}
          onSelect={selectHandCard}
        />
      </div>
    </div>
  );
}
