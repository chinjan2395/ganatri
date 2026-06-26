import type { ReactNode } from 'react';
import './RoomActivityPanel.css';

export interface ActivityEntry {
  time: string;
  text: string;
}

export interface RoomActivityPanelProps {
  entries: ActivityEntry[];
  activeTab?: 'activity' | 'chat';
  onTabChange?: (tab: 'activity' | 'chat') => void;
}

export function RoomActivityPanel({
  entries,
  activeTab = 'activity',
  onTabChange,
}: RoomActivityPanelProps): ReactNode {
  return (
    <div className="room__activity-panel">
      <div className="room__activity-tabs">
        <button
          type="button"
          className={`room__activity-tab${activeTab === 'activity' ? ' room__activity-tab--active' : ''}`}
          onClick={() => onTabChange?.('activity')}
        >
          ACTIVITY
        </button>
        <button
          type="button"
          className={`room__activity-tab${activeTab === 'chat' ? ' room__activity-tab--active' : ''}`}
          onClick={() => onTabChange?.('chat')}
        >
          CHAT
        </button>
      </div>
      <div className="room__activity-content">
        {activeTab === 'activity' ? (
          <ul className="room__activity-log">
            {entries.map((entry, i) => (
              <li key={i} className="room__activity-entry">
                <span className="room__activity-time">{entry.time}</span>
                <span className="room__activity-entry-icon" aria-hidden="true">
                  👤
                </span>
                <span className="room__activity-text">{entry.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="room__chat-empty">
            <p>No messages yet</p>
          </div>
        )}
      </div>
      <div className="room__chat-input-row">
        <button
          type="button"
          className="room__chat-emoji-btn"
          disabled
          title="Emoji coming soon"
        >
          😊
        </button>
        <input
          className="room__chat-input"
          placeholder="Type a message..."
          readOnly
        />
        <button type="button" className="room__chat-send-btn" disabled>
          ➤
        </button>
      </div>
    </div>
  );
}
