import React from 'react';
import './GameTable.css';

interface GameTableProps {
  children: React.ReactNode;
  statusText?: string;
  isYourTurn?: boolean;
  flashNode?: React.ReactNode;
}

export function GameTable({ children, statusText, isYourTurn, flashNode }: GameTableProps): React.ReactNode {
  return (
    <div className="gtable">
      <div className="gtable__oval">
        <div className="gtable__label">Opponent's cards</div>
        {flashNode && <div className="gtable__flash">{flashNode}</div>}
        <div className="gtable__content">{children}</div>
        <span className="gtable__watermark" aria-hidden>♠</span>
        <div className="gtable__dealer" aria-hidden>D</div>
        {statusText && (
          <div className={`gtable__status gtable__status--inset${isYourTurn ? ' gtable__status--yours' : ''}`}>
            {statusText}
          </div>
        )}
      </div>
    </div>
  );
}
