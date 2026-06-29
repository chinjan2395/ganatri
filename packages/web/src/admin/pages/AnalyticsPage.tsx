import type { AdminKpiStats } from '../../protocol';
import { AdminPanel } from '../components/AdminPanel';
import { GamesOverTimeChart } from '../components/GamesOverTimeChart';
import { KpiSummaryRow } from '../components/KpiSummaryRow';
import { MOCK_GAMES_OVER_TIME, MOCK_KPI_CARDS } from '../mockData';

interface AnalyticsPageProps {
  kpiStats: AdminKpiStats | null;
  kpiLoading: boolean;
  kpiError: string | null;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatDelta(val: number | null): string {
  if (val === null) return '—';
  return (val > 0 ? '+' : '') + val.toFixed(1);
}

export function AnalyticsPage({ kpiStats, kpiLoading, kpiError }: AnalyticsPageProps) {
  const cards = kpiStats
    ? MOCK_KPI_CARDS.map(card => {
        if (card.label === 'Abandonment Rate') {
          return { ...card, value: `${(kpiStats.abandonmentRate * 100).toFixed(2)}%` };
        }
        if (card.label === 'Avg Duration') {
          return {
            ...card,
            value: kpiStats.avgDurationMs !== null ? formatDuration(kpiStats.avgDurationMs) : '—',
          };
        }
        if (card.label === 'Rooms Today') {
          return { ...card, value: String(kpiStats.totalGames) };
        }
        return card;
      })
    : MOCK_KPI_CARDS;

  const chartData = kpiStats?.dailyBreakdown.map(d => ({
    date: d.date,
    label: d.date.slice(5).replace('-', ' '),
    completed: d.completed,
    abandoned: d.abandoned,
  })) ?? MOCK_GAMES_OVER_TIME;

  return (
    <div className="admin-page">
      <KpiSummaryRow cards={cards} />
      <GamesOverTimeChart data={chartData} title="Historical Game Volume" />
      <AdminPanel title="KPI Details">
        {kpiLoading && <p className="admin__hint">Loading KPI data…</p>}
        {!kpiLoading && kpiError && <p className="admin__hint">KPI unavailable — showing mock data.</p>}
        {!kpiLoading && kpiStats && (
          <div className="admin__stats-grid admin__kpi-tiles">
            <div className="admin__stat">
              <span className="admin__stat-value">{kpiStats.totalGames}</span>
              <span className="admin__stat-label">Total Games (7d)</span>
            </div>
            <div className="admin__stat">
              <span className="admin__stat-value">{kpiStats.completedGames}</span>
              <span className="admin__stat-label">Completed</span>
            </div>
            <div className="admin__stat">
              <span className="admin__stat-value">{kpiStats.abandonedGames}</span>
              <span className="admin__stat-label">Abandoned</span>
            </div>
          </div>
        )}
      </AdminPanel>
      {kpiStats && (
        <AdminPanel title="Scoring Analytics">
          <div className="admin__stats-grid admin__kpi-tiles">
            <div className="admin__stat">
              <span className="admin__stat-value">
                {kpiStats.avgXpGrantedPerDay !== null
                  ? Math.round(kpiStats.avgXpGrantedPerDay).toLocaleString()
                  : '—'}
              </span>
              <span className="admin__stat-label">Avg XP/Day (7d)</span>
            </div>
            <div className="admin__stat">
              <span className="admin__stat-value">{formatDelta(kpiStats.abandonRatingImpact.avgRatingDeltaCompleted)}</span>
              <span className="admin__stat-label">Avg Rating Delta (Completed)</span>
            </div>
            <div className="admin__stat">
              <span className="admin__stat-value">{formatDelta(kpiStats.abandonRatingImpact.avgRatingDeltaAbandoned)}</span>
              <span className="admin__stat-label">Avg Rating Delta (Abandoned)</span>
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <p className="admin__stat-label" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
              Match Score by Player Count
            </p>
            {kpiStats.avgMatchScoreByPlayerCount.length === 0 ? (
              <p className="admin__hint">No scored games in window.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {kpiStats.avgMatchScoreByPlayerCount.map(entry => (
                  <li key={entry.playerCount} className="admin__hint" style={{ marginBottom: '0.25rem' }}>
                    {entry.playerCount}P games: avg score {entry.avgMatchScore.toFixed(1)} ({entry.gameCount}{' '}
                    {entry.gameCount === 1 ? 'game' : 'games'})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AdminPanel>
      )}
    </div>
  );
}
