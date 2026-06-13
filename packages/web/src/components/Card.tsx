import { motion } from 'framer-motion';
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
    return (
      <motion.div
        className={classes.join(' ')}
        aria-hidden="true"
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <span className="card__back-art" />
      </motion.div>
    );
  }

  const red = isRedSuit(card.suit);
  const glyph = SUIT_GLYPH[card.suit];

  const corner = (
    <span className="card__corner">
      <span className="card__rank">{card.rank}</span>
      <span className="card__pip">{glyph}</span>
    </span>
  );

  const body = (
    <>
      {corner}
      <span className="card__suit" aria-hidden="true">
        {glyph}
      </span>
      <span className="card__corner card__corner--br">
        <span className="card__rank">{card.rank}</span>
        <span className="card__pip">{glyph}</span>
      </span>
    </>
  );

  const sharedProps = {
    className: classes.join(' '),
    style: { color: red ? 'var(--red-suit)' : 'var(--black-suit)' },
    title: title ?? `${card.rank}${glyph}`,
    'aria-label': `${card.rank} of ${card.suit}`,
  };

  const motionProps = {
    initial: { y: -14, opacity: 0, rotateZ: -4 },
    animate: { y: 0, opacity: 1, rotateZ: 0 },
    transition: { type: 'spring' as const, stiffness: 320, damping: 22 },
  };

  if (interactive) {
    return (
      <motion.button
        type="button"
        {...sharedProps}
        {...motionProps}
        whileHover={{ y: -8 }}
        whileTap={{ scale: 0.96 }}
        onClick={onClick}
      >
        {body}
      </motion.button>
    );
  }

  return (
    <motion.div {...sharedProps} {...motionProps}>
      {body}
    </motion.div>
  );
}
