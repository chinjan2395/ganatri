import type { ReactNode } from 'react';
import './RoomFooterBar.css';

export interface RoomFooterBarProps {
  tagline?: string;
}

export function RoomFooterBar({
  tagline = 'Play smart. Play sharp. Win with Ganatri.',
}: RoomFooterBarProps): ReactNode {
  return (
    <div className="room__footer-bar">
      <span className="room__footer-suits room__footer-suits--red">♥ ♦</span>
      <span className="room__footer-tagline">{tagline}</span>
      <span className="room__footer-suits">♠ ♣</span>
      <div className="room__footer-decor" aria-hidden="true">
        <div className="room__footer-cards">
          <span className="room__footer-card room__footer-card--hearts">
            A<span>♥</span>
          </span>
          <span className="room__footer-card room__footer-card--spades">
            K<span>♠</span>
          </span>
        </div>
        <div className="room__footer-chips">
          <span className="room__footer-chip room__footer-chip--red" />
          <span className="room__footer-chip room__footer-chip--blue" />
          <span className="room__footer-chip room__footer-chip--green" />
        </div>
      </div>
    </div>
  );
}
