import type { ServerHealthData } from '../mockData';
import { AdminPanel } from './AdminPanel';

interface ServerHealthPanelProps {
  data: ServerHealthData;
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="admin-health__bar-row">
      <div className="admin-health__bar-header">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="admin-health__bar-track">
        <div
          className="admin-health__bar-fill"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function ServerHealthPanel({ data }: ServerHealthPanelProps) {
  return (
    <AdminPanel title="Server Health">
      <div className="admin-health">
        <div className="admin-health__metric">
          <span className="admin-health__label">Connected Sessions</span>
          <span className="admin-health__value admin-health__value--good">
            {data.connectedSessions.toLocaleString()}
          </span>
        </div>
        <div className="admin-health__metric">
          <span className="admin-health__label">Socket Connections</span>
          <span className="admin-health__value admin-health__value--good">
            {data.socketConnections.toLocaleString()}
          </span>
        </div>
        <ProgressBar value={data.memoryPercent} label="Memory Usage" />
        <ProgressBar value={data.cpuPercent} label="CPU Usage" />
        <div className="admin-health__metric">
          <span className="admin-health__label">DB Connections</span>
          <span className="admin-health__value">{data.dbConnections}</span>
        </div>
        <div className="admin-health__metric">
          <span className="admin-health__label">DB Response Time</span>
          <span className="admin-health__value admin-health__value--good">
            {data.dbResponseMs}ms
          </span>
        </div>
      </div>
    </AdminPanel>
  );
}
