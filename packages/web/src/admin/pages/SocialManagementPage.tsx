import { AdminPanel } from '../components/AdminPanel';
import { AdminPlaceholder } from '../components/AdminPlaceholder';

const MOCK_SOCIAL = [
  { user: 'Kartik N.', action: 'Sent friend request', target: 'Ananya D.', time: '12:40 PM' },
  { user: 'Meera K.', action: 'Blocked user', target: 'spam_bot_42', time: '11:22 AM' },
  { user: 'Dev P.', action: 'Accepted invite', target: 'Room XK9M2P', time: '10:55 AM' },
];

export function SocialManagementPage() {
  return (
    <div className="admin-page">
      <AdminPlaceholder
        title="Social Management"
        description="Oversee friend connections, invitations, and blocked users."
      />
      <div className="admin__stats-grid">
        <div className="admin__stat">
          <span className="admin__stat-value">342</span>
          <span className="admin__stat-label">Active Friendships</span>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-value">28</span>
          <span className="admin__stat-label">Pending Invites</span>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-value">15</span>
          <span className="admin__stat-label">Blocked Users</span>
        </div>
      </div>
      <AdminPanel title="Recent Social Activity">
        <ul className="admin-activity">
          {MOCK_SOCIAL.map((item, i) => (
            <li key={i} className="admin-activity__item">
              <span className="admin-activity__text">
                <strong>{item.user}</strong> {item.action} — {item.target}
              </span>
              <span className="admin-activity__time">{item.time}</span>
            </li>
          ))}
        </ul>
      </AdminPanel>
    </div>
  );
}
