import type React from 'react';
import logo from '../assets/ganatri-logo.png';
import './TopBar.css';

export interface TopBarProps {
  partNumber: 1 | 2;
  phaseName: string;
  onLeave: () => void;
  onMenuToggle?: () => void;
  timerSlot?: React.ReactNode;
  voiceSlot?: React.ReactNode;
  /** Mobile status row — current turn mini card */
  currentTurnSlot?: React.ReactNode;
  onSettings?: () => void;
}

export function TopBar({
  partNumber,
  phaseName,
  onLeave,
  onMenuToggle,
  timerSlot,
  voiceSlot,
  currentTurnSlot,
  onSettings,
}: TopBarProps): React.ReactNode {
  return (
    <header className="topbar">
      <div className="topbar__row topbar__row--primary">
        <button type="button" className="topbar__menu" onClick={onMenuToggle} aria-label="Menu">
          <span className="topbar__menu-icon" aria-hidden>☰</span>
        </button>

        <img src={logo} alt="Ganatri" className="topbar__logo-img topbar__logo-img--desktop" />

        <div className="topbar__phase">
          <span className="topbar__phase-num">PART {partNumber}</span>
          <span className="topbar__phase-name">{phaseName.toUpperCase()}</span>
        </div>

        <div className="topbar__center-desktop">
          {timerSlot && <div className="topbar__timer topbar__timer--desktop">{timerSlot}</div>}
          {voiceSlot && <div className="topbar__voice topbar__voice--desktop">{voiceSlot}</div>}
        </div>

        <img src={logo} alt="" className="topbar__logo-img topbar__logo-img--mobile" aria-hidden />

        <div className="topbar__actions">
          <button type="button" className="topbar__leave" onClick={onLeave}>
            <span className="topbar__leave-icon" aria-hidden>⎋</span>
            <span className="topbar__leave-text">Leave Room</span>
          </button>
          {onSettings && (
            <button type="button" className="topbar__settings" onClick={onSettings} aria-label="Settings">
              ⚙
            </button>
          )}
        </div>
      </div>

      {(timerSlot || voiceSlot || currentTurnSlot) && (
        <div className="topbar__row topbar__row--status">
          {timerSlot && <div className="topbar__timer">{timerSlot}</div>}
          {voiceSlot && <div className="topbar__voice">{voiceSlot}</div>}
          {currentTurnSlot && <div className="topbar__turn">{currentTurnSlot}</div>}
        </div>
      )}
    </header>
  );
}
