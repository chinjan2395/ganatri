import type { LiveGameRow } from '../mockData';
import { AdminPanel } from './AdminPanel';

interface LiveGamesTableProps {
  rows: LiveGameRow[];
}

function statusClass(status: LiveGameRow['status']): string {
  if (status === 'Playing') return 'admin-status--playing';
  if (status === 'In Progress') return 'admin-status--progress';
  return 'admin-status--completed';
}

export function LiveGamesTable({ rows }: LiveGamesTableProps) {
  return (
    <AdminPanel title="Live Game Activity">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Game ID</th>
              <th>Room Code</th>
              <th>Players</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Started At</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.gameId}>
                <td>{row.gameId}</td>
                <td>{row.roomCode}</td>
                <td>{row.players}</td>
                <td>
                  <span className={`admin-status-pill ${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.duration}</td>
                <td>{row.startedAt}</td>
                <td>
                  <button type="button" className="admin-table__view-btn" aria-label="View game">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPanel>
  );
}
