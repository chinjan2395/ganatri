import { motion } from 'framer-motion';
import './Chip.css';

export type ChipDenomination = 'red' | 'blue' | 'green' | 'black';

export interface ChipProps {
  /** Number shown in the chip center (e.g. card count). */
  count: number;
  denomination?: ChipDenomination;
  /** Small variant for tight rim placements. */
  small?: boolean;
  /** Accessible / hover label. */
  label?: string;
  /** Animate a pop whenever this key changes (e.g. count increment). */
  popKey?: string | number;
}

export function Chip(props: ChipProps): React.ReactNode {
  const { count, denomination = 'blue', small, label, popKey } = props;
  const classes = ['chip', `chip--${denomination}`];
  if (small) classes.push('chip--small');

  return (
    <motion.span
      className={classes.join(' ')}
      title={label}
      aria-label={label ?? `${count}`}
      key={popKey}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 18 }}
    >
      <span className="chip__face">{count}</span>
    </motion.span>
  );
}
