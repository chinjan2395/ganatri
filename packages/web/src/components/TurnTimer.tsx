import { useEffect, useRef, useState } from 'react';
import './TurnTimer.css';

interface TurnTimerProps {
  turnStartedAt: number; // Unix ms
  durationMs: number; // Turn timeout in ms
  freezeUntilMs?: number; // While Date.now() < this, display full time (client-side cosmetic only)
}

export function TurnTimer({ turnStartedAt, durationMs, freezeUntilMs }: TurnTimerProps): React.ReactNode {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, durationMs - (Date.now() - turnStartedAt)),
  );
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = (): void => {
      const now = Date.now();
      const frozen = freezeUntilMs !== undefined && now < freezeUntilMs;
      const r = frozen ? durationMs : Math.max(0, durationMs - (now - turnStartedAt));
      setRemaining(r);
      if (r > 0 || frozen) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [turnStartedAt, durationMs, freezeUntilMs]);

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
