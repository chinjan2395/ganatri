import type React from 'react';
import './RightSidebar.css';

interface RightSidebarProps {
  currentTurnName: string;
  currentTurnAvatarUrl?: string | null;
  isCurrentTurnYou: boolean;
  stockCount: number;
  autoArrange: boolean;
  onAutoArrange: () => void;
  onSort: () => void;
  cuts: number;
  maxCuts: number;
  canClaimCapture: boolean;
  onClaimCapture: () => void;
  phase: 'part1' | 'part2';
  events?: string[];
  /** Voice controls slot */
  voiceSlot?: React.ReactNode;
}

export function RightSidebar({
  currentTurnName,
  currentTurnAvatarUrl,
  isCurrentTurnYou,
  stockCount,
  autoArrange,
  onAutoArrange,
  onSort,
  cuts,
  maxCuts,
  canClaimCapture,
  onClaimCapture,
  phase,
  events = [],
  voiceSlot,
}: RightSidebarProps): React.ReactNode {
  return (
    <aside className="rsidebar">

      {/* Current Turn */}
      <section className="rsidebar__section">
        <h4 className="rsidebar__heading">CURRENT TURN</h4>
        <div className="rsidebar__turn">
          <div className="rsidebar__turn-avatar" style={currentTurnAvatarUrl ? undefined : { background: 'rgba(74,144,226,0.3)' }}>
            {currentTurnAvatarUrl
              ? <img src={currentTurnAvatarUrl} alt="" className="rsidebar__turn-img" referrerPolicy="no-referrer" />
              : <span className="rsidebar__turn-initials">{currentTurnName.slice(0, 2).toUpperCase()}</span>
            }
          </div>
          <div className="rsidebar__turn-info">
            <span className="rsidebar__turn-name">{currentTurnName}</span>
            {isCurrentTurnYou && <span className="rsidebar__you-badge">YOU</span>}
          </div>
        </div>
      </section>

      {/* Deck */}
      <section className="rsidebar__section">
        <h4 className="rsidebar__heading">DECK</h4>
        <div className="rsidebar__deck">
          <div className="rsidebar__deck-card" aria-hidden />
          <span className="rsidebar__deck-count">{stockCount}</span>
        </div>
      </section>

      {/* Actions */}
      <section className="rsidebar__section">
        <h4 className="rsidebar__heading">ACTIONS</h4>
        <div className="rsidebar__actions">
          <div className="rsidebar__row">
            <span className="rsidebar__action-label">Sort Hand</span>
            <button
              type="button"
              role="switch"
              aria-checked={false}
              className="rsidebar__switch"
              onClick={onSort}
              title="Sort hand by suit"
            >
              <span className="rsidebar__switch-knob" />
              <span className="rsidebar__switch-text">Off</span>
            </button>
          </div>
          <div className="rsidebar__row">
            <span className="rsidebar__action-label">Auto Arrange</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoArrange}
              className={`rsidebar__switch${autoArrange ? ' rsidebar__switch--on' : ''}`}
              onClick={onAutoArrange}
            >
              <span className="rsidebar__switch-knob" />
              <span className="rsidebar__switch-text">{autoArrange ? 'On' : 'Off'}</span>
            </button>
          </div>
          {phase === 'part1' && (
            <button
              type="button"
              className={`rsidebar__claim${canClaimCapture ? ' rsidebar__claim--active' : ''}`}
              onClick={onClaimCapture}
              disabled={!canClaimCapture}
            >
              Claim Capture
            </button>
          )}
        </div>
      </section>

      {/* Cuts */}
      <section className="rsidebar__section">
        <h4 className="rsidebar__heading">CUTS</h4>
        <span className="rsidebar__cuts">{cuts} / {maxCuts}</span>
      </section>

      {/* Voice */}
      {voiceSlot && (
        <section className="rsidebar__section">
          <h4 className="rsidebar__heading">VOICE CHAT</h4>
          <p className="rsidebar__voice-status">
            <span className="rsidebar__voice-dot" aria-hidden /> Voice chat is enabled
          </p>
          {voiceSlot}
          <input type="range" className="rsidebar__volume" min={0} max={100} defaultValue={80} aria-label="Volume" />
        </section>
      )}

      {/* History */}
      <section className="rsidebar__section rsidebar__section--history">
        <h4 className="rsidebar__heading">GAME HISTORY</h4>
        {events.length > 0 ? (
          <ul className="rsidebar__events">
            {events.slice(-10).map((e, i) => (
              <li key={i} className="rsidebar__event">{e}</li>
            ))}
          </ul>
        ) : (
          <p className="rsidebar__history-empty">No events yet</p>
        )}
      </section>
    </aside>
  );
}
