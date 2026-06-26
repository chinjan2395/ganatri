import type { ReactNode } from 'react';
import './RoomStatusPanel.css';

export interface RoomStatusPanelProps {
  playerCount: number;
  maxPlayers?: number;
  elapsedSeconds: number;
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

function formatElapsed(s: number): string {
  return (
    Math.floor(s / 60).toString().padStart(2, '0') +
    ':' +
    (s % 60).toString().padStart(2, '0')
  );
}

export function RoomStatusPanel({
  playerCount,
  maxPlayers = 4,
  elapsedSeconds,
}: RoomStatusPanelProps): ReactNode {
  const fillPct = Math.round((playerCount / maxPlayers) * 100);
  const isReady = playerCount >= 2;
  const isFull = playerCount === maxPlayers;

  return (
    <div className="room__status-bar">
      <div className="room__statusbar-col">
        <span className="room__statusbar-eyebrow">SEATS</span>
        <div className="room__statusbar-fraction">
          <span className="room__statusbar-num">{playerCount}</span>
          <span className="room__statusbar-denom">/{maxPlayers}</span>
        </div>
        <div
          className="room__pips"
          role="list"
          aria-label={`${playerCount} of ${maxPlayers} players joined`}
        >
          {Array.from({ length: maxPlayers }, (_, i) => (
            <span
              key={i}
              role="listitem"
              className={`room__pip${i < playerCount ? ' room__pip--filled' : ''}`}
            >
              {i < playerCount ? <PipIcon /> : null}
            </span>
          ))}
        </div>
        <div className="room__statusbar-fillbar" aria-hidden="true">
          <div
            className={`room__statusbar-fill${isFull ? ' room__statusbar-fill--full' : ''}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      <div className="room__statusbar-vline" aria-hidden="true" />

      <div className="room__statusbar-col room__statusbar-col--timer">
        <span className="room__statusbar-eyebrow">IN LOBBY</span>
        <span className="room__statusbar-clock">{formatElapsed(elapsedSeconds)}</span>
        <span className="room__statusbar-clock-label">elapsed</span>
      </div>

      <div
        className={`room__statusbar-footer${isFull ? ' room__statusbar-footer--full' : isReady ? ' room__statusbar-footer--ready' : ''}`}
      >
        <span className="room__statusbar-footer-dot" aria-hidden="true" />
        {isFull
          ? 'ROOM FULL — READY TO START'
          : isReady
          ? 'READY TO START'
          : `WAITING FOR PLAYERS · ${playerCount}/${maxPlayers}`}
      </div>
    </div>
  );
}
