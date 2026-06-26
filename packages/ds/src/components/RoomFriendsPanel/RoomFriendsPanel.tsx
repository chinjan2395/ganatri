import type { ReactNode } from 'react';
import './RoomFriendsPanel.css';

export interface FriendRow {
  initials: string;
  name: string;
  subtitle: string;
  online: boolean;
}

export interface RoomFriendsPanelProps {
  friends: FriendRow[];
  onInvite?: (name: string) => void;
  onViewAll?: () => void;
}

export function RoomFriendsPanel({
  friends,
  onInvite,
  onViewAll,
}: RoomFriendsPanelProps): ReactNode {
  return (
    <section className="room__friends-panel">
      <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
      {friends.length === 0 ? (
        <p className="room__friends-empty">No friends online</p>
      ) : (
        <div className="room__invite-list">
          {friends.map((friend) => (
            <div key={friend.name} className="room__invite-row">
              <div className="room__invite-initials" aria-hidden="true">
                {friend.initials}
              </div>
              <div className="room__invite-info">
                <span className="room__invite-name">
                  {friend.online ? (
                    <span className="room__invite-online-dot" aria-hidden="true">
                      &#9679;
                    </span>
                  ) : null}
                  {friend.name}
                </span>
                <span className="room__invite-sub">{friend.subtitle}</span>
              </div>
              <button
                type="button"
                className="room__invite-btn"
                disabled={!friend.online}
                onClick={() => onInvite?.(friend.name)}
              >
                Invite
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="room__friends-view-all" onClick={onViewAll}>
        View All Friends ›
      </button>
    </section>
  );
}
