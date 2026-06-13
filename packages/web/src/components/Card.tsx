import type { Card as CardModel, Suit } from '@ganatri/engine';
import './Card.css';

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

export interface CardProps {
  card?: CardModel; // omit for face-down
  faceDown?: boolean;
  selected?: boolean;
  legal?: boolean;
  disabled?: boolean;
  highlighted?: boolean; // capture-set highlight
  small?: boolean;
  onClick?: () => void;
  title?: string;
}

export function Card(props: CardProps): React.ReactNode {
  const { card, faceDown, selected, legal, disabled, highlighted, small, onClick, title } = props;
  const interactive = Boolean(onClick) && !disabled;

  const classes = ['card'];
  if (faceDown || !card) classes.push('card--back');
  if (selected) classes.push('card--selected');
  if (legal) classes.push('card--legal');
  if (disabled) classes.push('card--disabled');
  if (highlighted) classes.push('card--highlighted');
  if (small) classes.push('card--small');
  if (interactive) classes.push('card--interactive');

  if (faceDown || !card) {
    return <div className={classes.join(' ')} aria-hidden="true" />;
  }

  const red = isRedSuit(card.suit);
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      className={classes.join(' ')}
      style={{ color: red ? 'var(--red-suit)' : 'var(--black-suit)' }}
      onClick={interactive ? onClick : undefined}
      disabled={interactive ? false : undefined}
      title={title ?? `${card.rank}${SUIT_GLYPH[card.suit]}`}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="card__rank">{card.rank}</span>
      <span className="card__suit">{SUIT_GLYPH[card.suit]}</span>
    </Tag>
  );
}
