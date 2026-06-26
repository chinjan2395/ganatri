import type { ReactNode } from 'react';
import { DsButton } from '../Button';
import './RoomDetailsSidebar.css';

export interface RoomDetailsSidebarProps {
  roomCode: string;
  gameMode: string;
  maxPlayers: number;
  hostName: string;
  onCopyCode?: () => void;
  onShareLink?: () => void;
}

function CopyIcon({ size = 14 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LinkIcon({ size = 14 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.12 1.12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.12-1.12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CodeIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ModeIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlayersIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 19c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 14.5c2.2.4 4 1.8 4 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function RoomDetailsSidebar({
  roomCode,
  gameMode,
  maxPlayers,
  hostName,
  onCopyCode,
  onShareLink,
}: RoomDetailsSidebarProps): ReactNode {
  const hostInitials = hostName
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="room__details-sidebar">
      <h3 className="room__details-heading">ROOM DETAILS</h3>
      <div className="room__details-rows">
        <div className="room__details-row">
          <span className="room__details-icon" aria-hidden="true">
            <CodeIcon />
          </span>
          <span className="room__details-label">Room Code</span>
          <span className="room__details-value">
            <span className="room__details-code">{roomCode}</span>
            <button
              type="button"
              className="room__details-copy-btn"
              onClick={onCopyCode}
              title="Copy code"
              aria-label="Copy room code"
            >
              <CopyIcon size={12} />
            </button>
          </span>
        </div>
        <div className="room__details-row">
          <span className="room__details-icon" aria-hidden="true">
            <ModeIcon />
          </span>
          <span className="room__details-label">Game Mode</span>
          <span className="room__details-value">{gameMode}</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-icon" aria-hidden="true">
            <PlayersIcon />
          </span>
          <span className="room__details-label">Max Players</span>
          <span className="room__details-value">{maxPlayers} Players</span>
        </div>
        <div className="room__details-row">
          <span className="room__details-icon room__details-icon--host" aria-hidden="true">
            <span className="room__details-host-initials">{hostInitials}</span>
          </span>
          <span className="room__details-label">Host</span>
          <span className="room__details-value">{hostName}</span>
        </div>
      </div>
      <div className="room__details-actions">
        <DsButton
          tone="primary"
          onClick={onCopyCode}
        >
          <CopyIcon size={15} />
          Copy Code
        </DsButton>
        <DsButton
          tone="ghost"
          onClick={onShareLink}
        >
          <LinkIcon size={15} />
          Share Link
        </DsButton>
      </div>
    </aside>
  );
}
