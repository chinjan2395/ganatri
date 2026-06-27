import type { ReactNode } from 'react';
import { DsButton } from '../Button';
import './HeaderDesktop.css';

export interface HeaderDesktopProps {
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  logoSrc?: string;
  settingsDisabled?: boolean;
  onSettings?: () => void;
  onExit?: () => void;
}

function SettingsIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
        fill="currentColor"
      />
    </svg>
  );
}

function ExitIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlayersIcon(): ReactNode {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 19c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 14.5c2.2.4 4 1.8 4 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function HeaderDesktop({
  roomCode,
  playerCount,
  maxPlayers,
  logoSrc,
  settingsDisabled = true,
  onSettings,
  onExit,
}: HeaderDesktopProps): ReactNode {
  return (
    <header className="room__header-desktop">
      <div className="room__header-left">
        {logoSrc !== undefined ? (
          <img src={logoSrc} alt="Ganatri" className="room__header-logo" />
        ) : (
          <span className="room__header-logo-fallback">Ganatri</span>
        )}
      </div>
      <div className="room__header-center">
        <div className="room__header-title-block">
          <span className="room__header-flourish" aria-hidden="true" />
          <h1 className="room__header-room-title">ROOM {roomCode}</h1>
          <span
            className="room__header-flourish room__header-flourish--right"
            aria-hidden="true"
          />
        </div>
        <span className="room__player-badge room__player-badge--header">
          <span className="room__player-badge-icon">
            <PlayersIcon />
          </span>
          {playerCount} / {maxPlayers} PLAYER ROOM
        </span>
      </div>
      <div className="room__header-right">
        <DsButton
          tone="outline"
          disabled={settingsDisabled}
          onClick={onSettings}
        >
          <SettingsIcon />
          Settings
        </DsButton>
        <DsButton
          tone="danger"
          onClick={onExit}
        >
          <ExitIcon />
          Exit Room
        </DsButton>
      </div>
    </header>
  );
}
