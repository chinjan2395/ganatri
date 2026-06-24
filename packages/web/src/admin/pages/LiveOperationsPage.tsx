import { AdminPanel } from '../components/AdminPanel';
import { KpiSummaryRow } from '../components/KpiSummaryRow';
import { LiveGamesTable } from '../components/LiveGamesTable';
import { MOCK_KPI_CARDS, MOCK_LIVE_GAMES } from '../mockData';

export function LiveOperationsPage() {
  return (
    <div className="admin-page">
      <KpiSummaryRow cards={MOCK_KPI_CARDS.slice(0, 4)} />
      <LiveGamesTable rows={MOCK_LIVE_GAMES} />
      <AdminPanel title="Operations Summary">
        <div className="admin__stats-grid">
          <div className="admin__stat">
            <span className="admin__stat-value">12</span>
            <span className="admin__stat-label">Games starting/hr</span>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-value">3.2%</span>
            <span className="admin__stat-label">Disconnect rate</span>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-value">94%</span>
            <span className="admin__stat-label">Room fill rate</span>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-value">2.1s</span>
            <span className="admin__stat-label">Avg matchmaking</span>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
