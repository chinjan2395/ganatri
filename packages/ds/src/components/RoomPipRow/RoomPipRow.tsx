import type { ReactNode } from 'react';
import './RoomPipRow.css';

export interface RoomPipRowProps {
  filled: number;
  max: number;
}

function PipIcon(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="currentColor" />
      <circle cx="12" cy="12" r="5.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <path d="M12 7v10M9 10h6" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function RoomPipRow({ filled, max }: RoomPipRowProps): ReactNode {
  return (
    <div
      className="room__pips"
      role="list"
      aria-label={`${filled} of ${max} players joined`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          role="listitem"
          className={`room__pip${i < filled ? ' room__pip--filled' : ''}`}
        >
          {i < filled ? <PipIcon /> : null}
        </span>
      ))}
    </div>
  );
}
