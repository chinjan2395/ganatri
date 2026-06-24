import type { RoomDetail } from '../mockData';

interface RoomDetailsPanelProps {
  room: RoomDetail;
  onClose: () => void;
}

function statusClass(status: RoomDetail['status']): string {
  if (status === 'Playing') return 'admin-status--playing';
  if (status === 'Lobby') return 'admin-status--progress';
  if (status === 'Finished') return 'admin-status--finished';
  return 'admin-status--closed';
}

export function RoomDetailsPanel({ room, onClose }: RoomDetailsPanelProps) {
  const infoRows: { label: string; value: string }[] = [
    { label: 'Host', value: room.hostName },
    { label: 'Room Created', value: room.roomCreated },
    { label: 'Players', value: room.players },
    ...(room.gameStarted ? [{ label: 'Game Started', value: room.gameStarted }] : []),
    { label: 'Current Duration', value: room.currentDuration },
    ...(room.gameId ? [{ label: 'Game ID', value: room.gameId }] : []),
    { label: 'Status', value: room.status },
    { label: 'Voice Chat', value: room.voiceChat },
  ];

  return (
    <aside className="admin-room-detail">
      <div className="admin-room-detail__header">
        <div className="admin-room-detail__title-row">
          <h3 className="admin-room-detail__code">{room.code}</h3>
          <span className={`admin-status-pill ${statusClass(room.status)}`}>{room.status}</span>
        </div>
        <button
          type="button"
          className="admin-room-detail__close"
          onClick={onClose}
          aria-label="Close room details"
        >
          ×
        </button>
      </div>

      <dl className="admin-room-detail__info">
        {infoRows.map(row => (
          <div key={row.label} className="admin-room-detail__info-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="admin-room-detail__section">
        <h4 className="admin-room-detail__section-title">Players in Room</h4>
        {room.playersInRoom.length > 0 ? (
          <ul className="admin-room-detail__players">
            {room.playersInRoom.map(player => (
              <li key={player.name} className="admin-room-detail__player">
                <span className="admin-table__avatar">{player.initials}</span>
                <span className="admin-room-detail__player-name">
                  {player.name}
                  {player.isHost && <span className="admin-room-detail__crown" title="Host">👑</span>}
                </span>
                <span className={`admin-room-detail__online${player.online ? ' admin-room-detail__online--on' : ''}`}>
                  <span className="admin-status-pill__dot" />
                  {player.online ? 'Online' : 'Offline'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-room-detail__empty">No players in this room.</p>
        )}
      </div>

      <div className="admin-room-detail__section">
        <h4 className="admin-room-detail__section-title">Actions</h4>
        <div className="admin-room-detail__actions">
          <button type="button" className="admin-room-detail__action admin-room-detail__action--danger">
            <span className="admin-room-detail__action-icon">⏻</span>
            Force Close Room
          </button>
          <button type="button" className="admin-room-detail__action">
            <span className="admin-room-detail__action-icon">👢</span>
            Kick Player
          </button>
          <button type="button" className="admin-room-detail__action">
            <span className="admin-room-detail__action-icon">👑</span>
            Transfer Host
          </button>
          <button type="button" className="admin-room-detail__action">
            <span className="admin-room-detail__action-icon">👁</span>
            View Game Details
          </button>
        </div>
      </div>
    </aside>
  );
}
