import type { ReactNode } from 'react';
import { RoomSeatSlot } from '../RoomSeatSlot';
import type { SeatData } from '../RoomSeatSlot';
import './RoomOvalTable.css';

export interface RoomOvalTableProps {
  seats: SeatData[];
}

export function RoomOvalTable({ seats }: RoomOvalTableProps): ReactNode {
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
          <RoomSeatSlot key={i} seat={seat} seatIndex={i as 0 | 1 | 2 | 3} />
        ))}
      </div>
    </div>
  );
}
