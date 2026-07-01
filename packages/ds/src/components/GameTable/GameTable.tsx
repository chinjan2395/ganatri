import type { ReactNode } from 'react';
import './GameTable.css';

export interface GameTableSeatData {
  /** playerId — used as the React key. */
  id: string;
  /** Pre-rendered seat content, e.g. <PlayerWrap><OpponentSeat .../></PlayerWrap>. */
  node: ReactNode;
}

export interface GameTableProps {
  /**
   * 2-4 seats. IMPORTANT: `seats[seats.length - 1]` MUST be the local player
   * ("you") — it is always rendered bottom-center.
   */
  seats: GameTableSeatData[];
  /** Center play-area content (the live board/cards/stock pile/flash messages). */
  children?: ReactNode;
  className?: string;
}

export function GameTable({ seats, children, className }: GameTableProps): ReactNode {
  const rootClass = ['game-table__area', className].filter(Boolean).join(' ');
  return (
    <div className={rootClass}>
      <div className="game-table__oval">
        <div className="game-table__rail" aria-hidden="true">
          <div className="game-table__felt">
            {children && <div className="game-table__play-area">{children}</div>}
          </div>
          <span className="game-table__rail-light game-table__rail-light--tl" />
          <span className="game-table__rail-light game-table__rail-light--tr" />
          <span className="game-table__rail-light game-table__rail-light--bl" />
          <span className="game-table__rail-light game-table__rail-light--br" />
        </div>
        {seats.map((seat, i) => (
          <div key={seat.id} className={`game-table__seat game-table__seat--${seats.length}-${i}`}>
            {seat.node}
          </div>
        ))}
      </div>
    </div>
  );
}
