import type { ReactNode } from 'react';
import './PlayTimeBar.css';

export interface DsPlayTimeBarProps {
  ms: number;
}

function formatPlayTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '— TOTAL PLAY TIME';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}H ${m}M ${s}S TOTAL PLAY TIME`;
  return `${m}M ${s}S TOTAL PLAY TIME`;
}

export function DsPlayTimeBar({ ms }: DsPlayTimeBarProps): ReactNode {
  return (
    <div className="ds-playtime-bar">
      <svg
        className="ds-playtime-bar__icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
          fill="currentColor"
        />
      </svg>
      <span className="ds-playtime-bar__text">{formatPlayTime(ms)}</span>
    </div>
  );
}
