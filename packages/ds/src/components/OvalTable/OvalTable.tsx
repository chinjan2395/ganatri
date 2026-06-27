import type { ReactNode } from 'react';
import { SeatSlot } from '../SeatSlot';
import type { SeatData } from '../SeatSlot';
import './OvalTable.css';

export interface OvalTableProps {
  seats: SeatData[];
}

export function OvalTable({ seats }: OvalTableProps): ReactNode {
  return (
    <div className="room__table-area">
      <div className="room__oval">
        <div className="room__oval-rail" aria-hidden="true">
          <div className="room__oval-felt">
            <span className="room__oval-mark">♠</span>
          </div>
          <span className="room__rail-light room__rail-light--tl" />
          <span className="room__rail-light room__rail-light--tr" />
          <span className="room__rail-light room__rail-light--bl" />
          <span className="room__rail-light room__rail-light--br" />
        </div>
        <span className="room__dealer-chip" aria-label="Dealer">D</span>
        {seats.map((seat, i) => (
          <SeatSlot key={i} seat={seat} seatIndex={i as 0 | 1 | 2 | 3} />
        ))}
      </div>
    </div>
  );
}
