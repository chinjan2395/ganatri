import type { ReactNode } from 'react';
import './SeatSlot.css';

export interface SeatData {
  initials: string;
  name: string;
  isYou: boolean;
  isHost: boolean;
  isSpeaking: boolean;
  avatarUrl?: string | null;
  isEmpty: boolean;
}

export interface SeatSlotProps {
  seat: SeatData;
  seatIndex: 0 | 1 | 2 | 3;
}

function UserIcon(): ReactNode {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 20c0-4 3.6-6.5 8-6.5S20 16 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SeatSlot({ seat, seatIndex }: SeatSlotProps): ReactNode {
  const circleClasses = [
    'room__seat-circle',
    seat.isEmpty ? 'room__seat-circle--empty' : 'room__seat-circle--occupied',
    !seat.isEmpty && seat.isYou ? 'room__seat-circle--you' : '',
    !seat.isEmpty && seat.isSpeaking ? 'room__seat-circle--speaking' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`room__seat room__seat--${seatIndex}`}>
      <div className="room__seat-slot">
        <div className={circleClasses}>
          {seat.isEmpty ? (
            <span className="room__seat-icon">
              <UserIcon />
            </span>
          ) : (
            <>
              {seat.isHost && (
                <span className="room__seat-crown" aria-label="Host">♛</span>
              )}
              {seat.avatarUrl ? (
                <img
                  src={seat.avatarUrl}
                  alt={seat.name}
                  className="room__seat-avatar-img"
                />
              ) : (
                <span className="room__seat-initials">{seat.initials}</span>
              )}
            </>
          )}
        </div>

        {seat.isEmpty ? (
          <span className="room__seat-waiting-label">
            Waiting for{'\n'}player...
          </span>
        ) : (
          <>
            <span className="room__seat-name">{seat.name}</span>
            {seat.isYou && (
              <span className="room__seat-you-badge">YOU</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
