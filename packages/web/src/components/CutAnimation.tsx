import { useEffect } from 'react';
import { motion } from 'framer-motion';
import './CutAnimation.css';

interface Props {
  pickerName: string;
  pickedUpCount: number;
  /** 0-based index in the ordered players row (left → right) */
  playerIndex: number;
  totalPlayers: number;
  isYou: boolean;
  onDone: () => void;
}

const CARD_COUNT = 6;
const SPARK_COUNT = 12;

export function CutAnimation({ pickerName, pickedUpCount, playerIndex, totalPlayers, isYou, onDone }: Props): React.ReactNode {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  // The .cut-anim__cards container sits at left:50%, top:50% (board centre).
  // We compute how far to fly to reach the player avatar column.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targetX = ((playerIndex + 0.5) / totalPlayers) * vw;
  const dx = targetX - vw * 0.5;
  // Players row is roughly at 12% from top; board centre ~45% from top.
  const dy = vh * 0.12 - vh * 0.45;

  const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => ({
    angle: (i / SPARK_COUNT) * 360,
    delay: 0.06 + (i % 3) * 0.04,
  }));

  const cards = Array.from({ length: CARD_COUNT }, (_, i) => {
    const spread = -28 + (i / (CARD_COUNT - 1)) * 56;
    return { i, spread };
  });

  return (
    <motion.div
      className="cut-anim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
      transition={{ duration: 0.06 }}
    >
      {/* Dark red overlay */}
      <div className="cut-anim__bg" />

      {/* Orange impact flash */}
      <div className="cut-anim__flash" />

      {/* Shockwave ring expanding from centre */}
      <motion.div
        className="cut-anim__shockwave"
        initial={{ scale: 0, opacity: 0.95 }}
        animate={{ scale: 28, opacity: 0 }}
        transition={{ duration: 0.75, ease: 'easeOut' }}
      />

      {/* Radial sparks shooting outward */}
      <div className="cut-anim__sparks">
        {sparks.map((s, idx) => (
          <div
            key={idx}
            className="cut-anim__spark"
            style={{
              transform: `rotate(${s.angle}deg)`,
              ['--sd' as string]: `${s.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ✂ CUT! headline slamming in */}
      <motion.div
        className="cut-anim__headline"
        initial={{ scale: 3.5, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 24, delay: 0.06 }}
      >
        <motion.span
          className="cut-anim__scissors"
          initial={{ rotate: -60 }}
          animate={{ rotate: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.06 }}
        >
          ✂
        </motion.span>
        <span className="cut-anim__word">CUT!</span>
      </motion.div>

      {/* Subtitle sliding up */}
      <motion.div
        className="cut-anim__sub"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 24, delay: 0.35 }}
      >
        {pickerName} picks up {pickedUpCount} card{pickedUpCount !== 1 ? 's' : ''}
        {isYou && <span className="cut-anim__you-badge">YOU</span>}
      </motion.div>

      {/* Cards flying from board centre to picker's avatar */}
      <div className="cut-anim__cards">
        {cards.map(({ i, spread }) => (
          <motion.div
            key={i}
            className="cut-anim__card"
            initial={{ x: spread * 2.2, y: 0, rotate: spread, opacity: 0, scale: 0.45 }}
            animate={{
              x: [spread * 2.2, spread * 0.6, dx],
              y: [0, dy * 0.32, dy],
              rotate: [spread, spread * 0.25, 0],
              opacity: [0, 1, 0],
              scale: [0.45, 1.12, 0.75],
            }}
            transition={{
              duration: 0.88,
              delay: 0.40 + i * 0.075,
              times: [0, 0.38, 1],
              ease: [0.22, 0.61, 0.36, 1],
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
