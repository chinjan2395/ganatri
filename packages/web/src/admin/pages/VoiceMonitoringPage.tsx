import { AdminPanel } from '../components/AdminPanel';
import { AdminPlaceholder } from '../components/AdminPlaceholder';

export function VoiceMonitoringPage() {
  return (
    <div className="admin-page">
      <AdminPlaceholder
        title="Voice Monitoring"
        description="Track voice chat usage and session quality across active games."
      />
      <div className="admin__stats-grid">
        <div className="admin__stat">
          <span className="admin__stat-value">62.7%</span>
          <span className="admin__stat-label">Voice Adoption</span>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-value">49</span>
          <span className="admin__stat-label">Active Voice Sessions</span>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-value">98.2%</span>
          <span className="admin__stat-label">Connection Success</span>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-value">42ms</span>
          <span className="admin__stat-label">Avg Latency</span>
        </div>
      </div>
      <AdminPanel title="Voice Sessions by Room">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Participants</th>
                <th>Duration</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>YD3BTK</td><td>4/4</td><td>8m 12s</td><td><span className="admin-status-pill admin-status--playing">Excellent</span></td></tr>
              <tr><td>AB7C4D</td><td>3/4</td><td>14m 05s</td><td><span className="admin-status-pill admin-status--playing">Good</span></td></tr>
              <tr><td>XK9M2P</td><td>2/4</td><td>1m 48s</td><td><span className="admin-status-pill admin-status--progress">Fair</span></td></tr>
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
