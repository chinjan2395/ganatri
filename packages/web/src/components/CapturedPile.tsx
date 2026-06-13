import { useState } from 'react';
import type { Card, Suit } from '@ganatri/engine';
import './CapturedPile.css';

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_ORDER: Suit[] = ['S', 'H', 'D', 'C'];
const RANK_ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function rankSort(a: Card, b: Card): number {
  return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
}

export function CapturedPile({ cards }: { cards: readonly Card[] }): React.ReactNode {
  const [expanded, setExpanded] = useState(false);

  const bySuit: Record<Suit, Card[]> = { S: [], H: [], D: [], C: [] };
  for (const c of cards) bySuit[c.suit].push(c);
  for (const s of SUIT_ORDER) bySuit[s].sort(rankSort);

  return (
    <div className="cpile" onClick={() => setExpanded((v) => !v)} role="button" aria-expanded={expanded}>
      <div className="cpile__header">
        <span className="cpile__label">My captures</span>
        <span className="cpile__toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Collapsed: one chip per suit showing count */}
      {!expanded && (
        <div className="cpile__summary">
          {SUIT_ORDER.map((s) => (
            <span
              key={s}
              className={`cpile__chip cpile__chip--${s === 'H' || s === 'D' ? 'red' : 'black'}`}
            >
              {SUIT_GLYPH[s]}{bySuit[s].length}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: suit rows with rank labels */}
      {expanded && (
        <div className="cpile__rows">
          {SUIT_ORDER.map((s) => (
            <div key={s} className="cpile__row">
              <span className={`cpile__suit-label cpile__suit-label--${s === 'H' || s === 'D' ? 'red' : 'black'}`}>
                {SUIT_GLYPH[s]}
              </span>
              <div className="cpile__ranks">
                {bySuit[s].length === 0 ? (
                  <span className="cpile__empty">—</span>
                ) : (
                  bySuit[s].map((c) => (
                    <span key={`${c.rank}${c.suit}`} className="cpile__rank">
                      {c.rank}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
