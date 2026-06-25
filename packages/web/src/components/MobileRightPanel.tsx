import React from 'react';
import './MobilePanel.css';

interface MobileRightPanelProps {
  cuts: number;
  maxCuts: number;
  canClaimCapture: boolean;
  onClaimCapture: () => void;
}

export function MobileRightPanel({ cuts, maxCuts, canClaimCapture, onClaimCapture }: MobileRightPanelProps): React.ReactNode {
  return (
    <div className="mobile-panel mobile-panel--right">
      <div className="mpanel__cuts">
        <span className="mpanel__label">CUTS</span>
        <span className="mpanel__count">{cuts} / {maxCuts}</span>
      </div>
      <button
        type="button"
        className={`mpanel__claim${canClaimCapture ? ' mpanel__claim--active' : ''}`}
        onClick={onClaimCapture}
        disabled={!canClaimCapture}
        title="Claim Capture"
      >
        Claim<br />Capture
      </button>
    </div>
  );
}
