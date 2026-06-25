import React from 'react';
import './MobilePanel.css';

interface MobileLeftPanelProps {
  stockCount: number;
  autoArrange: boolean;
  onAutoArrange: () => void;
  onSort: () => void;
}

export function MobileLeftPanel({ stockCount, autoArrange, onAutoArrange, onSort }: MobileLeftPanelProps): React.ReactNode {
  return (
    <div className="mobile-panel mobile-panel--left">
      <div className="mpanel__deck">
        <div className="mpanel__card-back" aria-hidden />
        <span className="mpanel__label">DECK</span>
        <span className="mpanel__count">{stockCount}</span>
      </div>
      <button
        type="button"
        className={`mpanel__toggle${autoArrange ? ' mpanel__toggle--on' : ''}`}
        onClick={onAutoArrange}
        title="Auto Arrange"
      >
        <span className="mpanel__toggle-label">Auto</span>
        <span className={`mpanel__toggle-pill${autoArrange ? ' mpanel__toggle-pill--on' : ''}`}>
          {autoArrange ? 'ON' : 'OFF'}
        </span>
      </button>
      <button type="button" className="mpanel__sort-btn" onClick={onSort} title="Sort hand">
        Sort
        <span className="mpanel__sort-icon" aria-hidden>≡</span>
      </button>
    </div>
  );
}
