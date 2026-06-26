import type { ReactNode } from 'react';
import './RoomCornerDecor.css';

export function RoomCornerDecor(): ReactNode {
  return (
    <div className="room__corner-decor" aria-hidden="true">
      {/* Warm ambient glow beneath the pile */}
      <div className="room__corner-glow" />

      {/* Chip stack */}
      <div className="room__corner-chip-pile">
        {(['red', 'black', 'blue', 'green', 'red', 'blue'] as const).map((color, i) => (
          <div key={i} className={`room__corner-chip-disc room__corner-chip-disc--${color}`} />
        ))}
      </div>

      {/* Card fan — back → back → K♠ → A♥ */}
      <div className="room__corner-card-fan">
        {/* Card back 1 */}
        <div className="room__corner-card room__corner-card--a">
          <div className="room__corner-card-back" />
        </div>
        {/* Card back 2 */}
        <div className="room__corner-card room__corner-card--b">
          <div className="room__corner-card-back" />
        </div>
        {/* King of Spades */}
        <div className="room__corner-card room__corner-card--c">
          <div className="room__corner-card-face">
            <span className="room__corner-card-rank">K</span>
            <span className="room__corner-card-suit">♠</span>
            <span className="room__corner-card-center">♠</span>
          </div>
        </div>
        {/* Ace of Hearts — front */}
        <div className="room__corner-card room__corner-card--d">
          <div className="room__corner-card-face room__corner-card-face--red">
            <span className="room__corner-card-rank">A</span>
            <span className="room__corner-card-suit">♥</span>
            <span className="room__corner-card-center">♥</span>
          </div>
        </div>
      </div>

      {/* Gold sparkle stars */}
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className={`room__corner-sparkle room__corner-sparkle--${i + 1}`} />
      ))}
    </div>
  );
}
