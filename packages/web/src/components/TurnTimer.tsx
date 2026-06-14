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
  const urgent = seconds <= 3;

  return (
    <div className={`ttimer${urgent ? ' ttimer--urgent' : ''}`} aria-label={`${seconds}s remaining`}>
      <div className="ttimer__bar">
        <div className="ttimer__fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      <span className="ttimer__secs">{seconds}s</span>
    </div>
  );
}
