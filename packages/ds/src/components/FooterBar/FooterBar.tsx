import type { ReactNode } from 'react';
import './FooterBar.css';

export interface FooterBarProps {
  tagline?: string;
}

export function FooterBar({
  tagline = 'Play smart. Play sharp. Win with Ganatri.',
}: FooterBarProps): ReactNode {
  return (
    <footer className="room__footer-bar">
      <span className="room__footer-suits room__footer-suits--red">♥ ♦</span>
      <span className="room__footer-tagline">{tagline}</span>
      <span className="room__footer-suits">♠ ♣</span>
    </footer>
  );
}
