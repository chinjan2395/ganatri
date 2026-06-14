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
  const [open, setOpen] = useState(false);

  const bySuit: Record<Suit, Card[]> = { S: [], H: [], D: [], C: [] };
  for (const c of cards) bySuit[c.suit].push(c);
  for (const s of SUIT_ORDER) bySuit[s].sort(rankSort);

  return (
    <div className="cpile">
      {/* Card-icon trigger */}
      <button
        className="cpile__btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`My captures: ${cards.length}`}
      >
        {/* Stacked card SVG icon */}
        <svg className="cpile__icon" viewBox="0 0 20 24" width="20" height="24" aria-hidden="true">
          {/* Back card, tilted */}
          <rect
            x="5" y="1" width="13" height="18" rx="2.5" ry="2.5"
            fill="rgba(20,38,27,0.85)" stroke="rgba(231,195,74,0.35)" strokeWidth="1"
            transform="rotate(-10 11.5 10)"
          />
          {/* Front card */}
          <rect
            x="2" y="5" width="13" height="18" rx="2.5" ry="2.5"
            fill="rgba(18,34,24,0.95)" stroke="rgba(231,195,74,0.8)" strokeWidth="1.2"
          />
          {/* Suit glyph centred on front card */}
          <text
            x="8.5" y="18" textAnchor="middle" fontSize="9"
            fill="var(--gold-rim)" fontWeight="bold"
          >♦</text>
        </svg>

        {/* Count badge */}
        <span className="cpile__count">{cards.length}</span>
        <span className="cpile__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {/* Floating breakdown panel — opens upward */}
      {open && (
        <div className="cpile__panel">
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
        </div>
      )}
    </div>
  );
}
