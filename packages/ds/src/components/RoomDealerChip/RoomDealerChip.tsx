import type { ReactNode } from 'react';
import './RoomDealerChip.css';

export function RoomDealerChip(): ReactNode {
  return (
    <span className="room__dealer-chip" aria-label="Dealer">D</span>
  );
}
