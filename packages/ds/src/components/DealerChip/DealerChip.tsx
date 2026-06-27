import type { ReactNode } from 'react';
import './DealerChip.css';

export function DealerChip(): ReactNode {
  return (
    <span className="room__dealer-chip" aria-label="Dealer">D</span>
  );
}
