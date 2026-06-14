import { useEffect, useRef, useState } from 'react';
import './TurnTimer.css';

interface TurnTimerProps {
  turnStartedAt: number; // Unix ms
  durationMs: number; // Turn timeout in ms
}

export function TurnTimer({ turnStartedAt, durationMs }: TurnTimerProps): React.ReactNode {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, durationMs - (Date.now() - turnStartedAt)),
  );
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = (): void => {
      const r = Math.max(0, durationMs - (Date.now() - turnStartedAt));
      setRemaining(r);
      if (r > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [turnStartedAt, durationMs]);

  const fraction = remaining / durationMs;
  const seconds = Math.ceil(remaining / 1000);

  // SVG ring: r=18, circumference = 2π×18 ≈ 113.1
  const RADIUS = 18;
  const CIRC = 2 * Math.PI * RADIUS;
  const dash = fraction * CIRC;
  const urgent = seconds <= 3;

  return (
    <div className={`turn-timer${urgent ? ' turn-timer--urgent' : ''}`}>
      <svg viewBox="0 0 44 44" width="44" height="44">
        <circle cx="22" cy="22" r={RADIUS} className="turn-timer__track" />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          className="turn-timer__arc"
          strokeDasharray={`${dash} ${CIRC}`}
          strokeDashoffset="0"
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="turn-timer__label">{seconds}</span>
    </div>
  );
}
