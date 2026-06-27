import type { ReactNode } from 'react';
import './HeaderMobile.css';

export interface HeaderMobileProps {
  roomCode: string;
  onBack?: () => void;
  onCopyCode?: () => void;
  menuOpen: boolean;
  onMenuToggle?: () => void;
  isHost?: boolean;
  canStart?: boolean;
  busy?: boolean;
  onStart?: () => void;
}

function CopyIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

export function HeaderMobile({
  roomCode,
  onBack,
  onCopyCode,
  menuOpen,
  onMenuToggle,
  isHost = false,
  canStart = false,
  busy = false,
  onStart,
}: HeaderMobileProps): ReactNode {
  return (
    <header className="room__header-mobile">
      <button
        type="button"
        className="room__header-back"
        onClick={onBack}
        aria-label="Leave room"
      >
        ←
      </button>
      <div className="room__header-title-wrap">
        <span className="room__header-title">Room</span>
        <span className="room__header-code">{roomCode}</span>
      </div>
      <div className="room__header-actions">
        <button
          type="button"
          className="room__header-icon-btn"
          onClick={onCopyCode}
          aria-label="Copy room code"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className="room__header-icon-btn"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          &#8942;
        </button>
      </div>
      {menuOpen && (
        <div className="room__header-menu">
          {isHost && canStart && (
            <button className="room__start--ready" onClick={onStart} disabled={busy}>
              ▶ Start Game
            </button>
          )}
          <button className="danger" onClick={onBack} disabled={busy}>
            Leave Room
          </button>
        </div>
      )}
    </header>
  );
}
